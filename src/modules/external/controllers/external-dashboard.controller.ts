import { Controller, Get, HttpCode, Param, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { Public } from 'src/modules/internal/auth/public.decorator';
import { GetMerchantRefDashboardHandler } from 'src/modules/internal/dashboard/handlers/get-merchantref-dashboard.handler';
import { DashboardQueryDto } from 'src/modules/internal/dashboard/dtos/dashboard-query.dto';

/**
 * External Dashboard Controller
 *
 * Endpoints for external integration:
 * - GET /dashboard/merchantref/{merchantRef} - Get merchantRef dashboard
 * - GET /dashboard/merchantref/{merchantRef}/coupons - Get merchantRef coupon dropdown
 */
@ApiTags('External - Dashboard')
@Controller('dashboard')
export class ExternalDashboardController {
  constructor(
    private readonly merchantRefDashboardHandler: GetMerchantRefDashboardHandler,
  ) {}

  /**
   * MerchantRef Dashboard
   * Returns voucher statistics, end user data, and redemption breakdown
   * @param merchantRef - The merchant reference identifier
   * @param query - Date range and granularity filters
   */
  @Get('/merchantref/:merchantRef')
  @Public()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get MerchantRef Dashboard',
    description:
      'ดึงข้อมูล Dashboard สำหรับ MerchantRef รวมถึงสถิติ voucher, end user และ redemption',
  })
  @ApiParam({
    name: 'merchantRef',
    description: 'Merchant Reference identifier',
    example: 'merchant-ref-001',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Start date for filtering (ISO 8601 format)',
    example: '2024-01-01',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'End date for filtering (ISO 8601 format)',
    example: '2024-12-31',
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard data retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'MerchantRef not found',
  })
  async getMerchantRefDashboard(
    @Param('merchantRef') merchantRef: string,
    @Query() query: DashboardQueryDto,
  ) {
    return this.merchantRefDashboardHandler.execute(merchantRef, query);
  }

  /**
   * MerchantRef Coupon Dropdown
   * Returns list of coupons for dropdown filter (with this merchantRef)
   * @param merchantRef - The merchant reference identifier
   */
  @Get('/merchantref/:merchantRef/coupons')
  @Public()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get MerchantRef Coupon Dropdown',
    description: 'ดึงรายการ Coupon สำหรับ dropdown filter ของ MerchantRef',
  })
  @ApiParam({
    name: 'merchantRef',
    description: 'Merchant Reference identifier',
    example: 'merchant-ref-001',
  })
  @ApiResponse({
    status: 200,
    description: 'Coupon dropdown retrieved successfully',
  })
  async getMerchantRefCouponDropdown(
    @Param('merchantRef') merchantRef: string,
  ) {
    return this.merchantRefDashboardHandler.getCouponDropdown(merchantRef);
  }
}
