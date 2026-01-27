import { Module } from '@nestjs/common';
import { DashboardController } from './controllers/dashboard.controller';
import { DashboardService } from './handlers/dashboard.handler';
import { GetMarketerDashboardHandler } from './handlers/get-marketer-dashboard.handler';
import { GetSellerDashboardHandler } from './handlers/get-seller-dashboard.handler';
import { GetMerchantRefDashboardHandler } from './handlers/get-merchantref-dashboard.handler';
import { PrismaModule } from 'prisma/prisma.module';
import { TransactionModule } from '../transaction/transaction.module';
import { BlockchainModule } from 'src/providers/blockchain/blockchain.module';

// TODO: Add CacheModule.register({ ttl: 300000 }) when @nestjs/cache-manager is installed

@Module({
  controllers: [DashboardController],
  providers: [
    DashboardService,
    GetMarketerDashboardHandler,
    GetSellerDashboardHandler,
    GetMerchantRefDashboardHandler,
  ],
  imports: [PrismaModule, TransactionModule, BlockchainModule],
})
export class DashboardModule {}
