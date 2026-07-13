import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'prisma/prisma.service';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';
import { Contract, ethers, JsonRpcProvider } from 'ethers';

// Security/reliability: bound every outbound RPC call so a single stalled or
// rate-limited node can never hang the whole HTTP request indefinitely.
const RPC_CALL_TIMEOUT_MS = 10_000;
// Mint transactions wait for on-chain confirmation, so they need more headroom
// than a plain balance read.
const MINT_CALL_TIMEOUT_MS = 30_000;
// Bounded concurrency across vouchers to keep parallel DB transactions under
// the Postgres connection_limit configured on DATABASE_URL.
const MERCHANT_RECONCILE_CONCURRENCY = 3;

@Injectable()
export class CheckAndSyncVoucherOnchainHandler {
  private readonly logger = new Logger(CheckAndSyncVoucherOnchainHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchainService: BlockchainService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Races a promise against a timeout so a hung RPC call fails fast instead
   * of blocking the request forever (root cause of client-side NetworkError
   * on long-running reconcile calls).
   */
  private async withTimeout<T>(
    promise: Promise<T>,
    label: string,
    timeoutMs: number = RPC_CALL_TIMEOUT_MS,
  ): Promise<T> {
    let timer: NodeJS.Timeout;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`RPC call timed out after ${timeoutMs}ms: ${label}`)),
        timeoutMs,
      );
    });
    try {
      return await Promise.race([promise, timeout]);
    } finally {
      clearTimeout(timer!);
    }
  }

  /**
   * @param syncFlag - fixes the DB side: assigns ownership when a wallet holds
   *   more on-chain than DB knows about, and marks DB codes as used when DB
   *   expects more than the wallet actually holds (assumes on-chain is truth).
   * @param fixOnchainFlag - fixes the on-chain side instead: when DB expects
   *   more unused codes than a wallet holds, mints the shortfall directly to
   *   that wallet (assumes DB is truth). Mutually exclusive with syncFlag's
   *   "mark as used" behavior for that specific case — only one can win.
   */
  async execute(voucherId: string, syncFlag = false, fixOnchainFlag = false) {
    this.logger.log(
      `[START] Reconciling on-chain status for voucherId: ${voucherId}, sync: ${syncFlag}, fixOnchain: ${fixOnchainFlag}`,
    );

    // 1. Fetch Voucher from Database
    const voucher = await this.prisma.voucher.findUnique({
      where: { id: voucherId },
      include: {
        merchant: {
          include: { wallet: true },
        },
      },
    });

    if (!voucher) {
      throw new NotFoundException(`Voucher with ID ${voucherId} not found in database.`);
    }

    if (!voucher.tokenId) {
      return {
        success: false,
        message: `Voucher "${voucher.name}" does not have a tokenId mapped in database. On-chain reconciliation is not possible.`,
      };
    }

    const tokenId = Number.parseInt(voucher.tokenId, 10);
    const couponAddress = this.configService.get<string>('COUPON_ADDRESS');
    const marketplaceAddress = this.configService.get<string>('MARKETPLACE_ADDRESS');

    if (!couponAddress) {
      return {
        success: false,
        message: 'COUPON_ADDRESS is not configured in the application environment variables.',
      };
    }

    const rpcUrl = this.configService.get<string>('RPC_URL') || 'https://dlp-rpc2-testnet.adldigitalservice.com';
    const provider = new JsonRpcProvider(rpcUrl);
    
    const contractAbi = [
      'function balanceOf(address account, uint256 id) view returns (uint256)',
      'function getCouponData(uint256 typeId) view returns (string name, uint256 startDate, uint256 expireDate, uint256 totalSupply, uint256 totalRedeemed)',
    ];
    const contract = new Contract(couponAddress, contractAbi, provider);

    // 2. Fetch On-Chain Coupon Data
    let onchainStats = null;
    try {
      const data = await this.withTimeout(
        contract.getCouponData(tokenId),
        `getCouponData(${tokenId})`,
      );
      onchainStats = {
        name: data.name,
        startDate: new Date(Number(data.startDate) * 1000).toISOString(),
        expireDate: new Date(Number(data.expireDate) * 1000).toISOString(),
        totalSupply: Number(data.totalSupply),
        totalRedeemed: Number(data.totalRedeemed),
        activeSupply: Number(data.totalSupply) - Number(data.totalRedeemed),
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Failed to retrieve on-chain data for Token ID ${tokenId} at address ${couponAddress}: ${err.message}`,
      };
    }

    // 3. Fetch Database Voucher Codes Stats
    const totalDbCodes = await this.prisma.voucherCode.count({
      where: { voucherId },
    });

    const usedDbCodes = await this.prisma.voucherCode.count({
      where: { voucherId, isUsed: true },
    });

    const unusedDbCodes = await this.prisma.voucherCode.count({
      where: { voucherId, isUsed: false },
    });

    const dbCodes = await this.prisma.voucherCode.findMany({
      where: { voucherId },
    });

    // 4. Scan On-Chain Balances for All Wallets in the DB
    this.logger.log(`Scanning balances for all wallets...`);
    const wallets = await this.prisma.wallet.findMany();
    const activeWalletsOnchain: Array<{
      walletId: string;
      address: string;
      type: string;
      balance: number;
      email?: string;
      phone?: string;
    }> = [];

    // Chunk size of 35 for parallel RPC queries
    const chunkSize = 35;
    for (let i = 0; i < wallets.length; i += chunkSize) {
      const chunk = wallets.slice(i, i + chunkSize);
      await Promise.all(
        chunk.map(async (w) => {
          try {
            const balStr = await this.withTimeout(
              contract.balanceOf(w.walletAddress, tokenId),
              `balanceOf(${w.walletAddress})`,
            );
            const bal = Number(balStr);
            if (bal > 0) {
              activeWalletsOnchain.push({
                walletId: w.id,
                address: w.walletAddress,
                type: w.type,
                balance: bal,
                email: w.email,
                phone: w.phoneNumber,
              });
            }
          } catch {
            // Quietly ignore failed wallet balance checks
          }
        }),
      );
    }

    // Check Marketplace Contract Balance specifically
    let marketplaceBalance = 0;
    if (marketplaceAddress) {
      try {
        const mbal = await this.withTimeout(
          contract.balanceOf(marketplaceAddress, tokenId),
          `balanceOf(marketplace)`,
        );
        marketplaceBalance = Number(mbal);
      } catch {
        // Ignored
      }
    }

    // 5. Structure Group DB Counts by Client/Merchant Owner
    const dbOwnerCounts = new Map<string, { total: number; unused: number; used: number }>();
    for (const code of dbCodes) {
      const ownerId = code.currentOwnerId || 'UNOWNED_MERCHANT';
      if (!dbOwnerCounts.has(ownerId)) {
        dbOwnerCounts.set(ownerId, { total: 0, unused: 0, used: 0 });
      }
      const counts = dbOwnerCounts.get(ownerId)!;
      counts.total++;
      if (code.isUsed) {
        counts.used++;
      } else {
        counts.unused++;
      }
    }

    // 6. Reconciliation Findings & Mismatch Detection
    const discrepancies: Array<{
      type: string;
      entityId?: string;
      phone?: string;
      walletAddress?: string;
      dbUnusedCount: number;
      onchainBalance: number;
      message: string;
    }> = [];

    const actionsTaken: string[] = [];

    // Let's resolve the target merchant info (the merchant who issued/owns this)
    const merchantId = voucher.sellerMerchantId || voucher.merchantId || '';
    const merchantDetails = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      include: { wallet: true },
    });
    const merchantWalletAddr = merchantDetails?.wallet?.walletAddress?.toLowerCase();

    // Check Marketplace Wallet Balance vs DB Listed Count (which has non-null voucherGroupId)
    const dbListedCodesCount = dbCodes.filter(c => c.voucherGroupId !== null).length;
    if (marketplaceBalance !== dbListedCodesCount) {
      discrepancies.push({
        type: 'MARKETPLACE_BALANCE_MISMATCH',
        dbUnusedCount: dbListedCodesCount,
        onchainBalance: marketplaceBalance,
        message: `Marketplace contract has ${marketplaceBalance} tokens on-chain, but DB lists ${dbListedCodesCount} codes on marketplace.`,
      });
    }

    // Check Used vs Redeemed Mismatches
    if (usedDbCodes !== onchainStats.totalRedeemed) {
      discrepancies.push({
        type: 'TOTAL_REDEEMED_MISMATCH',
        dbUnusedCount: usedDbCodes,
        onchainBalance: onchainStats.totalRedeemed,
        message: `Database records ${usedDbCodes} codes as used, but on-chain registry states ${onchainStats.totalRedeemed} are redeemed.`,
      });
    }

    // Check Customer Wallet Balances match Database Ownership records
    const customers = await this.prisma.customer.findMany({
      include: { wallet: true },
    });

    for (const customer of customers) {
      if (!customer.wallet?.walletAddress) continue;
      const cAddr = customer.wallet.walletAddress.toLowerCase();
      const onchainRecord = activeWalletsOnchain.find(w => w.address.toLowerCase() === cAddr);
      const onchainBalance = onchainRecord ? onchainRecord.balance : 0;

      const dbRecord = dbOwnerCounts.get(customer.id) || { total: 0, unused: 0, used: 0 };
      const dbUnusedCount = dbRecord.unused;

      if (onchainBalance !== dbUnusedCount) {
        discrepancies.push({
          type: 'CUSTOMER_BALANCE_MISMATCH',
          entityId: customer.id,
          phone: customer.tel,
          walletAddress: customer.wallet.walletAddress,
          dbUnusedCount,
          onchainBalance,
          message: `Customer ${customer.firstName || ''} (${customer.tel}) has on-chain balance of ${onchainBalance} tokens, but DB indexes ${dbUnusedCount} unused codes.`,
        });
      }
    }

    // Check Merchant Wallet Balance matches Database Merchant Ownership
    let merchantOnchainBalance = 0;
    if (merchantWalletAddr) {
      const merchantOnchainRecord = activeWalletsOnchain.find(w => w.address.toLowerCase() === merchantWalletAddr);
      merchantOnchainBalance = merchantOnchainRecord ? merchantOnchainRecord.balance : 0;
    }

    const merchantDbRecordUnowned = dbOwnerCounts.get('UNOWNED_MERCHANT') || { total: 0, unused: 0, used: 0 };
    const merchantDbRecordOwned = dbOwnerCounts.get(merchantId) || { total: 0, unused: 0, used: 0 };
    const dbMerchantUnusedTotal = merchantDbRecordUnowned.unused + merchantDbRecordOwned.unused;

    if (merchantOnchainBalance !== dbMerchantUnusedTotal) {
      discrepancies.push({
        type: 'MERCHANT_BALANCE_MISMATCH',
        entityId: merchantId,
        walletAddress: merchantDetails?.wallet?.walletAddress || 'N/A',
        dbUnusedCount: dbMerchantUnusedTotal,
        onchainBalance: merchantOnchainBalance,
        message: `Merchant "${merchantDetails?.name || 'N/A'}" has on-chain balance of ${merchantOnchainBalance} tokens, but DB has ${dbMerchantUnusedTotal} unallocated/merchant codes.`,
      });
    }

    // 7. Corrective Actions (Safe & Additive Only)
    if ((syncFlag || fixOnchainFlag) && discrepancies.length > 0) {
      // 7a. DB-side: assign ownership to customers who already hold the token
      // on-chain but have no matching code in DB yet. Always safe under sync —
      // never conflicts with fixOnchain, since it only touches DB records.
      if (syncFlag) {
        const missingDbCodesCustomers = discrepancies.filter(
          (d) => d.type === 'CUSTOMER_BALANCE_MISMATCH' && d.onchainBalance > d.dbUnusedCount,
        );

        await this.prisma.$transaction(async (tx) => {
          for (const item of missingDbCodesCustomers) {
            const neededCount = item.onchainBalance - item.dbUnusedCount;
            this.logger.log(`Fixing Customer ${item.phone} lacking ${neededCount} DB codes...`);

            // Fetch available un-used, unassigned/merchant code IDs for this voucher
            const availableCodes = await tx.voucherCode.findMany({
              where: {
                voucherId,
                isUsed: false,
                OR: [
                  { currentOwnerId: null, currentOwnerType: 'MERCHANT' },
                  { currentOwnerId: merchantId, currentOwnerType: 'MERCHANT' },
                ],
              },
              take: neededCount,
            });

            if (availableCodes.length >= neededCount) {
              const codeIds = availableCodes.map((c) => c.id);
              await tx.voucherCode.updateMany({
                where: { id: { in: codeIds } },
                data: {
                  currentOwnerId: item.entityId,
                  currentOwnerType: 'CUSTOMER',
                  voucherGroupId: null, // Clear Marketplace status since it is physically with user
                },
              });
              actionsTaken.push(
                `Assigned ${codeIds.length} merchant backup codes (${codeIds.join(', ')}) to Customer phone ${item.phone} to match on-chain balance.`,
              );
            } else {
              actionsTaken.push(
                `Could not auto-assign DB code to Customer ${item.phone}: Lacking available backup merchant codes of this coupon in DB. (Needed ${neededCount}, found ${availableCodes.length}).`,
              );
            }
          }
        });
      }

      // 7b. Cases where DB expects more unused codes than the wallet actually
      // holds on-chain (db > onchain, for either a customer or the merchant).
      // Exactly one resolution strategy applies — they contradict each other:
      //   - fixOnchainFlag: DB is the source of truth; mint the shortfall on-chain.
      //   - syncFlag (default, unchanged behavior): on-chain is the source of
      //     truth; mark the DB codes as used instead.
      const overAllocatedEntities = discrepancies.filter(
        (d) =>
          (d.type === 'CUSTOMER_BALANCE_MISMATCH' || d.type === 'MERCHANT_BALANCE_MISMATCH') &&
          d.dbUnusedCount > d.onchainBalance,
      );

      if (fixOnchainFlag) {
        for (const item of overAllocatedEntities) {
          const shortfall = item.dbUnusedCount - item.onchainBalance;
          const label = item.phone || item.entityId || 'unknown';

          if (!item.walletAddress || item.walletAddress === 'N/A') {
            actionsTaken.push(
              `Could not mint on-chain for ${label}: no wallet address on file.`,
            );
            continue;
          }

          try {
            const { hash } = await this.withTimeout(
              this.blockchainService.mintCoupon(item.walletAddress, String(tokenId), shortfall),
              `mintCoupon(${item.walletAddress}, ${tokenId}, ${shortfall})`,
              MINT_CALL_TIMEOUT_MS,
            );
            actionsTaken.push(
              `Minted ${shortfall} on-chain tokens of Token ID ${tokenId} to ${label} (${item.walletAddress}) to match DB record. Tx: ${hash}`,
            );
          } catch (err: any) {
            actionsTaken.push(
              `Failed to mint on-chain shortfall of ${shortfall} tokens for ${label}: ${err.message}`,
            );
          }
        }
      } else if (syncFlag) {
        const totalRemainingOnchainRedeemedToSync = onchainStats.totalRedeemed - usedDbCodes;
        if (totalRemainingOnchainRedeemedToSync > 0) {
          let syncedRedeems = 0;
          await this.prisma.$transaction(async (tx) => {
            for (const item of overAllocatedEntities) {
              if (item.type !== 'CUSTOMER_BALANCE_MISMATCH') continue;
              if (syncedRedeems >= totalRemainingOnchainRedeemedToSync) break;
              const burnCount = item.dbUnusedCount - item.onchainBalance;

              const customerDbCodes = await tx.voucherCode.findMany({
                where: {
                  voucherId,
                  currentOwnerId: item.entityId,
                  currentOwnerType: 'CUSTOMER',
                  isUsed: false,
                },
                take: Math.min(burnCount, totalRemainingOnchainRedeemedToSync - syncedRedeems),
              });

              if (customerDbCodes.length > 0) {
                const codeIds = customerDbCodes.map((c) => c.id);
                await tx.voucherCode.updateMany({
                  where: { id: { in: codeIds } },
                  data: {
                    isUsed: true,
                    usedAt: new Date(),
                    usedBy: item.entityId,
                  },
                });
                syncedRedeems += codeIds.length;
                actionsTaken.push(
                  `Synced on-chain redemption: Marked ${codeIds.length} unused codes (${codeIds.join(', ')}) belonging to Customer ${item.phone} as "Used", aligning with on-chain 0 balance.`,
                );
              }
            }
          });
        }
      }
    }

    return {
      success: true,
      voucher: {
        id: voucher.id,
        name: voucher.name,
        tokenId,
        status: voucher.status,
        merchantId,
        merchantName: merchantDetails?.name,
      },
      onchain: onchainStats,
      dbStats: {
        totalCodes: totalDbCodes,
        unusedCodes: unusedDbCodes,
        usedCodes: usedDbCodes,
        marketplaceCodes: dbListedCodesCount,
      },
      marketplaceAddress,
      discrepancies,
      synced: (syncFlag || fixOnchainFlag) && actionsTaken.length > 0,
      actionsTaken,
    };
  }

  async executeForMerchant(merchantId: string, syncFlag = false, fixOnchainFlag = false) {
    this.logger.log(
      `[START] Reconciling all vouchers for merchantId: ${merchantId}, sync: ${syncFlag}, fixOnchain: ${fixOnchainFlag}`,
    );

    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
    });

    if (!merchant) {
      throw new NotFoundException(`Merchant with ID ${merchantId} not found.`);
    }

    const vouchers = await this.prisma.voucher.findMany({
      where: {
        OR: [
          { merchantId },
          { sellerMerchantId: merchantId },
        ],
      },
      select: {
        id: true,
        name: true,
        tokenId: true,
      },
    });

    this.logger.log(
      `Found ${vouchers.length} vouchers for merchant "${merchant.name}".`,
    );

    const results: any[] = new Array(vouchers.length);
    for (let i = 0; i < vouchers.length; i += MERCHANT_RECONCILE_CONCURRENCY) {
      const batch = vouchers.slice(i, i + MERCHANT_RECONCILE_CONCURRENCY);
      await Promise.all(
        batch.map(async (voucher, offset) => {
          const index = i + offset;
          if (!voucher.tokenId) {
            results[index] = {
              success: false,
              voucher: {
                id: voucher.id,
                name: voucher.name,
                tokenId: null,
              },
              message: `Voucher does not have a tokenId mapped in database.`,
            };
            return;
          }

          try {
            results[index] = await this.execute(voucher.id, syncFlag, fixOnchainFlag);
          } catch (err: any) {
            results[index] = {
              success: false,
              voucher: {
                id: voucher.id,
                name: voucher.name,
                tokenId: voucher.tokenId,
              },
              message: `Error during reconciliation: ${err.message}`,
            };
          }
        }),
      );
    }

    return {
      success: true,
      merchant: {
        id: merchant.id,
        name: merchant.name,
      },
      vouchersCount: vouchers.length,
      reports: results,
    };
  }
}