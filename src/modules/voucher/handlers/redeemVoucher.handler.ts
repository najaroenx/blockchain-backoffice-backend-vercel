import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';

@Injectable()
export class RedeemVoucher {
  private logger = new Logger(RedeemVoucher.name);

  constructor(
    private prisma: PrismaService,
    private blockchainService: BlockchainService,
  ) {}

  async execute(code: string, customerId: string) {
    try {
      this.logger.log(
        `[START] Redeeming voucher code: ${code} for customer: ${customerId}`,
      );

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

      // 4. ตรวจสอบว่า code ถูก activate แล้วหรือยัง (มี voucherGroupId)
      if (!voucherCode.voucherGroupId) {
        this.logger.error(`[ERROR] Code not yet activated (no voucherGroupId)`);
        throw new BadRequestException(
          `Voucher code has not been activated yet`,
        );
      }

      // 5. ตรวจสอบ ownership (ถ้ามี currentOwnerId)
      if (voucherCode.currentOwnerId) {
        this.logger.log(`[STEP 4.5] Verifying ownership`);
        if (voucherCode.currentOwnerId !== customerId) {
          this.logger.error(
            `[ERROR] Customer ${customerId} does not own this voucher. Owner: ${voucherCode.currentOwnerId}`,
          );
          throw new BadRequestException(
            `You do not own this voucher. It belongs to another customer.`,
          );
        }
        this.logger.log(`[STEP 4.5] Ownership verified ✓`);
      }

      // 5. เรียก Smart Contract เพื่อ redeem voucher NFT (Burn ERC-1155)
      let blockchainTx = null;
      this.logger.log(
        `[STEP 5] Calling smart contract to redeem voucher code: ${code}`,
      );

      try {
        // Get customer wallet address
        const customer = await this.prisma.customer.findUnique({
          where: { id: customerId },
        });

        if (!customer) {
          throw new Error('Customer not found');
        }

        const customerAddress =
          '0x' + Buffer.from(customer.walletAddress).toString('hex');

        // ใช้ tokenId จาก voucher (ERC-1155) หรือ fallback ไปใช้ voucherId
        const tokenId = voucher.tokenId || voucher.id;

        this.logger.log(
          `[STEP 5] Redeeming tokenId: ${tokenId} for customer: ${customerAddress}`,
        );

        blockchainTx = await this.blockchainService.redeemVoucher(
          tokenId,
          customerAddress,
        );

        this.logger.log(
          `[STEP 5] Smart contract redeem successful. Tx: ${blockchainTx.hash}`,
        );
      } catch (error) {
        this.logger.error(
          `[ERROR] Smart contract redeem failed: ${error.message}`,
        );
        throw new BadRequestException(
          `Failed to redeem voucher on blockchain: ${error.message}`,
        );
      }

      // 6. อัพเดท database - mark code เป็น used
      this.logger.log(`[STEP 6] Updating database - marking code as used`);
      const updatedCode = await this.prisma.voucherCode.update({
        where: { id: voucherCode.id },
        data: {
          isUsed: true,
          usedBy: customerId,
          usedAt: new Date(),
        },
        include: {
          voucher: true,
        },
      });

      this.logger.log(
        `[SUCCESS] Voucher code redeemed successfully for customer: ${customerId}`,
      );

      // 7. Return response
      return {
        success: true,
        message: 'Voucher redeemed successfully',
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
        redemption: {
          code: updatedCode.code,
          redeemedBy: updatedCode.usedBy,
          redeemedAt: updatedCode.usedAt,
          pointsCost: updatedCode.pointsCost,
        },
        blockchain: blockchainTx
          ? {
              transactionHash: blockchainTx.hash,
              blockNumber: blockchainTx.blockNumber,
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
}
