import { Module } from '@nestjs/common';
import { CustomerController } from './controllers/customer.controller';
import { CustomerRepository } from './customer.repository';
import { TokenModule } from 'src/providers/token/token.module';
import { CustomerDBService } from './services/customer-db.service';
import { GetCustomersByMerchantId } from './handlers/getCustomersByMerchantId.handler';
import { GetAllCustomersByMerchantWithWallet } from './handlers/getAllCustomersByMerchantWithWallet.handler';
import { GetCustomerById } from './handlers/getCustomerById.handler';
import { UpdateCustomer } from './handlers/updateCustomer.handler';
import { CreateCustomer } from './handlers/createCustomer.handler';
import { BlockchainModule } from 'src/providers/blockchain/blockchain.module';
import { GetCustomerPhone } from './handlers/getCustomerByPhone.handler';
import { PrismaModule } from 'prisma/prisma.module';
import { TempLinkModule } from '../templink/templink.module';
import { GetCustomerListDev } from './handlers/getCustomerListDev.handler';
import { OtpModule } from '../otp/otp.module';
import { GetCustomerPhoneDevForResp } from './handlers/getCustomerPhoneDevForResp.handler';
import { RegisterCustomerDev } from './handlers/registerCustomer.dev.handler';
import { GetCustomerPoints } from './handlers/getCustomerPoints.handler';
import { MerchantModule } from '../merchant/merchant.module';
import { ClearCustomerByPhone } from './handlers/clearCustomerByPhone.handler';
@Module({
  imports: [
    TokenModule,
    BlockchainModule,
    PrismaModule,
    TempLinkModule,
    MerchantModule,
    OtpModule,
  ],
  controllers: [CustomerController],
  providers: [
    CustomerRepository,
    CustomerDBService,
    GetCustomersByMerchantId,
    GetAllCustomersByMerchantWithWallet,
    GetCustomerById,
    // GetCustomerByEmail,
    UpdateCustomer,
    CreateCustomer,
    GetCustomerPhone,
    GetCustomerListDev,
    GetCustomerPhoneDevForResp,
    RegisterCustomerDev,
    GetCustomerPoints,
    ClearCustomerByPhone,
  ],
  exports: [
    // GetCustomerByEmail,
    GetCustomerPhone,
    UpdateCustomer,
    CreateCustomer,
    CustomerDBService,
    GetAllCustomersByMerchantWithWallet,
    // RegisterCustomerDev,
    GetCustomerPoints,
    ClearCustomerByPhone,
    GetCustomerPhoneDevForResp,
  ],
})
export class CustomerModule {}
