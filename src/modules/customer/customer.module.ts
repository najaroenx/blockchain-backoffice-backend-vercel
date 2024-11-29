import { Module } from '@nestjs/common';
import { CustomerController } from './controllers/customer.controller';
import { CustomerRepository } from './customer.repository';
import { TokenModule } from 'src/providers/token/token.module';
import { CustomerDBService } from './services/customer-db.service';
import { GetCustomersByMerchantId } from './handlers/getCustomersByMerchantId.handler';
import { GetCustomerById } from './handlers/getCustomerById.handler';
import { GetCustomerByEmail } from './handlers/getCustomerByEmail.handler';
import { UpdateCustomer } from './handlers/updateCustomer.handler';
import { CreateCustomer } from './handlers/createCustomer.handler';
import { BlockchainModule } from 'src/providers/blockchain/blockchain.module';

@Module({
  imports: [TokenModule, BlockchainModule],
  controllers: [CustomerController],
  providers: [
    CustomerRepository,
    CustomerDBService,
    GetCustomersByMerchantId,
    GetCustomerById,
    GetCustomerByEmail,
    UpdateCustomer,
    CreateCustomer,
  ],
  exports: [GetCustomerByEmail, UpdateCustomer],
})
export class CustomerModule {}
