import { Module } from '@nestjs/common';
import { VoucherRepository } from './voucher.repository';
import { VoucherDBService } from './services/voucher-db.service';
import { VoucherController } from './controllers/voucher.controller';
import { PrismaModule } from '../../../prisma/prisma.module';
import { CreateVoucherWithCodes } from './handlers/createVoucherWithCodes.handler';
import { ActivateVoucher } from './handlers/activateVoucher.handler';
import { RedeemVoucher } from './handlers/redeemVoucher.handler';
import { BuyCouponFromMarketplace } from './handlers/buyCouponFromMarketplace.handler';
import { GetCustomerOwnedVouchers } from './handlers/getCustomerOwnedVouchers.handler';
import { GetCustomerOnChainBalances } from './handlers/getCustomerOnChainBalances.handler';
import { GetMarketplaceListings } from './handlers/getMarketplaceListings.handler';
import { ManageCouponHandler } from './handlers/manageCoupon.handler';
import { MerchantBuyCouponFromSeller } from './handlers/merchantBuyCouponFromSeller.handler';
import { SellerListOnMarketplace } from './handlers/sellerListOnMarketplace.handler';
import { GetSellerVouchers } from './handlers/getSellerVouchers.handler';
import { AddToWhitelist } from './handlers/addToWhitelist.handler';
import { BlockchainModule } from 'src/providers/blockchain/blockchain.module';
import { TokenModule } from 'src/providers/token/token.module';
import { GetVoucherByListingId } from './handlers/getVoucherByListingId.handler';
@Module({
  imports: [PrismaModule, BlockchainModule, TokenModule],
  controllers: [VoucherController],
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
    GetCustomerOnChainBalances,
    GetMarketplaceListings,
    ManageCouponHandler,
    AddToWhitelist,
    GetVoucherByListingId,
  ],
  exports: [VoucherDBService],
})
export class VoucherModule {}
