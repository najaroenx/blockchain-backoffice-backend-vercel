import { Module } from '@nestjs/common';
import { AisTransferService } from './ais-transfer.service';
import { ConfigModule } from '@nestjs/config';
import { AdmdModule } from '../admd/admd.module';
import { PrismaModule } from 'prisma/prisma.module';

@Module({
  imports: [ConfigModule, AdmdModule, PrismaModule],
  providers: [AisTransferService],
  exports: [AisTransferService],
})
export class AisTransferModule {}
