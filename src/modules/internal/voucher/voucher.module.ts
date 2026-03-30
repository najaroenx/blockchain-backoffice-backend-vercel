import { Module } from '@nestjs/common';
import { VoucherRepository } from './voucher.repository';
import { VoucherDBService } from './services/voucher-db.service';
import { VoucherController } from './controllers/voucher.controller';
import { PrismaModule } from '../../../../prisma/prisma.module';
import { CreateVoucherWithCodes } from './handlers/createVoucherWithCodes.handler';
import { ActivateVoucher } from './handlers/activateVoucher.handler';
import { RedeemVoucher } from './handlers/redeemVoucher.handler';
import { BuyCouponFromMarketplace } from './handlers/buyCouponFromMarketplace.handler';
import { GetCustomerOwnedVouchers } from './handlers/getCustomerOwnedVouchers.handler';
import { GetMarketplaceListings } from './handlers/getMarketplaceListings.handler';
import { ManageCouponHandler } from './handlers/manageCoupon.handler';
import { MerchantBuyCouponFromSeller } from './handlers/merchantBuyCouponFromSeller.handler';
import { SellerListOnMarketplace } from './handlers/sellerListOnMarketplace.handler';
import { GetSellerVouchers } from './handlers/getSellerVouchers.handler';
import { AddToWhitelist } from './handlers/addToWhitelist.handler';
import { BlockchainModule } from 'src/providers/blockchain/blockchain.module';
import { TokenModule } from 'src/providers/token/token.module';
import { SharedModule } from 'src/modules/shared/shared.module';
import { AisTransferModule } from 'src/providers/ais-transfer/ais-transfer.module';
import { GetVoucherByListingId } from './handlers/getVoucherByListingId.handler';
import { GetVoucherById } from './handlers/getVoucherById.handler';
import { GetVoucherByMerchantRef } from './handlers/getVoucherByMerchantRef.handler';
import { BatchListOnMarketplaceHandler } from './handlers/batchListOnMarketplace.handler';
import { GetSellerListingsHandler } from './handlers/getSellerListings.handler';
import { GetListingBatchDetailHandler } from './handlers/getListingBatchDetail.handler';
import { DelistExpiredVouchers } from './handlers/delistExpiredVouchers.handler';
import { DelistExpiredVouchersCron } from './cron/delistExpiredVouchers.cron';
import { GetMarketplaceListingsEndUser } from './handlers/getMarketplaceListtingEnduser.handler';
import { GetCouponById } from './handlers/getCouponById.handler';
import { GetVoucherByLatestCode } from './handlers/getVoucherByLatestCode.handler';
import { GetMarketplaceListingsByMerchantRef } from './handlers/getMarketplaceListingsByMerchantRef.handler';
import { FixController } from './controllers/fix.controller';
import { FixVoucherGroupCollision } from './handlers/fixVoucherGroupCollision.handler';
import { FixWhitelistHandler } from './handlers/fixWhitelist.handler';
import { FixRedeemStatusHandler } from './handlers/fixRedeemStatus.handler';
import { FixBalanceCheckHandler } from './handlers/fixBalanceCheck.handler';
import { FixSendPointsHandler } from './handlers/fixSendPoints.handler';
import { FixDeletePurchaseTxHandler } from './handlers/fixDeletePurchaseTx.handler';
import { FixDeleteRedeemTxHandler } from './handlers/fixDeleteRedeemTx.handler';
import { FixWalletOnchainHandler } from './handlers/fixWalletOnchain.handler';
@Module({
  imports: [
    PrismaModule,
    BlockchainModule,
    TokenModule,
    SharedModule,
    AisTransferModule,
  ],
  controllers: [VoucherController, FixController],
  providers: [
    VoucherDBService,
    VoucherRepository,
    CreateVoucherWithCodes,
    ActivateVoucher,
    RedeemVoucher,
    BuyCouponFromMarketplace,
    MerchantBuyCouponFromSeller,
    SellerListOnMarketplace,
    GetSellerVouchers,
    GetCustomerOwnedVouchers,
    GetMarketplaceListings,
    ManageCouponHandler,
    AddToWhitelist,
    GetVoucherByListingId,
    GetVoucherById,
    GetVoucherByMerchantRef,
    BatchListOnMarketplaceHandler,
    GetSellerListingsHandler,
    GetListingBatchDetailHandler,
    DelistExpiredVouchers,
    DelistExpiredVouchersCron,
    GetMarketplaceListingsEndUser,
    GetCouponById,
    GetVoucherByLatestCode,
    GetMarketplaceListingsByMerchantRef,
    FixVoucherGroupCollision,
    FixWhitelistHandler,
    FixRedeemStatusHandler,
    FixBalanceCheckHandler,
    FixSendPointsHandler,
    FixDeletePurchaseTxHandler,
    FixDeleteRedeemTxHandler,
    FixWalletOnchainHandler,
  ],
  exports: [
    VoucherDBService,
    GetCouponById,
    GetVoucherByLatestCode,
    GetMarketplaceListingsByMerchantRef,
  ],
})
export class VoucherModule {}
