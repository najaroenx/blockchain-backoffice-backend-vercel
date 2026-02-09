import {
  Controller,
  Get,
  HttpCode,
  Param,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { DashboardService } from '../handlers/dashboard.handler';
import { GetMarketerDashboardHandler } from '../handlers/get-marketer-dashboard.handler';
import { GetSellerDashboardHandler } from '../handlers/get-seller-dashboard.handler';
import { GetMerchantRefDashboardHandler } from '../handlers/get-merchantref-dashboard.handler';
import { DashboardQueryDto } from '../dtos/dashboard-query.dto';
import { Public } from '../../auth/public.decorator';

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
  @Get('/seller/:merchantId')
  @Public()
  @HttpCode(200)
  async getSellerDashboard(
    @Param('merchantId') merchantId: string,
    @Query() query: DashboardQueryDto,
  ) {
    return this.sellerDashboardHandler.execute(merchantId, query);
  }

  /**
   * MerchantRef Dashboard
   * Returns voucher statistics, end user data, and redemption breakdown
   * @param merchantRef - The merchant reference identifier
   * @param query - Date range and granularity filters
   */
  @Get('/merchantref/:merchantRef')
  @Public()
  @HttpCode(200)
  async getMerchantRefDashboard(
    @Param('merchantRef') merchantRef: string,
    @Query() query: DashboardQueryDto,
  ) {
    return this.merchantRefDashboardHandler.execute(merchantRef, query);
  }

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
   * Returns list of coupons for dropdown filter (created by seller)
   * @param merchantId - The merchant ID
   */
  @Get('/seller/:merchantId/coupons')
  @Public()
  @HttpCode(200)
  async getSellerCouponDropdown(@Param('merchantId') merchantId: string) {
    return this.sellerDashboardHandler.getCouponDropdown(merchantId);
  }

  /**
   * Seller Merchants Breakdown
   * Returns list of merchants (marketers) that bought coupons from this seller
   * Supports filtering by couponIds from dropdown
   * @param merchantId - The merchant ID (seller)
   * @param query - Optional couponIds filter
   */
  @Get('/seller/:merchantId/merchants')
  @Public()
  @HttpCode(200)
  async getSellerMerchants(
    @Param('merchantId') merchantId: string,
    @Query() query: DashboardQueryDto,
  ) {
    return this.sellerDashboardHandler.getMerchants(
      merchantId,
      query.couponIds,
    );
  }

  /**
   * MerchantRef Coupon Dropdown
   * Returns list of coupons for dropdown filter (with this merchantRef)
   * @param merchantRef - The merchant reference identifier
   */
  @Get('/merchantref/:merchantRef/coupons')
  @Public()
  @HttpCode(200)
  async getMerchantRefCouponDropdown(
    @Param('merchantRef') merchantRef: string,
  ) {
    return this.merchantRefDashboardHandler.getCouponDropdown(merchantRef);
  }
}
