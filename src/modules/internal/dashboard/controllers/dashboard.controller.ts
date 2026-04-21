import {
  Controller,
  Get,
  HttpCode,
  Param,
  Query,
  // UseInterceptors,
} from '@nestjs/common';
import { DashboardService } from '../handlers/dashboard.handler';
import { GetMarketerDashboardHandler } from '../handlers/get-marketer-dashboard.handler';
import { GetSellerDashboardHandler } from '../handlers/get-seller-dashboard.handler';
import { GetMerchantRefDashboardHandler } from '../handlers/get-merchantref-dashboard.handler';
import { DashboardQueryDto } from '../dtos/dashboard-query.dto';
import { Public } from 'src/modules/internal/auth/public.decorator';

// TODO: Add caching with @nestjs/cache-manager when installed
// Cache TTL: 5 minutes (300000ms)

@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly marketerDashboardHandler: GetMarketerDashboardHandler,
    private readonly sellerDashboardHandler: GetSellerDashboardHandler,
    private readonly merchantRefDashboardHandler: GetMerchantRefDashboardHandler,
  ) {}

  /**
   * Legacy dashboard endpoint
   * @deprecated Use /dashboard/marketer/:merchantId instead
   */
  @Get('/:merchantId')
  @HttpCode(200)
  async getData(@Param('merchantId') merchantId: string) {
    return this.dashboardService.execute(merchantId);
  }

  /**
   * Marketer Dashboard
   * Returns comprehensive statistics including vouchers, end users, transactions, points, and THB token
   * @param merchantId - The merchant ID
   * @param query - Date range and granularity filters
   */
  @Get('/marketer/:merchantId')
  @Public()
  @HttpCode(200)
  async getMarketerDashboard(
    @Param('merchantId') merchantId: string,
    @Query() query: DashboardQueryDto,
  ) {
    return this.marketerDashboardHandler.execute(merchantId, query);
  }

  /**
   * Seller Dashboard
   * Returns listing statistics, sales data, and marketer breakdown
   * @param merchantId - The merchant ID (will lookup seller wallet internally)
   * @param query - Date range and granularity filters
   */
  @Get('/seller/:sellerMerchantId')
  @Public()
  @HttpCode(200)
  async getSellerDashboard(
    @Param('sellerMerchantId') sellerMerchantId: string,
    @Query() query: DashboardQueryDto,
  ) {
    return this.sellerDashboardHandler.execute(sellerMerchantId, query);
  }

  // GET /dashboard/merchantref/:merchantRef moved to ExternalModule

  /**
   * Marketer Coupon Dropdown
   * Returns list of coupons for dropdown filter (owned + purchased)
   * @param merchantId - The merchant ID
   */
  @Get('/marketer/:merchantId/coupons')
  @Public()
  @HttpCode(200)
  async getMarketerCouponDropdown(@Param('merchantId') merchantId: string) {
    return this.marketerDashboardHandler.getCouponDropdown(merchantId);
  }

  /**
   * Seller Coupon Dropdown
   * Returns list of seller-created coupons, optionally filtered by marketer who purchased them
   * @param merchantId - The seller's merchant ID
   * @param query - Optional marketerMerchantId to filter by specific marketer
   */
  @Get('/seller/:sellerMerchantId/coupons')
  @Public()
  @HttpCode(200)
  async getSellerCouponDropdown(
    @Param('sellerMerchantId') sellerMerchantId: string,
    @Query() query: DashboardQueryDto,
  ) {
    return this.sellerDashboardHandler.getCouponDropdown(
      sellerMerchantId,
      query.marketerMerchantId,
    );
  }

  /**
   * Seller Merchants Breakdown
   * Returns list of merchants (marketers) that bought coupons from this seller
   * Supports filtering by couponIds from dropdown
   * @param merchantId - The merchant ID (seller)
   * @param query - Optional couponIds filter
   */
  @Get('/seller/:sellerMerchantId/merchants')
  @Public()
  @HttpCode(200)
  async getSellerMerchants(
    @Param('sellerMerchantId') sellerMerchantId: string,
    @Query() query: DashboardQueryDto,
  ) {
    return this.sellerDashboardHandler.getMerchants(
      sellerMerchantId,
      query.couponIds,
    );
  }
  // TODO:
  // GET /dashboard/merchantref/:merchantRef/coupons moved to ExternalModule
}
