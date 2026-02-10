import { Module } from '@nestjs/common';
import { DashboardController } from './controllers/dashboard.controller';
import { MerchantRefStoreController } from './controllers/merchant-ref-store.controller';
import { DashboardService } from './handlers/dashboard.handler';
import { GetMarketerDashboardHandler } from './handlers/get-marketer-dashboard.handler';
import { GetSellerDashboardHandler } from './handlers/get-seller-dashboard.handler';
import { GetMerchantRefDashboardHandler } from './handlers/get-merchantref-dashboard.handler';
import {
  ListMerchantRefStoreHandler,
  GetMerchantRefStoreByIdHandler,
  GetMerchantRefStoreByRefHandler,
} from './handlers/merchant-ref-store/list-merchant-ref-store.handler';
import { CreateMerchantRefStoreHandler } from './handlers/merchant-ref-store/create-merchant-ref-store.handler';
import { UpdateMerchantRefStoreHandler } from './handlers/merchant-ref-store/update-merchant-ref-store.handler';
import { DeleteMerchantRefStoreHandler } from './handlers/merchant-ref-store/delete-merchant-ref-store.handler';
import { PrismaModule } from 'prisma/prisma.module';
import { TransactionModule } from '../transaction/transaction.module';
import { BlockchainModule } from 'src/providers/blockchain/blockchain.module';

// TODO: Add CacheModule.register({ ttl: 300000 }) when @nestjs/cache-manager is installed

@Module({
  controllers: [DashboardController, MerchantRefStoreController],
  providers: [
    DashboardService,
    GetMarketerDashboardHandler,
    GetSellerDashboardHandler,
    GetMerchantRefDashboardHandler,
    // MerchantRefStore CRUD handlers
    ListMerchantRefStoreHandler,
    GetMerchantRefStoreByIdHandler,
    GetMerchantRefStoreByRefHandler,
    CreateMerchantRefStoreHandler,
    UpdateMerchantRefStoreHandler,
    DeleteMerchantRefStoreHandler,
  ],
  imports: [PrismaModule, TransactionModule, BlockchainModule],
  exports: [GetMerchantRefDashboardHandler],
})
export class DashboardModule {}
