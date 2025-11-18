import { Module } from '@nestjs/common';
import { TransactionController } from './controllers/transaction.controller';
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

@Module({
  imports: [
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
    CreateTransactionB2C,
    CreateTransactionC2C,
    MintTransaction,
    BurnTransaction,
    GetWalletBalance,
  ],
  exports: [GetTransactionsByMerchantId],
  controllers: [TransactionController],
})
export class TransactionModule {}
