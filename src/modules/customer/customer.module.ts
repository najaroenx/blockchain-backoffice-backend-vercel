import { Module } from '@nestjs/common';
import {
  CustomerController,
  CustomerPhoneController,
} from './controllers/customer.controller';
import { CustomerRepository } from './customer.repository';
import { TokenModule } from 'src/providers/token/token.module';
import { CustomerDBService } from './services/customer-db.service';
import { GetCustomersByMerchantId } from './handlers/getCustomersByMerchantId.handler';
import { GetCustomerById } from './handlers/getCustomerById.handler';
// import { GetCustomerByEmail } from './handlers/getCustomerByEmail.handler';
import { UpdateCustomer } from './handlers/updateCustomer.handler';
import { CreateCustomer } from './handlers/createCustomer.handler';
import { BlockchainModule } from 'src/providers/blockchain/blockchain.module';
import { GetCustomerPhone } from './handlers/getCustomerByPhone.handler';
import { PrismaModule } from 'prisma/prisma.module';
import { TempLinkModule } from '../templink/templink.module';
import { GetCustomerListDev } from './handlers/getCustomerListDev.handler';
import { OTPService } from 'src/providers/otp/otp.service';
import { GetCustomerPhoneDevForResp } from './handlers/getCustomerPhoneDevForResp.handler';
@Module({
  imports: [TokenModule, BlockchainModule, PrismaModule, TempLinkModule],
  controllers: [CustomerController, CustomerPhoneController],
  providers: [
    CustomerRepository,
    CustomerDBService,
    GetCustomersByMerchantId,
    GetCustomerById,
    // GetCustomerByEmail,
    UpdateCustomer,
    CreateCustomer,
    GetCustomerPhone,
    GetCustomerListDev,
    OTPService,
    GetCustomerPhoneDevForResp,
  ],
  exports: [/* GetCustomerByEmail, */ GetCustomerPhone, UpdateCustomer],
})
export class CustomerModule {}
