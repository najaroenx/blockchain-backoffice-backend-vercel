import { Controller, Get, HttpCode, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { GetAllTransactionsByCustomerPhone } from '../handlers/getAllTransactionsByCustomerPhone.handler';
import { Public } from 'src/modules/auth/public.decorator';

@ApiTags('Transaction')
@Controller('/transaction')
export class GlobalTransactionController {
  constructor(
    private readonly getAllTransactionsByCustomerPhone: GetAllTransactionsByCustomerPhone,
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
}
