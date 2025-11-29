import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';

@Injectable()
export class GetCustomerOnChainBalances {
  private logger = new Logger(GetCustomerOnChainBalances.name);

  constructor(
    private prisma: PrismaService,
    private blockchainService: BlockchainService,
  ) {}

  async execute(phone: string) {
    try {
      this.logger.log(
        `[START] Getting on-chain coupon balances for phone: ${phone}`,
      );

      // 1) Find wallet by phone and type customer
      const wallet = await this.prisma.wallet.findFirst({
        where: { phoneNumber: phone, type: 'customer' },
      });

      if (!wallet) {
        this.logger.warn(
          `[WARN] No customer wallet found for phone ${phone}. Returning empty balances.`,
        );
        return {
          phone,
          walletAddress: null,
          balances: [],
        };
      }

      const walletAddress = wallet.walletAddress;

      // 2) Get distinct tokenIds from vouchers
      const vouchers = await this.prisma.voucher.findMany({
        where: { tokenId: { not: null } },
        select: { tokenId: true, name: true },
      });

      const uniqueTokenIds = Array.from(
        new Map(
          vouchers
            .filter((v) => v.tokenId)
            .map((v) => [v.tokenId as string, v.name || '']),
        ),
      );

      // 3) Fetch on-chain balances per tokenId
      const balances = [];

      for (const [tokenId, name] of uniqueTokenIds) {
        try {
          const result = await this.blockchainService.getUserCouponBalance(
            walletAddress,
            Number(tokenId),
          );
          balances.push({
            tokenId,
            voucherName: name,
            balance: result.balance,
          });
        } catch (err) {
          this.logger.warn(
            `[WARN] Failed to fetch balance for tokenId ${tokenId}: ${err.message}`,
          );
          balances.push({
            tokenId,
            voucherName: name,
            balance: null,
            error: err.message,
          });
        }
      }

      this.logger.log(
        `[SUCCESS] Retrieved on-chain balances for wallet ${walletAddress}`,
      );

      return {
        phone,
        walletAddress,
        balances,
      };
    } catch (error) {
      this.logger.error(
        `[ERROR] Failed to get on-chain balances: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
