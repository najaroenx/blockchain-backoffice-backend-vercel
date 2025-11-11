import { Module } from '@nestjs/common';
import { VoucherRepository } from './voucher.repository';
import { VoucherDBService } from './services/voucher-db.service';
import { VoucherController } from './controllers/voucher.controller';
import { PrismaModule } from '../../../prisma/prisma.module';
import { CreateVoucherWithCodes } from './handlers/createVoucherWithCodes.handler';

@Module({
  imports: [PrismaModule],
  controllers: [VoucherController],
  providers: [VoucherDBService, VoucherRepository, CreateVoucherWithCodes],
  exports: [VoucherDBService],
})
export class VoucherModule {}
