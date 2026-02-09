import { Module } from '@nestjs/common';

// Import all internal modules
import { CustomerModule } from './customer/customer.module';
import { PointModule } from './point/point.module';
import { TransactionModule } from './transaction/transaction.module';
import { VoucherModule } from './voucher/voucher.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { MerchantModule } from './merchant/merchant.module';
import { WalletModule } from './wallet/wallet.module';
import { ApiKeyModule } from './api-key/api-key.module';
import { AdminModule } from './admin/admin.module';
import { TempLinkModule } from './templink/templink.module';
import { AuthModule } from './auth/auth.module';
import { SessionModule } from './session/session.module';
import { UserModule } from './user/user.module';

/**
 * Internal Module
 *
 * Groups all internal-facing APIs for backoffice operations.
 * These endpoints are used by:
 * - Admin dashboard
 * - Merchant management systems
 * - Internal services
 *
 * Modules included:
 * - CustomerModule: /:merchantId/customer - Customer management
 * - PointModule: /:merchantId/point - Point configuration
 * - TransactionModule: /:merchantId/transaction, /treasury - Transactions
 * - VoucherModule: /coupon - Voucher/coupon management
 * - DashboardModule: /dashboard - Analytics dashboards
 * - MerchantModule: /merchant - Merchant CRUD
 * - WalletModule: /wallet - Wallet operations
 * - ApiKeyModule: /:merchantId/api-key - API key management
 * - AdminModule: /admin - Admin operations
 * - TempLinkModule: /templink - Temporary links
 * - AuthModule: /auth - Authentication
 * - SessionModule: /session - Session management
 * - UserModule: User services (no controllers)
 */
@Module({
  imports: [
    CustomerModule,
    PointModule,
    TransactionModule,
    VoucherModule,
    DashboardModule,
    MerchantModule,
    WalletModule,
    ApiKeyModule,
    AdminModule,
    TempLinkModule,
    AuthModule,
    SessionModule,
    UserModule,
  ],
  exports: [
    CustomerModule,
    PointModule,
    TransactionModule,
    VoucherModule,
    DashboardModule,
    MerchantModule,
    WalletModule,
    ApiKeyModule,
    AdminModule,
    TempLinkModule,
    AuthModule,
    SessionModule,
    UserModule,
  ],
})
export class InternalModule {}
