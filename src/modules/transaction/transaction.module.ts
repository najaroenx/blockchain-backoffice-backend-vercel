import { Module } from '@nestjs/common';
import { TransactionController } from './controllers/transaction.controller';
import { TreasuryController } from './controllers/treasury.controller';
import { GlobalTransactionController } from './controllers/global-transaction.controller';
import { TransactionRepository } from './transaction.repository';
import { PointModule } from 'src/modules/point/point.module';
import { BlockchainModule } from 'src/providers/blockchain/blockchain.module';
import { CustomerModule } from 'src/modules/customer/customer.module';
import { MerchantModule } from 'src/modules/merchant/merchant.module';
import { TransactionDBService } from './services/transaction-db.service';
import { GetTransactionsByCustomerId } from './handlers/getTransactionsByCustomerId.handler';
import { GetTransactionsByMerchantId } from './handlers/getTransactionsByMerchantId.handler';
import { CreateTransactionB2C } from './handlers/createTransactionB2C.handler';
import { CreateTransactionC2C } from './handlers/createTransactionC2C.handler';
import { TokenModule } from 'src/providers/token/token.module';
import { MintTransaction } from './handlers/mintTransaction.handler';
import { BurnTransaction } from './handlers/burnTransaction.handler';
import { GetWalletBalance } from './handlers/getMerchantBalance.handler';
import { GetTreasuryBalance } from './handlers/getTreasuryBalance.handler';
import { ListTreasuries } from './handlers/listTreasuries.handler';
import { GetAllTransactionsByCustomerPhone } from './handlers/getAllTransactionsByCustomerPhone.handler';
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
    CreateTransactionB2C,
    CreateTransactionC2C,
    MintTransaction,
    BurnTransaction,
    GetWalletBalance,
    GetTreasuryBalance,
    ListTreasuries,
  ],
  exports: [GetTransactionsByMerchantId],
  controllers: [
    TransactionController,
    TreasuryController,
    GlobalTransactionController,
  ],
})
export class TransactionModule {}
