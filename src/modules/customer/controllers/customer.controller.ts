import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CreateCustomerDto, UpdateCustomerDto } from '../dtos';
import { GetCustomersByMerchantId } from '../handlers/getCustomersByMerchantId.handler';
import { GetCustomerById } from '../handlers/getCustomerById.handler';
import { GetCustomerPhone } from '../handlers/getCustomerByPhone.handler';
import { CreateCustomer } from '../handlers/createCustomer.handler';
import { GetCustomerListDev } from '../handlers/getCustomerListDev.handler';
import { PageOptionsDto } from 'src/common/dtos';
import { UpdateCustomer } from '../handlers/updateCustomer.handler';
import { Public } from 'src/modules/auth/public.decorator';

@Controller('/:merchantId/customer')
export class CustomerController {
  constructor(
    private readonly getCustomersByMerchantIdHandler: GetCustomersByMerchantId,
    private readonly getCustomerDetialByIdHandler: GetCustomerById,
    private readonly createCustomerHandler: CreateCustomer,
    private readonly GetCustomerByPhone: GetCustomerPhone,
    private readonly getCustomerListDev: GetCustomerListDev,
    private readonly updateCustomerHandler: UpdateCustomer,
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

  @Public()
  @Get('/phone/:phone')
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

  @Public()
  @Get('/wallet/:phone')
  @HttpCode(200)
  async getWallet(
    @Param('merchantId') merchantId: string,
    @Param('phone') phone: string,
  ) {
    return this.GetCustomerByPhone.execute(merchantId, phone);
  }

  @Public()
  @Get('/dev/all')
  @HttpCode(200)
  async getAllCustomers(@Query() pageOptionsDto: PageOptionsDto) {
    return this.getCustomerListDev.execute(pageOptionsDto);
  }
  @Public()
  @Put('/dev/update/:customerId')
  @HttpCode(201)
  async updateCustomer(
    @Param('customerId') customerId: string,
    @Body() updateCustomerDto: UpdateCustomerDto,
  ) {
    return this.updateCustomerHandler.execute(customerId, updateCustomerDto);
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
