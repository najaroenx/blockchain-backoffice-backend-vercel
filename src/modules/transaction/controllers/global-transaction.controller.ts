import { Controller, Get, HttpCode, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { GetAllTransactionsByCustomerPhone } from '../handlers/getAllTransactionsByCustomerPhone.handler';
import { GetPointTransactionsByCustomerPhone } from '../handlers/getPointTransactionsByCustomerPhone.handler';
import { GetVoucherTransactionsByCustomerPhone } from '../handlers/getVoucherTransactionsByCustomerPhone.handler';
import { Public } from 'src/modules/auth/public.decorator';

@ApiTags('Transaction')
@Controller('/transaction')
export class GlobalTransactionController {
  constructor(
    private readonly getAllTransactionsByCustomerPhone: GetAllTransactionsByCustomerPhone,
    private readonly getPointTransactionsByCustomerPhone: GetPointTransactionsByCustomerPhone,
    private readonly getVoucherTransactionsByCustomerPhone: GetVoucherTransactionsByCustomerPhone,
  ) {}

  @Get('/customer/:phone')
  @Public()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get All Customer Transaction History by Phone',
    description:
      'ดึงประวัติธุรกรรมทั้งหมดของลูกค้าจากทุก merchants ด้วยเบอร์โทรศัพท์',
  })
  @ApiParam({
    name: 'phone',
    description: 'เบอร์โทรศัพท์ของลูกค้า (10 digits)',
    example: '0984360421',
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction history retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Customer not found',
  })
  async getAllTransactionsByCustomer(@Param('phone') phone: string) {
    return this.getAllTransactionsByCustomerPhone.execute(phone);
  }

  @Get('/customer/phone/:phone/points')
  @Public()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get Point Transaction History by Customer Phone (All Merchants)',
    description:
      'ดึงประวัติธุรกรรม Point เท่านั้น (ไม่รวม voucher) ของลูกค้าจากทุก merchants ด้วยเบอร์โทรศัพท์',
  })
  @ApiParam({
    name: 'phone',
    description: 'เบอร์โทรศัพท์ของลูกค้า (10 digits)',
    example: '0984360421',
  })
  @ApiResponse({
    status: 200,
    description: 'Point transaction history retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Customer not found',
  })
  async getPointTransactionsCustomer(@Param('phone') phone: string) {
    return this.getPointTransactionsByCustomerPhone.execute(null, phone);
  }

  @Get('/customer/phone/:phone/vouchers')
  @Public()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get Voucher Transaction History by Customer Phone (All Merchants)',
    description:
      'ดึงประวัติธุรกรรม Voucher เท่านั้น (ไม่รวม point) ของลูกค้าจากทุก merchants ด้วยเบอร์โทรศัพท์',
  })
  @ApiParam({
    name: 'phone',
    description: 'เบอร์โทรศัพท์ของลูกค้า (10 digits)',
    example: '0984360421',
  })
  @ApiResponse({
    status: 200,
    description: 'Voucher transaction history retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Customer not found',
  })
  async getVoucherTransactionsCustomer(@Param('phone') phone: string) {
    return this.getVoucherTransactionsByCustomerPhone.execute(null, phone);
  }
}
