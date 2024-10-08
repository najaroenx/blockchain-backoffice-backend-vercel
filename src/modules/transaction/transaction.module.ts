import { Module } from '@nestjs/common';
import { TransactionController } from './controllers/transaction.controller';
import { TransactionRepository } from './transaction.repository';
import { PointModule } from 'src/modules/point/point.module';
import { BlockchainModule } from 'src/providers/blockchain/blockchain.module';
import { CustomerModule } from 'src/modules/customer/customer.module';
import { TransactionDBService } from './services/transaction-db.service';
import { GetTransactionsByCustomerId } from './handlers/getTransactionsByCustomerId.handler';
import { GetTransactionsByMerchantId } from './handlers/getTransactionsByMerchantId.handler';
import { CreateTransactionB2C } from './handlers/createTransactionB2C.handler';
import { CreateTransactionC2C } from './handlers/createTransactionC2C.handler';
import { TokenModule } from 'src/providers/token/token.module';

@Module({
  imports: [PointModule, BlockchainModule, CustomerModule, TokenModule],
  providers: [
    TransactionRepository,
    TransactionDBService,
    GetTransactionsByCustomerId,
    GetTransactionsByMerchantId,
    CreateTransactionB2C,
    CreateTransactionC2C,
  ],
  controllers: [TransactionController],
})
export class TransactionModule {}
