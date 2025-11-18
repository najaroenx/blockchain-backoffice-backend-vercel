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

  async execute(
    voucherGroupId: string,
    pointId: string,
    address: string,
    phone: string,
  ) {
    try {
      this.logger.log(
        `[START] Buying coupon from marketplace. GroupId: ${voucherGroupId}, PointId: ${pointId}, Buyer phone: ${phone}`,
      );

      // Find customer by phone (tel field)
      const customer = await this.prisma.customer.findFirst({
        where: { tel: phone },
      });

      if (!customer) {
        this.logger.error(`[ERROR] Customer with phone ${phone} not found`);
        throw new NotFoundException(`Customer with phone ${phone} not found`);
      }

      const customerId = customer.id;
      this.logger.log(`[START] Customer found: ${customerId}`);

      // 1. หา available voucher code จาก group และ validate point
      this.logger.log(
        `[STEP 1] Finding available voucher code in group: ${voucherGroupId} with pointId: ${pointId}`,
      );
      const voucherCode = await this.prisma.voucherCode.findFirst({
        where: {
          voucherGroupId,
          pointId, // ต้อง match กับ point ที่เลือกจ่าย
          isUsed: false,
          currentOwnerId: null,
        },
        select: {
          id: true,
          code: true,
          voucherId: true,
          voucherGroupId: true,
          pointsCost: true,
          pointId: true,
          currency: true,
          isUsed: true,
          currentOwnerId: true,
          point: {
            select: {
              id: true,
              name: true,
              symbol: true,
              contractAddress: true,
              imageUrl: true,
            },
          },
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
        this.logger.error(
          `[ERROR] No available voucher in group: ${voucherGroupId} for pointId: ${pointId}`,
        );
        throw new NotFoundException(
          `No available voucher in group ${voucherGroupId} that accepts point ${pointId}`,
        );
      }

      const voucherCodeId = voucherCode.id;
      this.logger.log(
        `[STEP 1] Found available code: ${voucherCodeId} in group ${voucherGroupId} for point ${pointId}`,
      );

      // 2. Backward Compatibility: ตรวจสอบ pointId
      this.logger.log(`[STEP 2] Checking pointId setup`);
      if (!voucherCode.pointId) {
        this.logger.error(
          `[ERROR] VoucherCode ${voucherCodeId} has no pointId configured`,
        );
        throw new BadRequestException(
          'This voucher requires point currency setup. Please contact admin.',
        );
      }

      this.logger.log(
        `[STEP 2] Point currency validated: ${voucherCode.currency} (pointId: ${voucherCode.pointId})`,
      );

      // 3. ตรวจสอบว่า code ยังไม่ถูกใช้
      this.logger.log(`[STEP 3] Checking if code is available`);
      if (voucherCode.isUsed) {
        this.logger.error(`[ERROR] Code already used`);
        throw new BadRequestException(
          `This voucher code has already been used`,
        );
      }

      // 4. ตรวจสอบว่า code ถูก activate แล้ว (มี voucherGroupId)
      if (!voucherCode.voucherGroupId) {
        this.logger.error(`[ERROR] Code not yet activated`);
        throw new BadRequestException(
          `This voucher code has not been activated yet`,
        );
      }

      // 5. ตรวจสอบว่า voucher ยังไม่หมดอายุ
      this.logger.log(`[STEP 5] Checking voucher validity`);
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

      // 6. Point Balance Validation
      this.logger.log(
        `[STEP 6] Checking customer point balance for ${voucherCode.currency}`,
      );
      const customerPoint = await this.prisma.customerPoint.findFirst({
        where: {
          customerId,
          pointId: voucherCode.pointId,
        },
      });

      if (!customerPoint) {
        this.logger.error(
          `[ERROR] Customer ${customerId} has no ${voucherCode.currency} points`,
        );
        throw new BadRequestException(
          `You don't have any ${voucherCode.currency} points. Please earn points first.`,
        );
      }

      if (customerPoint.balances < voucherCode.pointsCost) {
        this.logger.error(
          `[ERROR] Insufficient balance. Required: ${voucherCode.pointsCost}, Available: ${customerPoint.balances}`,
        );
        throw new BadRequestException(
          `Insufficient ${voucherCode.currency} balance. Required: ${voucherCode.pointsCost}, Available: ${customerPoint.balances}`,
        );
      }

      this.logger.log(
        `[STEP 6] Balance check passed. Available: ${customerPoint.balances} ${voucherCode.currency}`,
      );

      // 7. เรียก Smart Contract เพื่อซื้อ voucher จาก marketplace
      let blockchainTx = null;
      this.logger.log(
        `[STEP 7] Calling smart contract to buy voucher from marketplace`,
      );

      try {
        // ใช้ tokenId จาก voucher (ERC-1155) หรือ fallback ไปใช้ voucherId
        const tokenId = voucher.tokenId || voucher.id;

        this.logger.log(
          `[STEP 7] Using tokenId: ${tokenId} for voucher ${voucher.id}`,
        );

        blockchainTx = await this.blockchainService.buyVoucherFromMarketplace(
          tokenId,
          address,
          voucherCode.pointsCost,
          1, // ซื้อ 1 unit ของ ERC-1155
        );

        this.logger.log(
          `[STEP 7] Marketplace purchase successful. Tx: ${blockchainTx.hash}, TokenId: ${blockchainTx.tokenId}`,
        );
      } catch (error) {
        this.logger.error(
          `[ERROR] Marketplace purchase failed: ${error.message}`,
        );
        throw new BadRequestException(
          `Failed to buy voucher from marketplace: ${error.message}`,
        );
      }

      // 8. Transfer ownership - อัพเดท database
      this.logger.log(`[STEP 8] Updating database - transferring ownership`);

      // บันทึก transaction ในระบบ (marketplace purchase)
      // Update ownership, deduct balance, และสร้าง transaction record
      const [, , transaction] = await this.prisma.$transaction([
        // Update current owner
        this.prisma.voucherCode.update({
          where: { id: voucherCodeId },
          data: { currentOwnerId: customerId },
        }),

        // Deduct customer point balance
        this.prisma.customerPoint.update({
          where: { id: customerPoint.id },
          data: {
            balances: {
              decrement: voucherCode.pointsCost,
            },
          },
        }),

        // Create transaction record (payment + ownership transfer)
        this.prisma.transaction.create({
          data: {
            txHash: Buffer.from(blockchainTx.hash.slice(2), 'hex'),
            senderAddress: Buffer.from(address.slice(2), 'hex'),
            receiverAddress: Buffer.from(address.slice(2), 'hex'),
            amount: voucherCode.pointsCost,
            pointId: voucherCode.pointId,
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
