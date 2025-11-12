import { Module } from '@nestjs/common';
import { VoucherRepository } from './voucher.repository';
import { VoucherDBService } from './services/voucher-db.service';
import { VoucherController } from './controllers/voucher.controller';
import { PrismaModule } from '../../../prisma/prisma.module';
import { CreateVoucherWithCodes } from './handlers/createVoucherWithCodes.handler';
import { ActivateVoucher } from './handlers/activateVoucher.handler';
import { ManageCouponHandler } from './handlers/manageCoupon.handler';

@Module({
  imports: [PrismaModule],
  controllers: [VoucherController],
  providers: [
    VoucherDBService,
    VoucherRepository,
    CreateVoucherWithCodes,
    ActivateVoucher,
    ManageCouponHandler,
  ],
  exports: [VoucherDBService],
})
export class VoucherModule {}
