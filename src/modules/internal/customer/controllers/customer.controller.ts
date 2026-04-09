import {
  Body,
  Controller,
  Get,
  HttpCode,
  Logger,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiHeader,
} from '@nestjs/swagger';
import {
  CreateCustomerDto,
  UpdateCustomerDto,
  RegisterCustomerDto,
} from '../dtos';
import { GetCustomersByMerchantId } from '../handlers/getCustomersByMerchantId.handler';
import { GetAllCustomersByMerchantWithWallet } from '../handlers/getAllCustomersByMerchantWithWallet.handler';
import { GetCustomerById } from '../handlers/getCustomerById.handler';
import { GetCustomerPhone } from '../handlers/getCustomerByPhone.handler';
import { CreateCustomer } from '../handlers/createCustomer.handler';
import { GetCustomerListDev } from '../handlers/getCustomerListDev.handler';
import { PageOptionsDto } from 'src/common/dtos';
import { UpdateCustomer } from '../handlers/updateCustomer.handler';
import { GetCustomerPhoneDevForResp } from '../handlers/getCustomerPhoneDevForResp.handler';
import {
  RegisterCustomerDev,
  // RegistrationResponse,
} from '../handlers/registerCustomer.dev.handler';
import { Public } from 'src/modules/internal/auth/public.decorator';

@ApiTags('Customer')
@Controller('/:merchantId/customer')
export class CustomerController {
  private readonly logger = new Logger(CustomerController.name);

  constructor(
    private readonly getCustomersByMerchantIdHandler: GetCustomersByMerchantId,
    private readonly getAllCustomersByMerchantWithWalletHandler: GetAllCustomersByMerchantWithWallet,
    private readonly getCustomerDetialByIdHandler: GetCustomerById,
    private readonly createCustomerHandler: CreateCustomer,
    private readonly GetCustomerByPhone: GetCustomerPhone,
    private readonly getCustomerListDev: GetCustomerListDev,
    private readonly updateCustomerHandler: UpdateCustomer,
    private readonly getCustomerPhoneDevForResp: GetCustomerPhoneDevForResp,
    private readonly registerCustomerDev: RegisterCustomerDev,
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

  @Get('/all')
  @HttpCode(200)
  async getAllCustomersByMerchantWithWallet(
    @Param('merchantId') merchantId: string,
  ) {
    return this.getAllCustomersByMerchantWithWalletHandler.execute(merchantId);
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
  @Post('/register')
  @HttpCode(201)
  async registerCustomer(
    @Param('merchantId') merchantId: string,
    @Query('callbackUri') callbackUri?: string,
  ): Promise<any> {
    const dto = new RegisterCustomerDto();
    dto.merchantId = merchantId;
    dto.callbackUri = callbackUri;

    // Validate the DTO
    const { validate } = await import('class-validator');
    const errors = await validate(dto);
    if (errors.length > 0) {
      const { BadRequestException } = await import('@nestjs/common');
      throw new BadRequestException(
        errors.flatMap((err) => Object.values(err.constraints || {})),
      );
    }

    return this.registerCustomerDev.execute(merchantId, callbackUri);
  }

  @Public()
  @Get('/phone/:phone')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get Customer Wallet by Phone',
    description: 'ค้นหาข้อมูล Wallet และ Voucher ของลูกค้าด้วยเบอร์โทรศัพท์',
  })
  @ApiHeader({
    name: 'x-api-key',
    description: 'API Key สำหรับ authentication',
    required: true,
    example: 'LEk8YLySHJdMD_nD0cw5',
  })
  @ApiParam({
    name: 'merchantId',
    description: 'รหัสร้านค้า',
    example: 'cmi5o77hc00079yqzgrtf0e5l',
  })
  @ApiParam({
    name: 'phone',
    description: 'เบอร์โทรศัพท์ของลูกค้า',
    example: '0987665432',
  })
  @ApiQuery({
    name: 'callbackUri',
    description: 'URL สำหรับ redirect กลับ (ใช้กรณีไม่เจอ user)',
    required: false,
    example: 'https://example.com',
  })
  @ApiResponse({
    status: 200,
    description: 'Customer found successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Customer not found (returns OTP registration URL)',
  })
  async getCustomerByPhone(
    @Param('phone') phone: string,
    @Param('merchantId') merchantId: string,
    @Query('callbackUri') callbackUri: string,
  ) {
    this.logger.log(
      `Getting customer by phone for merchant ${merchantId} and phone ${phone} and callbackUri ${callbackUri}`,
    );
    return this.getCustomerPhoneDevForResp.execute(
      merchantId,
      phone,
      callbackUri,
    );
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

// CustomerPhoneController moved to ExternalModule (src/modules/external/controllers/external-customer.controller.ts)
