import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { CreateCustomerDto } from '../dtos';
import { GetCustomersByMerchantId } from '../handlers/getCustomersByMerchantId.handler';
import { GetCustomerById } from '../handlers/getCustomerById.handler';
import { GetCustomerPhone } from '../handlers/getCustomerByPhone.handler';
import { CreateCustomer } from '../handlers/createCustomer.handler';
import { PageOptionsDto } from 'src/common/dtos';
import { Public } from 'src/modules/auth/public.decorator';

@Controller('/:merchantId/customer')
export class CustomerController {
  constructor(
    private readonly getCustomersByMerchantIdHandler: GetCustomersByMerchantId,
    private readonly getCustomerDetialByIdHandler: GetCustomerById,
    private readonly createCustomerHandler: CreateCustomer,
    private readonly GetCustomerByPhone: GetCustomerPhone,
  ) {}

  @Public()
  @Post('/')
  @HttpCode(201)
  async createCustomer(
    @Param('merchantId') merchantId: string,
    @Body() body: CreateCustomerDto,
  ) {
    return this.createCustomerHandler.execute(merchantId, body);
  }

  @Get('/')
  @HttpCode(200)
  async getCustomersByMerchant(
    @Param('merchantId') merchantId: string,
    @Query() pageOptionsDto: PageOptionsDto,
  ) {
    return this.getCustomersByMerchantIdHandler.execute(
      merchantId,
      pageOptionsDto,
    );
  }

  @Get('/:customerId')
  @HttpCode(200)
  async getCustomerById(
    @Param('customerId') customerId: string,
    @Param('merchantId') merchantId: string,
  ) {
    return this.getCustomerDetialByIdHandler.execute(merchantId, customerId);
  }

  @Get('/byphone/:phone')
  @HttpCode(200)
  async getCustomerByPhone(
    @Param('phone') phone: string,
    @Param('merchantId') merchantId: string,
  ) {
    console.log(
      `Getting customer by phone for merchant ${merchantId} and phone ${phone}`,
    );
    return this.GetCustomerByPhone.execute(merchantId, phone);
  }

  @Get('/wallet/:phone')
  @HttpCode(200)
  async getWallet(
    @Param('merchantId') merchantId: string,
    @Param('phone') phone: string,
  ) {
    return this.GetCustomerByPhone.execute(merchantId, phone);
  }
}

@Controller('/customer')
export class CustomerPhoneController {
  constructor(private readonly getCustomerByPhone: GetCustomerPhone) {}

  @Public()
  @Get('/:phone')
  @HttpCode(200)
  async getCustomerByPhoneDetailed(@Param('phone') phone: string) {
    return this.getCustomerByPhone.executeDetailed(phone);
  }
}
