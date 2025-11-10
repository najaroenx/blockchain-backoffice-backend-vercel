import { Module } from '@nestjs/common';
import { VoucherRepository } from './voucher.repository';
import { VoucherDBService } from './services/voucher-db.service';
import { VoucherController } from './controllers/voucher.controller';

@Module({
  controllers: [VoucherController],
  providers: [VoucherDBService, VoucherRepository],
  exports: [VoucherDBService],
})
export class VoucherModule {}
