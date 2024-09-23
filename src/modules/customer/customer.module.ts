import { Module } from '@nestjs/common';
import { CustomerController } from './customer.controller';
import { CustomerService } from './customer.service';
import { CustomerRepository } from './customer.repository';
import { TokenModule } from 'src/providers/token/token.module';
import { BlockchainModule } from 'src/providers/blockchain/blockchain.module';

@Module({
  imports: [TokenModule, BlockchainModule],
  controllers: [CustomerController],
  providers: [CustomerService, CustomerRepository],
})
export class CustomerModule {}
