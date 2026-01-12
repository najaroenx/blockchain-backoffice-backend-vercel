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
import { Public } from 'src/modules/auth/public.decorator';

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
   * @param walletAddress - The seller's wallet address
   * @param query - Date range and granularity filters
   */
  @Get('/seller/:walletAddress')
  @Public()
  @HttpCode(200)
  async getSellerDashboard(
    @Param('walletAddress') walletAddress: string,
    @Query() query: DashboardQueryDto,
  ) {
    return this.sellerDashboardHandler.execute(walletAddress, query);
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
}
