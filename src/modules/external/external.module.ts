import { Module } from '@nestjs/common';
import { ExternalCustomerController } from './controllers/external-customer.controller';
import { ExternalPointController } from './controllers/external-point.controller';
import { ExternalCouponController } from './controllers/external-coupon.controller';
import { ExternalTransactionController } from './controllers/external-transaction.controller';
import { ExternalDashboardController } from './controllers/external-dashboard.controller';

// Import modules that provide handlers
import { CustomerModule } from '../internal/customer/customer.module';
import { PointModule } from '../internal/point/point.module';
import { VoucherModule } from '../internal/voucher/voucher.module';
import { TransactionModule } from '../internal/transaction/transaction.module';
import { DashboardModule } from '../internal/dashboard/dashboard.module';

/**
 * External Module
 *
 * Groups all external-facing APIs for integration with external services.
 * These endpoints are used by:
 * - End users (mobile app, web app)
 * - Dashboard/MerchantRef systems
 *
 * Route paths remain the same as before (backward compatible).
 * Only folder organization changed for better separation of concerns.
 *
 * External endpoints:
 * - /customer/phone/{phone} - Get customer wallet by phone
 * - /customer/{phone} - Get customer details
 * - /points/my-points/{phone} - Get user points
 * - /points/{pointId} - Get point by ID
 * - /coupon/my-coupons/{phone} - Get user coupons
 * - /coupon/code/{id} - Get coupon by ID
 * - /coupon/redeem - Redeem coupon
 * - /coupon/redeem-ais - Redeem AIS coupon
 * - /transaction/customer/{phone} - Get all transactions
 * - /transaction/customer/phone/{phone}/points - Get point transactions
 * - /transaction/customer/phone/{phone}/coupons - Get coupon transactions
 * - /transaction/{id} - Get transaction by ID
 * - /dashboard/merchantref/{merchantRef} - Get merchantref dashboard
 * - /transaction/merchantref/{merchantRef} - Get merchantref transactions
 */
@Module({
  imports: [
    CustomerModule,
    PointModule,
    VoucherModule,
    TransactionModule,
    DashboardModule,
  ],
  controllers: [
    ExternalCustomerController,
    ExternalPointController,
    ExternalCouponController,
    ExternalTransactionController,
    ExternalDashboardController,
  ],
})
export class ExternalModule {}
