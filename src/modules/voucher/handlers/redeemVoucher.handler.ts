import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';
import { TransactionTypeId } from 'src/constants/transaction-types.enum';
import { AssetType, ParticipantType } from '@prisma/client';
import { randomUUID } from 'crypto';
import { TokenService } from 'src/providers/token/token.service';
import { ConfigService } from '@nestjs/config';
import { getSignerFromSeedPhrase } from 'src/libs/derive-wallet';

@Injectable()
export class RedeemVoucher {
  private logger = new Logger(RedeemVoucher.name);
  private salt: string;

  constructor(
    private prisma: PrismaService,
    private blockchainService: BlockchainService,
    private tokenService: TokenService,
    private configService: ConfigService,
  ) {
    this.salt = this.configService.get<string>('SALT');
  }

  async execute(code: string, phone: string, merchantRef: string) {
    try {
      this.logger.log(
        `[START] Redeeming voucher code: ${code} for customer phone: ${phone} at merchant: ${merchantRef}`,
      );

      // 0. Find customer by phone
      this.logger.log(`[STEP 0] Finding customer by phone: ${phone}`);
      const customer = await this.prisma.customer.findFirst({
        where: { tel: phone },
        include: { wallet: true },
      });

      if (!customer) {
        this.logger.error(`[ERROR] Customer with phone ${phone} not found`);
        throw new NotFoundException(`Customer with phone ${phone} not found`);
      }

      const customerId = customer.id;
      this.logger.log(`[STEP 0] Customer found: ${customerId}`);

      // 1. ตรวจสอบว่า code มีอยู่จริง
      this.logger.log(`[STEP 1] Validating voucher code: ${code}`);
      const voucherCode = await this.prisma.voucherCode.findUnique({
        where: { code },
        select: {
          id: true,
          code: true,
          voucherId: true,
          voucherGroupId: true,
          pointsCost: true,
          pointId: true,
          currency: true,
          isUsed: true,
          usedBy: true,
          usedAt: true,
          currentOwnerId: true,
          voucher: {
            select: {
              id: true,
              tokenId: true,
              name: true,
              description: true,
              imageUrl: true,
              status: true,
              startDate: true,
              endDate: true,
              valueType: true,
              value: true,
              currency: true,
              totalRedeemed: true,
              merchantId: true,
              merchantName: true,
              merchant: {
                select: {
                  id: true,
                  name: true,
                  description: true,
                  imageUrl: true,
                },
              },
              merchantRef: true,
            },
          },
        },
      });

      if (!voucherCode) {
        this.logger.error(`[ERROR] Voucher code not found: ${code}`);
        throw new NotFoundException(`Voucher code "${code}" not found`);
      }

      // 2. ตรวจสอบว่า code ยังไม่ถูกใช้
      this.logger.log(`[STEP 2] Checking if code is already used`);
      if (voucherCode.isUsed) {
        this.logger.error(
          `[ERROR] Code already redeemed by: ${voucherCode.usedBy} at ${voucherCode.usedAt}`,
        );
        throw new BadRequestException(
          `Voucher code has already been redeemed${voucherCode.usedBy ? ` by customer: ${voucherCode.usedBy}` : ''}`,
        );
      }

      // 2.5 ตรวจสอบว่า merchantRef ตรงกับ voucher หรือไม่
      this.logger.log(`[STEP 2.5] Verifying merchantRef: ${merchantRef}`);
      if (
        voucherCode.voucher.merchantRef &&
        voucherCode.voucher.merchantRef !== merchantRef
      ) {
        this.logger.error(
          `[ERROR] MerchantRef mismatch. Expected: ${voucherCode.voucher.merchantRef}, Got: ${merchantRef}`,
        );
        throw new BadRequestException(
          `This voucher can only be redeemed at the issuing merchant`,
        );
      }
      this.logger.log(`[STEP 2.5] MerchantRef verified ✓`);

      // 3. ตรวจสอบว่า voucher ยังไม่หมดอายุ
      this.logger.log(`[STEP 3] Checking voucher validity`);
      const now = new Date();
      const voucher = voucherCode.voucher;

      if (voucher.endDate && new Date(voucher.endDate) < now) {
        this.logger.error(`[ERROR] Voucher expired at: ${voucher.endDate}`);
        throw new BadRequestException(
          `Voucher has expired on ${voucher.endDate}`,
        );
      }

      if (voucher.startDate && new Date(voucher.startDate) > now) {
        this.logger.error(
          `[ERROR] Voucher not yet valid. Start date: ${voucher.startDate}`,
        );
        throw new BadRequestException(
          `Voucher is not yet valid. Available from ${voucher.startDate}`,
        );
      }

      // 4. ตรวจสอบ pointId configuration
      if (!voucherCode.pointId) {
        this.logger.error(
          `[ERROR] VoucherCode ${code} has no pointId configured`,
        );
        throw new BadRequestException(
          'This voucher requires point currency setup. Please contact admin.',
        );
      }

      this.logger.log(
        `[STEP 4] Point currency: ${voucherCode.currency} (pointId: ${voucherCode.pointId})`,
      );

      // 5. ตรวจสอบว่า code ถูก activate แล้วหรือยัง (มี voucherGroupId)
      if (!voucherCode.voucherGroupId) {
        this.logger.error(`[ERROR] Code not yet activated (no voucherGroupId)`);
        throw new BadRequestException(
          `Voucher code has not been activated yet`,
        );
      }

      // 6. ตรวจสอบ ownership (ถ้ามี currentOwnerId)
      if (voucherCode.currentOwnerId) {
        this.logger.log(`[STEP 6] Verifying ownership`);
        if (voucherCode.currentOwnerId !== customerId) {
          this.logger.error(
            `[ERROR] Customer ${customerId} does not own this voucher. Owner: ${voucherCode.currentOwnerId}`,
          );
          throw new BadRequestException(
            `You do not own this voucher. It belongs to another customer.`,
          );
        }
        this.logger.log(`[STEP 6] Ownership verified ✓`);
      }

      // 7. Get customer wallet address
      this.logger.log(`[STEP 7] Getting customer wallet address`);
      const customerAddress = customer.wallet?.walletAddress || '';
      const encryptedSeedPhrase = customer.wallet?.seedPhrase || '';
      const decryptedSeedPhrase = this.tokenService.decryptKey(
        this.salt,
        encryptedSeedPhrase,
      );

      if (!customerAddress) {
        throw new NotFoundException('Customer wallet not configured');
      }
      if (!decryptedSeedPhrase) {
        throw new NotFoundException(
          'Customer seed phrase not configured or decryption failed',
        );
      }

      // Derive private key from seed phrase
      const customerSigner = getSignerFromSeedPhrase(
        decryptedSeedPhrase,
        customer.wallet?.derivationIndex || 0,
      );
      const customerPrivateKey = customerSigner.privateKey;

      // 7.5 ตรวจสอบ on-chain balance ของลูกค้าก่อน redeem เพื่อเลี่ยง revert จากสัญญา
      this.logger.log(
        `[STEP 7.5] Checking on-chain coupon balance for typeId: ${voucher.tokenId} and owner: ${customerAddress}`,
      );
      const onChainBalance = await this.blockchainService.getUserCouponBalance(
        customerAddress,
        Number(voucher.tokenId),
      );

      if (!onChainBalance || Number(onChainBalance.balance) < 1) {
        this.logger.error(
          `[ERROR] On-chain balance insufficient. Balance: ${onChainBalance?.balance || 0}`,
        );
        throw new BadRequestException(
          'Insufficient on-chain coupon balance for redemption',
        );
      }

      // 8. เรียก Smart Contract เพื่อ redeem voucher NFT (Burn ERC-1155)
      let blockchainTx = null;
      const vaultReleaseTx = null;
      this.logger.log(
        `[STEP 8] Calling smart contract to redeem voucher code: ${code}`,
      );

      // 8a. Redeem on-chain
      try {
        // Use tokenId from voucher
        if (!voucher.tokenId) {
          throw new Error(
            'Voucher does not have tokenId. Cannot redeem on blockchain.',
          );
        }

        const typeId = voucher.tokenId;

        this.logger.log(
          `[STEP 8] Redeeming typeId: ${typeId} for customer: ${customerAddress}`,
        );

        blockchainTx = await this.blockchainService.redeemVoucher(
          typeId,
          1, // Redeem 1 unit (ERC-1155)
          customerAddress,
          customerPrivateKey, // Redeem as the actual owner so contract balance + marketplace callback apply
        );

        this.logger.log(
          `[STEP 8] Smart contract redeem successful. Tx: ${blockchainTx.hash}`,
        );
      } catch (error) {
        this.logger.error(
          `[ERROR] Smart contract redeem failed: ${error.message}`,
        );
        throw new BadRequestException(
          `Failed to redeem voucher on blockchain: ${error.message}`,
        );
      }

      // 8b. Vault release will be triggered by marketplace callback inside the contract redeem

      // 9. Get merchant wallet for transaction
      this.logger.log(`[STEP 9] Getting merchant wallet address`);
      if (!voucher.merchantId) {
        throw new BadRequestException('Voucher has no merchant assigned');
      }

      const merchant = await this.prisma.merchant.findUnique({
        where: { id: voucher.merchantId },
        select: { walletId: true, wallet: true },
      });

      if (!merchant?.wallet) {
        throw new BadRequestException(
          'Merchant wallet not configured. Cannot process redemption.',
        );
      }

      const merchantAddress = merchant.wallet.walletAddress || '';

      // 10. อัพเดท database - mark code เป็น used, สร้าง REDEEM transaction, transfer points
      this.logger.log(
        `[STEP 10] Updating database - marking code as used and creating REDEEM transaction`,
      );
      const [updatedCode, redeemTransaction] = await this.prisma.$transaction([
        // Mark code as used
        this.prisma.voucherCode.update({
          where: { id: voucherCode.id },
          data: {
            isUsed: true,
            usedBy: customerId,
            usedAt: new Date(),
          },
          include: {
            voucher: true,
          },
        }),

        // Create REDEEM transaction record
        this.prisma.transaction.create({
          data: {
            txHash: Buffer.from(blockchainTx.hash.slice(2), 'hex'),
            senderAddress: Buffer.from(customerAddress.slice(2), 'hex'),
            receiverAddress: Buffer.from(merchantAddress.slice(2), 'hex'),
            amount: 1, // Customer redeems 1 voucher (not pointsCost)
            pointId: voucherCode.pointId,
            senderId: customerId,
            receiverId: null, // No receiver - voucher is burned, not transferred
            merchantId: voucher.merchantId, // Track which merchant's voucher was redeemed
            voucherCodeId: voucherCode.id,
            transactionTypeId: TransactionTypeId.REDEEM,
            type: AssetType.VOUCHER,
            senderType: ParticipantType.CUSTOMER,
            receiverType: ParticipantType.MERCHANT,
            transactionRefId: randomUUID(),
          },
        }),
      ]);

      this.logger.log(
        `[STEP 10] REDEEM transaction created. TxId: ${redeemTransaction.id}`,
      );

      this.logger.log(
        `[SUCCESS] Voucher code redeemed successfully for customer: ${customerId}`,
      );

      // 11. Format transaction response same as /customer/phone/:phone endpoint
      const transactionResponse = {
        id: redeemTransaction.id,
        txHash: blockchainTx.hash,
        senderAddress: customerAddress,
        receiverAddress: merchantAddress,
        transactionTypeId: redeemTransaction.transactionTypeId,
        amount: redeemTransaction.amount,
        transactionDirection: 'SENT' as 'SENT' | 'RECEIVED',
        merchantId: voucher.merchantId,
        merchantName: voucher.merchant?.name || voucher.merchantName,
        point: voucherCode.pointId
          ? {
              id: voucherCode.pointId,
              name: voucherCode.currency || 'POINT',
              symbol: voucherCode.currency || 'POINT',
            }
          : null,
        sender: {
          id: customerId,
          walletAddress: customerAddress,
          emailOrWebsite: customer.email,
        },
        receiver: {
          id: voucher.merchantId,
          walletAddress: merchantAddress,
          emailOrWebsite: merchant?.wallet?.email || '',
        },
        voucherCodeId: voucherCode.id,
        valueType: voucher.valueType,
        value: voucher.value,
        eventId: null,
        createdAt: redeemTransaction.createdAt,
      };

      // 7. Return response
      return {
        success: true,
        message: 'Voucher redeemed successfully',
        voucher: {
          id: voucher.id,
          name: voucher.name,
          description: voucher.description,
          imageUrl: voucher.imageUrl || null,
          valueType: voucher.valueType,
          value: voucher.value,
          merchantName: voucher.merchant?.name || voucher.merchantName,
          startDate: voucher.startDate,
          endDate: voucher.endDate,
        },
        redemption: {
          code: updatedCode.code,
          redeemedBy: updatedCode.usedBy,
          redeemedAt: updatedCode.usedAt,
          pointsCost: updatedCode.pointsCost,
        },
        transaction: transactionResponse,
        blockchain: blockchainTx
          ? {
              transactionHash: blockchainTx.hash,
              blockNumber: blockchainTx.blockNumber,
            }
          : null,
        vaultRelease: vaultReleaseTx
          ? {
              transactionHash: vaultReleaseTx.hash,
              blockNumber: vaultReleaseTx.blockNumber,
            }
          : null,
      };
    } catch (error) {
      this.logger.error(
        `[FATAL ERROR] Failed to redeem voucher: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * ตรวจสอบสถานะของ code ก่อน redeem
   */
  async validateCode(code: string) {
    try {
      this.logger.log(`[VALIDATE] Checking voucher code: ${code}`);

      const voucherCode = await this.prisma.voucherCode.findUnique({
        where: { code },
        include: {
          voucher: {
            include: {
              merchant: true,
            },
          },
        },
      });

      if (!voucherCode) {
        return {
          valid: false,
          reason: 'Code not found',
        };
      }

      if (voucherCode.isUsed) {
        return {
          valid: false,
          reason: 'Code already redeemed',
          usedBy: voucherCode.usedBy,
          usedAt: voucherCode.usedAt,
        };
      }

      const now = new Date();
      const voucher = voucherCode.voucher;

      if (voucher.endDate && new Date(voucher.endDate) < now) {
        return {
          valid: false,
          reason: 'Voucher expired',
          endDate: voucher.endDate,
        };
      }

      if (voucher.startDate && new Date(voucher.startDate) > now) {
        return {
          valid: false,
          reason: 'Voucher not yet valid',
          startDate: voucher.startDate,
        };
      }

      return {
        valid: true,
        voucher: {
          id: voucher.id,
          name: voucher.name,
          description: voucher.description,
          valueType: voucher.valueType,
          value: voucher.value,
          merchantName: voucher.merchant?.name || voucher.merchantName,
          startDate: voucher.startDate,
          endDate: voucher.endDate,
        },
        pointsCost: voucherCode.pointsCost,
      };
    } catch (error) {
      this.logger.error(`[ERROR] Failed to validate code: ${error.message}`);
      throw error;
    }
  }

  /**
   * ดึงประวัติการใช้งาน voucher ของลูกค้า
   */
  async getCustomerRedemptionHistory(customerId: string) {
    try {
      this.logger.log(
        `[HISTORY] Getting redemption history for customer: ${customerId}`,
      );

      const redemptions = await this.prisma.voucherCode.findMany({
        where: {
          usedBy: customerId,
          isUsed: true,
        },
        include: {
          voucher: {
            include: {
              merchant: true,
            },
          },
        },
        orderBy: {
          usedAt: 'desc',
        },
      });

      return redemptions.map((code) => ({
        code: code.code,
        redeemedAt: code.usedAt,
        pointsCost: code.pointsCost,
        voucher: {
          id: code.voucher.id,
          name: code.voucher.name,
          description: code.voucher.description,
          valueType: code.voucher.valueType,
          value: code.voucher.value,
          merchantName:
            code.voucher.merchant?.name || code.voucher.merchantName,
        },
      }));
    } catch (error) {
      this.logger.error(
        `[ERROR] Failed to get redemption history: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Redeem AIS voucher - similar to execute but transfers points to receiverPhone
   */
  async executeAIS(
    code: string,
    phone: string,
    merchantRef: string,
    receiverPhone: string,
  ) {
    try {
      this.logger.log(
        `[START AIS] Redeeming AIS voucher code: ${code} for customer phone: ${phone}, receiver: ${receiverPhone} at merchant: ${merchantRef}`,
      );

      // 0. Find redeemer customer by phone
      this.logger.log(`[STEP 0] Finding redeemer customer by phone: ${phone}`);
      const customer = await this.prisma.customer.findFirst({
        where: { tel: phone },
        include: { wallet: true },
      });

      if (!customer) {
        this.logger.error(`[ERROR] Customer with phone ${phone} not found`);
        throw new NotFoundException(`Customer with phone ${phone} not found`);
      }

      // 0b. Find receiver customer by receiverPhone
      this.logger.log(
        `[STEP 0b] Finding receiver customer by phone: ${receiverPhone}`,
      );
      const receiverCustomer = await this.prisma.customer.findFirst({
        where: { tel: receiverPhone },
        include: { wallet: true },
      });

      if (!receiverCustomer) {
        this.logger.error(
          `[ERROR] Receiver customer with phone ${receiverPhone} not found`,
        );
        throw new NotFoundException(
          `Receiver customer with phone ${receiverPhone} not found`,
        );
      }

      const customerId = customer.id;
      const receiverCustomerId = receiverCustomer.id;

      this.logger.log(
        `[STEP 0] Redeemer: ${customerId}, Receiver: ${receiverCustomerId}`,
      );

      // 1. First validate that this is an AIS voucher
      this.logger.log(`[STEP 1] Validating voucher type`);
      const voucherCode = await this.prisma.voucherCode.findUnique({
        where: { code },
        select: {
          voucher: {
            select: {
              valueType: true,
              value: true,
            },
          },
        },
      });

      if (voucherCode?.voucher.valueType !== 'aispoint') {
        throw new BadRequestException(
          'This endpoint is only for AIS Point vouchers. Use /coupon/redeem for other voucher types.',
        );
      }

      this.logger.log(
        `[STEP 1] Voucher type validated: aispoint (value: ${voucherCode.voucher.value})`,
      );

      // Call the normal redeem flow
      const redeemResult = await this.execute(code, phone, merchantRef);

      // Additional: Transfer points to receiver (AIS-specific logic)
      // TODO: Call AIS API to transfer points
      // Amount to transfer = voucher.value (the AIS point amount)
      const transferAmount = voucherCode.voucher.value;

      this.logger.log(
        `[SUCCESS AIS] Voucher redeemed. Points (${transferAmount}) prepared for transfer to ${receiverPhone}`,
      );

      return {
        ...redeemResult,
        pointTransfer: {
          phone: phone,
          receiverPhone: receiverPhone,
          amount: transferAmount,
        },
      };
    } catch (error) {
      this.logger.error(
        `[ERROR AIS] Failed to redeem AIS voucher: ${error.message}`,
      );
      throw error;
    }
  }
}
