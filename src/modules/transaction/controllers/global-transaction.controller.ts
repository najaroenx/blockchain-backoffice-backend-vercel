import { Controller, Get, HttpCode, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { GetAllTransactionsByCustomerPhone } from '../handlers/getAllTransactionsByCustomerPhone.handler';
import { GetPointTransactionsByCustomerPhone } from '../handlers/getPointTransactionsByCustomerPhone.handler';
import { GetVoucherTransactionsByCustomerPhone } from '../handlers/getVoucherTransactionsByCustomerPhone.handler';
import { GetTransactionById } from '../handlers/getTransactionById.handler';
import { GetTransactionByMerchantRef } from '../handlers/getTransactionByMerchantRef.handler';
import { Public } from 'src/modules/auth/public.decorator';

@ApiTags('Transaction')
@Controller('/transaction')
export class GlobalTransactionController {
  constructor(
    private readonly getAllTransactionsByCustomerPhone: GetAllTransactionsByCustomerPhone,
    private readonly getPointTransactionsByCustomerPhone: GetPointTransactionsByCustomerPhone,
    private readonly getVoucherTransactionsByCustomerPhone: GetVoucherTransactionsByCustomerPhone,
    private readonly getTransactionById: GetTransactionById,
    private readonly getTransactionByMerchantRef: GetTransactionByMerchantRef,
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
    summary:
      'Get Voucher Transaction History by Customer Phone (All Merchants)',
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

  @Get('/merchantref/:merchantRef')
  @Public()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get Transactions by Merchant Reference',
    description: 'ดึงข้อมูลธุรกรรมทั้งหมดที่มี merchantRef ตรงกัน',
  })
  @ApiParam({
    name: 'merchantRef',
    description: 'Merchant Reference ID',
    example: 'REF-12345',
  })
  @ApiResponse({
    status: 200,
    description: 'Transactions retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'No transactions found with this merchantRef',
  })
  async getTransactionsByMerchantRef(
    @Param('merchantRef') merchantRef: string,
  ) {
    return this.getTransactionByMerchantRef.execute(merchantRef);
  }

  @Get('/:id')
  @Public()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get Transaction by ID',
    description:
      'ดึงข้อมูลธุรกรรมเดียวด้วย transaction ID (ใช้ structure เดียวกับ all history)',
  })
  @ApiParam({
    name: 'id',
    description: 'Transaction ID',
    example: 'cm4abc123xyz',
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Transaction not found',
  })
  async getTransaction(@Param('id') id: string) {
    return this.getTransactionById.execute(id);
  }
}
