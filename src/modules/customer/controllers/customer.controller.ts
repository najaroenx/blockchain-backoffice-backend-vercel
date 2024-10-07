import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { CreateCustomerDto } from '../dtos';
import { GetCustomersByMerchantId } from '../handlers/getCustomersByMerchantId.handler';
import { GetCustomerById } from '../handlers/getCustomerById.handler';
import { CreateCustomer } from '../handlers/createCustomer.handler';

@Controller('/:merchantId/customer')
export class CustomerController {
  constructor(
    private readonly getCustomersByMerchantIdHandler: GetCustomersByMerchantId,
    private readonly getCustomerDetialByIdHandler: GetCustomerById,
    private readonly createCustomerHandler: CreateCustomer,
  ) {}

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
  async getCustomersByMerchant(@Param('merchantId') merchantId: string) {
    return this.getCustomersByMerchantIdHandler.execute(merchantId);
  }

  @Get('/:customerId')
  @HttpCode(200)
  async getCustomerById(
    @Param('customerId') customerId: string,
    @Param('merchantId') merchantId: string,
  ) {
    return this.getCustomerDetialByIdHandler.execute(merchantId, customerId);
  }
}
