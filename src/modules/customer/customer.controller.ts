import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import { CustomerService } from './customer.service';
import { CreateCustomerDto } from './dto';

@Controller('/:merchantId/customer')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Post('/')
  @HttpCode(201)
  async createCustomer(
    @Param('merchantId') merchantId: string,
    @Body() body: CreateCustomerDto,
  ) {
    return this.customerService.createCustomer(merchantId, body);
  }
}
