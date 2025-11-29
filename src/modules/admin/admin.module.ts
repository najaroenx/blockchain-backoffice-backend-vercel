import { Module } from '@nestjs/common';
import { AdminController } from './controllers/admin.controller';
import { MintTHBToMerchant } from './handlers/mintTHBToMerchant.handler';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';
import { PrismaService } from 'prisma/prisma.service';

@Module({
  controllers: [AdminController],
  providers: [MintTHBToMerchant, BlockchainService, PrismaService],
})
export class AdminModule {}
