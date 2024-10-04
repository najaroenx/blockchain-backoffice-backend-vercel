import { Module } from '@nestjs/common';
import { TransactionController } from './controllers/transaction.controller';
import { TransactionRepository } from './transaction.repository';
import { PointModule } from 'src/modules/point/point.module';
import { BlockchainModule } from 'src/providers/blockchain/blockchain.module';
import { CustomerModule } from 'src/modules/customer/customer.module';
import { TransactionDBService } from './services/transaction-db.service';
import { GetTransactionsByCustomerId } from './handlers/getTransactionsByCustomerId.handler';
import { GetTransactionsByMerchantId } from './handlers/getTransactionsByMerchantId.handler';
import { CreateTransaction } from './handlers/createTransaction.handler';

@Module({
  imports: [PointModule, BlockchainModule, CustomerModule],
  providers: [
    TransactionRepository,
    TransactionDBService,
    GetTransactionsByCustomerId,
    GetTransactionsByMerchantId,
    CreateTransaction,
  ],
  controllers: [TransactionController],
})
export class TransactionModule {}
