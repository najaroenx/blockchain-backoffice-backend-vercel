import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';
import { TransactionTypeId } from 'src/constants/transaction-types.enum';

@Injectable()
export class BuyCouponFromMarketplace {
  private logger = new Logger(BuyCouponFromMarketplace.name);

  constructor(
    private prisma: PrismaService,
    private blockchainService: BlockchainService,
  ) {}

  async execute(voucherCodeId: string, address: string, customerId: string) {
    try {
      this.logger.log(
        `[START] Buying coupon from marketplace. CodeId: ${voucherCodeId}, Buyer: ${customerId}`,
      );

      // 1. ตรวจสอบว่า voucher code มีอยู่จริง
      this.logger.log(`[STEP 1] Finding voucher code: ${voucherCodeId}`);
      const voucherCode = await this.prisma.voucherCode.findUnique({
        where: { id: voucherCodeId },
        select: {
          id: true,
          code: true,
          voucherId: true,
          voucherGroupId: true,
          pointsCost: true,
          isUsed: true,
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
              merchantId: true,
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
        this.logger.error(`[ERROR] Voucher code not found: ${voucherCodeId}`);
        throw new NotFoundException(
          `Voucher code with ID ${voucherCodeId} not found`,
        );
      }

      // 2. ตรวจสอบว่า code ยังไม่ถูกใช้
      this.logger.log(`[STEP 2] Checking if code is available`);
      if (voucherCode.isUsed) {
        this.logger.error(`[ERROR] Code already used`);
        throw new BadRequestException(
          `This voucher code has already been used`,
        );
      }

      // 3. ตรวจสอบว่า code ถูก activate แล้ว (มี voucherGroupId)
      if (!voucherCode.voucherGroupId) {
        this.logger.error(`[ERROR] Code not yet activated`);
        throw new BadRequestException(
          `This voucher code has not been activated yet`,
        );
      }

      // 4. ตรวจสอบว่า voucher ยังไม่หมดอายุ
      this.logger.log(`[STEP 3] Checking voucher validity`);
      const now = new Date();
      const voucher = voucherCode.voucher;

      if (voucher.endDate && new Date(voucher.endDate) < now) {
        this.logger.error(`[ERROR] Voucher expired`);
        throw new BadRequestException(
          `Voucher has expired on ${voucher.endDate}`,
        );
      }

      if (voucher.startDate && new Date(voucher.startDate) > now) {
        this.logger.error(`[ERROR] Voucher not yet valid`);
        throw new BadRequestException(
          `Voucher is not yet valid. Available from ${voucher.startDate}`,
        );
      }

      // 5. เรียก Smart Contract เพื่อซื้อ voucher จาก marketplace
      let blockchainTx = null;
      this.logger.log(
        `[STEP 4] Calling smart contract to buy voucher from marketplace`,
      );

      try {
        // ใช้ tokenId จาก voucher (ERC-1155) หรือ fallback ไปใช้ voucherId
        const tokenId = voucher.tokenId || voucher.id;

        this.logger.log(
          `[STEP 4] Using tokenId: ${tokenId} for voucher ${voucher.id}`,
        );

        blockchainTx = await this.blockchainService.buyVoucherFromMarketplace(
          tokenId,
          address,
          voucherCode.pointsCost,
          1, // ซื้อ 1 unit ของ ERC-1155
        );

        this.logger.log(
          `[STEP 4] Marketplace purchase successful. Tx: ${blockchainTx.hash}, TokenId: ${blockchainTx.tokenId}`,
        );
      } catch (error) {
        this.logger.error(
          `[ERROR] Marketplace purchase failed: ${error.message}`,
        );
        throw new BadRequestException(
          `Failed to buy voucher from marketplace: ${error.message}`,
        );
      }

      // 6. Transfer ownership - อัพเดท database
      this.logger.log(`[STEP 5] Updating database - transferring ownership`);

      // บันทึก transaction ในระบบ (marketplace purchase)
      const customer = await this.prisma.customer.findUnique({
        where: { id: customerId },
      });

      if (!customer) {
        throw new NotFoundException(`Customer with ID ${customerId} not found`);
      }

      // Update ownership และสร้าง transaction record
      const [, transaction] = await this.prisma.$transaction([
        // Update current owner
        this.prisma.voucherCode.update({
          where: { id: voucherCodeId },
          data: { currentOwnerId: customerId },
        }),

        // Create transaction record (payment + ownership transfer)
        this.prisma.transaction.create({
          data: {
            txHash: Buffer.from(blockchainTx.hash.slice(2), 'hex'),
            senderAddress: Buffer.from(address.slice(2), 'hex'),
            receiverAddress: Buffer.from(address.slice(2), 'hex'),
            amount: voucherCode.pointsCost,
            senderId: customerId,
            receiverId: customerId,
            voucherCodeId: voucherCodeId,
            transactionTypeId: TransactionTypeId.MARKETPLACE_PURCHASE,
          },
        }),
      ]);

      this.logger.log(
        `[SUCCESS] Coupon purchased successfully from marketplace. Transaction ID: ${transaction.id}`,
      );

      // 7. Return response
      return {
        success: true,
        message: 'Voucher purchased successfully from marketplace',
        purchase: {
          voucherCodeId: voucherCode.id,
          code: voucherCode.code,
          address,
          customerId,
          purchasePrice: voucherCode.pointsCost,
          transactionId: transaction.id,
          purchasedAt: transaction.createdAt,
        },
        voucher: {
          id: voucher.id,
          name: voucher.name,
          description: voucher.description,
          valueType: voucher.valueType,
          value: voucher.value,
          merchantName: voucher.merchant?.name || '',
          startDate: voucher.startDate,
          endDate: voucher.endDate,
        },
        blockchain: {
          transactionHash: blockchainTx.hash,
          blockNumber: blockchainTx.blockNumber,
        },
      };
    } catch (error) {
      this.logger.error(
        `[FATAL ERROR] Failed to buy coupon from marketplace: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
