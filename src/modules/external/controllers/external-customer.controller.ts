import { Controller, Get, HttpCode, Param, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { Public } from 'src/modules/internal/auth/public.decorator';
import { GetCustomerPhone } from 'src/modules/internal/customer/handlers/getCustomerByPhone.handler';
import { GetCustomerPhoneDevForResp } from 'src/modules/internal/customer/handlers/getCustomerPhoneDevForResp.handler';
import { GetCustomerPoints } from 'src/modules/internal/customer/handlers/getCustomerPoints.handler';
import { ClearCustomerByPhone } from 'src/modules/internal/customer/handlers/clearCustomerByPhone.handler';

/**
 * External Customer Controller
 *
 * Endpoints for external integration:
 * - GET /customer/{phone}/points - Get customer points balance
 * - GET /customer/{phone} - Get customer details
 * - DELETE /customer/{phone} - Clear customer data
 */
@ApiTags('External - Customer')
@Controller('/customer')
export class ExternalCustomerController {
  constructor(
    private readonly getCustomerByPhone: GetCustomerPhone,
    private readonly getCustomerPhoneDevForResp: GetCustomerPhoneDevForResp,
    private readonly getCustomerPoints: GetCustomerPoints,
    private readonly clearCustomerByPhone: ClearCustomerByPhone,
  ) {}

  @Public()
  @Get('/:phone/points')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get Customer Points Balance (All Merchants)',
    description: 'ดึง Point Balance ของลูกค้าทุก merchant (ไม่รวม voucher)',
  })
  @ApiParam({
    name: 'phone',
    description: 'เบอร์โทรศัพท์ของลูกค้า (10 digits)',
    example: '0984360421',
  })
  @ApiResponse({
    status: 200,
    description: 'Customer points retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Customer not found',
  })
  async getCustomerPointsBalance(@Param('phone') phone: string) {
    return this.getCustomerPoints.execute(phone);
  }

  @Public()
  @Get('/:phone')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get Customer by Phone',
    description: 'ดึงข้อมูลลูกค้าด้วยเบอร์โทรศัพท์',
  })
  @ApiParam({
    name: 'phone',
    description: 'เบอร์โทรศัพท์ของลูกค้า (10 digits)',
    example: '0984360421',
  })
  @ApiResponse({
    status: 200,
    description: 'Customer retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Customer not found',
  })
  async getCustomerByPhoneDetailed(@Param('phone') phone: string) {
    return this.getCustomerPhoneDevForResp.executeDetailed(phone);
  }

  @Public()
  @Delete('/:phone')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Clear Customer by Phone',
    description:
      'ลบข้อมูลลูกค้าทั้งหมดโดยใช้เบอร์โทรศัพท์ (ลบ wallet, transactions, temp links, clear voucher ownership)',
  })
  @ApiParam({
    name: 'phone',
    description: 'เบอร์โทรศัพท์ของลูกค้า (10 digits)',
    example: '0984360421',
  })
  @ApiResponse({
    status: 200,
    description: 'Customer cleared successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Customer not found',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async clearCustomer(@Param('phone') phone: string) {
    return this.clearCustomerByPhone.execute(phone);
  }
}
