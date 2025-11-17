import { Module } from '@nestjs/common';
import { VoucherRepository } from './voucher.repository';
import { VoucherDBService } from './services/voucher-db.service';
import { VoucherController } from './controllers/voucher.controller';
import { PrismaModule } from '../../../prisma/prisma.module';
import { CreateVoucherWithCodes } from './handlers/createVoucherWithCodes.handler';
import { ActivateVoucher } from './handlers/activateVoucher.handler';
import { RedeemVoucher } from './handlers/redeemVoucher.handler';
import { BuyCouponFromMarketplace } from './handlers/buyCouponFromMarketplace.handler';
import { GetCustomerOwnedVouchers } from './handlers/getCustomerOwnedVouchers.handler';
import { ManageCouponHandler } from './handlers/manageCoupon.handler';
import { BlockchainModule } from 'src/providers/blockchain/blockchain.module';

@Module({
  imports: [PrismaModule, BlockchainModule],
  controllers: [VoucherController],
  providers: [
    VoucherDBService,
    VoucherRepository,
    CreateVoucherWithCodes,
    ActivateVoucher,
    RedeemVoucher,
    BuyCouponFromMarketplace,
    GetCustomerOwnedVouchers,
    ManageCouponHandler,
  ],
  exports: [VoucherDBService],
})
export class VoucherModule {}
