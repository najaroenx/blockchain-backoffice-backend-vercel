import { Module } from '@nestjs/common';
import { TransactionController } from './controllers/transaction.controller';
// GlobalTransactionController moved to ExternalModule
import { TransactionRepository } from './transaction.repository';
import { PointModule } from 'src/modules/internal/point/point.module';
import { BlockchainModule } from 'src/providers/blockchain/blockchain.module';
import { CustomerModule } from 'src/modules/internal/customer/customer.module';
import { MerchantModule } from 'src/modules/internal/merchant/merchant.module';
import { TransactionDBService } from './services/transaction-db.service';
import { GetTransactionsByCustomerId } from './handlers/getTransactionsByCustomerId.handler';
import { GetTransactionsByMerchantId } from './handlers/getTransactionsByMerchantId.handler';
import { CreateTransactionB2C } from './handlers/createTransactionB2C.handler';
import { TokenModule } from 'src/providers/token/token.module';
import { GetWalletBalance } from './handlers/getMerchantBalance.handler';
import { GetAllTransactionsByCustomerPhone } from './handlers/getAllTransactionsByCustomerPhone.handler';
import { GetPointTransactionsByCustomerPhone } from './handlers/getPointTransactionsByCustomerPhone.handler';
import { GetVoucherTransactionsByCustomerPhone } from './handlers/getVoucherTransactionsByCustomerPhone.handler';
import { GetTransactionById } from './handlers/getTransactionById.handler';
import { GetTransactionByMerchantRef } from './handlers/getTransactionByMerchantRef.handler';
import { PrismaModule } from 'prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    PointModule,
    BlockchainModule,
    CustomerModule,
    MerchantModule,
    TokenModule,
  ],
  providers: [
    TransactionRepository,
    TransactionDBService,
    GetTransactionsByCustomerId,
    GetTransactionsByMerchantId,
    GetAllTransactionsByCustomerPhone,
    GetPointTransactionsByCustomerPhone,
    GetVoucherTransactionsByCustomerPhone,
    GetTransactionById,
    GetTransactionByMerchantRef,
    CreateTransactionB2C,
    GetWalletBalance,
  ],
  exports: [
    GetTransactionsByMerchantId,
    GetAllTransactionsByCustomerPhone,
    GetPointTransactionsByCustomerPhone,
    GetVoucherTransactionsByCustomerPhone,
    GetTransactionById,
    GetTransactionByMerchantRef,
  ],
  controllers: [
    TransactionController,
    // GlobalTransactionController moved to ExternalModule
  ],
})
export class TransactionModule {}
