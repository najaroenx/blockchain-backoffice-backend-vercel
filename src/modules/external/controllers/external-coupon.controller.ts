import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { Public } from 'src/modules/internal/auth/public.decorator';
import { VoucherDBService } from 'src/modules/internal/voucher/services/voucher-db.service';
import { GetCouponById } from 'src/modules/internal/voucher/handlers/getCouponById.handler';
import { RedeemAISVoucherDto } from 'src/modules/internal/voucher/dtos/redeem-voucher.dto';

/**
 * External Coupon Controller
 *
 * Endpoints for external integration:
 * - GET /coupon/code/{id} - Get coupon by ID
 * - GET /coupon/my-coupons/{phone} - Get user coupons
 * - POST /coupon/redeem - Redeem coupon
 * - POST /coupon/redeem-ais - Redeem AIS coupon
 */
@ApiTags('External - Coupon')
@Controller('coupon')
export class ExternalCouponController {
  constructor(
    private readonly voucherService: VoucherDBService,
    private readonly getCouponByIdHandler: GetCouponById,
  ) {}

  /**
   * Get coupon (VoucherCode) by ID
   * GET /coupon/code/:id
   * Returns coupon details with voucher, merchant, and point info
   */
  @Get('/code/:id')
  @Public()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get Coupon by ID',
    description:
      'ดึงข้อมูล Coupon (VoucherCode) ด้วย ID พร้อมข้อมูล voucher, merchant และ point',
  })
  @ApiParam({
    name: 'id',
    description: 'Coupon (VoucherCode) ID',
    example: 'cm4abc123xyz',
  })
  @ApiResponse({
    status: 200,
    description: 'Coupon retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Coupon not found',
  })
  async getCouponById(@Param('id') id: string) {
    return this.getCouponByIdHandler.execute(id);
  }

  /**
   * Get vouchers owned by customer (lookup by phone -> wallet)
   * GET /coupon/my-coupons/:phone?status=unused|used|all&page=1&limit=20
   */
  @Get('/my-coupons/:phone')
  @Public()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get User Coupons by Phone',
    description: 'ดึงข้อมูล Coupon ของลูกค้าด้วยเบอร์โทรศัพท์',
  })
  @ApiParam({
    name: 'phone',
    description: 'เบอร์โทรศัพท์ของลูกค้า (10 digits)',
    example: '0984360421',
  })
  @ApiResponse({
    status: 200,
    description: 'Coupons retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Customer not found',
  })
  async getCustomerOwnedVouchers(
    @Param('phone') phone: string,
    @Query('status') status?: 'unused' | 'used' | 'all',
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;

    return this.voucherService.getCustomerOwnedVouchers(
      phone,
      status || 'all',
      pageNum,
      limitNum,
    );
  }

  /**
   * Redeem voucher code
   * POST /coupon/redeem
   * Body: { code: string, phone: string, merchantRef: string }
   */
  @Post('/redeem')
  @Public()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Redeem Voucher',
    description: 'ใช้ voucher code เพื่อแลกรับส่วนลดหรือของรางวัล',
  })
  @ApiBody({
    description: 'Voucher redemption details',
    schema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          example: 'WELCOME2024',
          description: 'รหัส voucher code',
        },
        phone: {
          type: 'string',
          example: '0984360421',
          description: 'เบอร์โทรศัพท์ของลูกค้า',
        },
        merchantRef: {
          type: 'string',
          example: 'merchant-ref-001',
          description: 'รหัสอ้างอิงร้านค้า',
        },
      },
      required: ['code', 'phone', 'merchantRef'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Voucher redeemed successfully',
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad Request - Code already used, expired, wrong merchant, or insufficient balance',
  })
  @ApiResponse({
    status: 404,
    description: 'Code or customer not found',
  })
  async redeemVoucher(
    @Body()
    data: {
      code: string;
      phone: string;
      merchantRef: string;
    },
  ) {
    return this.voucherService.redeemVoucher(
      data.code,
      data.phone,
      data.merchantRef,
    );
  }

  /**
   * Redeem AIS voucher code
   * POST /coupon/redeem-ais
   * Body: { code: string, phone: string, merchantRef: string, receiverPhone: string }
   */
  @Post('/redeem-ais')
  @Public()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Redeem AIS Voucher (Transfer Points to Another Customer)',
    description:
      'แลก voucher ประเภท AIS Point โดยโอนคะแนนไปให้เบอร์โทรศัพท์อื่น. Voucher ต้องเป็นประเภท "aispoint" เท่านั้น และเบอร์ผู้แลกกับผู้รับต้องไม่เหมือนกัน',
  })
  @ApiBody({
    description: 'AIS Voucher redemption details',
    schema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          example: 'AIS2024WELCOME',
          description: 'รหัส voucher code ที่ต้องการแลก',
        },
        phone: {
          type: 'string',
          example: '0984360421',
          description: 'เบอร์โทรศัพท์ของลูกค้าที่แลก voucher (ผู้โอนคะแนน)',
        },
        merchantRef: {
          type: 'string',
          example: 'merchant-ref-001',
          description: 'รหัสอ้างอิงร้านค้า (ต้องตรงกับ voucher.merchantRef)',
        },
        receiverPhone: {
          type: 'string',
          example: '0987654321',
          description:
            'เบอร์โทรศัพท์ของผู้รับคะแนน AIS Point (ต้องไม่ซ้ำกับ phone)',
        },
      },
      required: ['code', 'phone', 'merchantRef', 'receiverPhone'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'AIS Voucher redeemed successfully',
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad Request - Invalid voucher type, same phone, or other validation errors',
  })
  @ApiResponse({
    status: 404,
    description: 'Code or customer not found',
  })
  async redeemAISVoucher(@Body() data: RedeemAISVoucherDto) {
    return this.voucherService.redeemAISVoucher(
      data.code,
      data.phone,
      data.merchantRef,
      data.receiverPhone,
    );
  }
}

// @Query('status') status?: 'unused' | 'used' | 'all',
// @Query('page') page?: string,
// @Query('limit') limit?: string,
