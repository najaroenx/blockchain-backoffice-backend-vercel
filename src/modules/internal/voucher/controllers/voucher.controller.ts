import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Delete,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { VoucherDBService } from '../services/voucher-db.service';
import {
  CreateVoucherByDevDto,
  CreateVoucherDto,
  UpdateVoucherCodesPointCostDto,
  UpdateAllVoucherCodesPointCostDto,
} from '../dtos';
import { ActivateVoucherDto } from '../dtos/activate-voucher.dto';
import { BuyCouponFromMarketplaceDto } from '../dtos/buy-coupon-marketplace.dto';
import { MerchantBuyCouponFromSellerDto } from '../dtos/merchant-buy-coupon.dto';
import { SellerListOnMarketplaceDto } from '../dtos/seller-list-marketplace.dto';
import { BatchListOnMarketplaceDto } from '../dtos/batch-list-marketplace.dto';

import { Public } from 'src/modules/internal/auth/public.decorator';
import { GetMarketplaceListings } from '../handlers/getMarketplaceListings.handler';
import { ManageCouponHandler } from '../handlers/manageCoupon.handler';
import { MerchantBuyCouponFromSeller } from '../handlers/merchantBuyCouponFromSeller.handler';
import { SellerListOnMarketplace } from '../handlers/sellerListOnMarketplace.handler';
import { GetSellerVouchers } from '../handlers/getSellerVouchers.handler';

import { BatchListOnMarketplaceHandler } from '../handlers/batchListOnMarketplace.handler';
import { GetSellerListingsHandler } from '../handlers/getSellerListings.handler';
import { GetListingBatchDetailHandler } from '../handlers/getListingBatchDetail.handler';
import { VoucherValueType } from '@prisma/client';
import { GetMarketplaceListingsEndUser } from '../handlers/getMarketplaceListtingEnduser.handler';
import { GetCouponById } from '../handlers/getCouponById.handler';
import { GetVoucherByListingId } from '../handlers/getVoucherByListingId.handler';

@ApiTags('Voucher')
@Controller('coupon')
export class VoucherController {
  constructor(
    private readonly voucherService: VoucherDBService,
    private readonly getMarketplaceListings: GetMarketplaceListings,
    private readonly manageCouponHandler: ManageCouponHandler,
    private readonly merchantBuyHandler: MerchantBuyCouponFromSeller,
    private readonly sellerListHandler: SellerListOnMarketplace,
    private readonly getSellerVouchersHandler: GetSellerVouchers,

    private readonly batchListHandler: BatchListOnMarketplaceHandler,
    private readonly getSellerListingsHandler: GetSellerListingsHandler,
    private readonly getListingBatchDetailHandler: GetListingBatchDetailHandler,
    private readonly getMarketplaceListingsEndUser: GetMarketplaceListingsEndUser,
    private readonly getCouponByIdHandler: GetCouponById,
    private readonly getVoucherByListingId: GetVoucherByListingId,
  ) {}

  @Get('/')
  @HttpCode(200)
  async getAllVouchers() {
    return this.voucherService.getAllVouchers();
  }

  @Get('/active')
  @HttpCode(200)
  async getActiveVouchers() {
    return this.voucherService.getActiveVouchers();
  }

  /**
   * Get VoucherValueType enum values
   * GET /coupon/value-types
   */
  @Get('/value-types')
  @Public()
  @HttpCode(200)
  async getVoucherValueTypes() {
    return {
      values: Object.values(VoucherValueType),
      description: {
        percentage: 'Percentage discount (e.g., 10% off)',
        cash: 'Cash discount (e.g., 100 THB off)',
        gift: 'Free gift or item',
        multiplier: 'Point multiplier (e.g., 2x points)',
        aispoint: 'AIS Point redemption voucher',
      },
    };
  }

  // GET /coupon/code/:id moved to ExternalModule

  /**
   * Get seller listings from marketplace for merchants to purchase
   * GET /coupon/merchant/seller-listings
   * Filters only listings with THB payment token (seller -> merchant)
   * Supports pagination via page and limit query params
   * NOTE: Must be defined BEFORE /merchant/:merchantId to avoid route conflict
   */
  @Get('/merchant/seller-listings')
  @Public()
  @HttpCode(200)
  async getSellerMarketplaceListings(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : undefined;
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    return this.getMarketplaceListings.execute(
      undefined, // no merchantId filter
      true, // sellerOnly = true
      pageNum,
      limitNum,
    );
  }

  @Get('/merchant/:merchantId')
  @Public()
  @HttpCode(200)
  async getVouchersByMerchant(@Param('merchantId') merchantId: string) {
    return this.voucherService.getVouchersByMerchant(merchantId);
  }

  /**
   * Get seller vouchers (vouchers not yet purchased by merchants)
   * GET /coupon/seller/vouchers
   * Optional query param: merchantId for filtering by seller
   */
  @Get('/seller/vouchers')
  @Public()
  @HttpCode(200)
  async getSellerVouchers(@Query('merchantId') merchantId?: string) {
    return this.getSellerVouchersHandler.execute(merchantId);
  }

  /**
   * Get available vouchers from marketplace (blockchain)
   * GET /coupon/:merchantId/products
   */
  @Get('/:merchantId/products')
  @Public()
  @HttpCode(200)
  async getAvailableVouchersForCustomers(
    @Param('merchantId') merchantId: string,
  ) {
    // Fetch from blockchain marketplace instead of database
    return this.getMarketplaceListings.execute(merchantId);
  }

  /**
   * Get available vouchers from marketplace (blockchain)
   * GET /coupon/:merchantId/end-user/products
   */
  @Get('/:merchantId/end-user/products')
  @Public()
  @HttpCode(200)
  async getAvailableVouchersForEndUser(
    @Param('merchantId') merchantId: string,
  ) {
    // Fetch from blockchain marketplace instead of database
    return this.getMarketplaceListingsEndUser.execute(merchantId);
  }

  /**
   * Search voucher codes by merchant and groupId with pagination
   * GET /coupon/search?merchantId=xxx&groupId=xxx&page=1&skip=0&limit=20
   */
  @Get('/search')
  @Public()
  @HttpCode(200)
  async searchVoucherCodesByGroup(
    @Query('merchantId') merchantId: string,
    @Query('groupId') groupId: string,
    @Query('page') page?: string,
    @Query('skip') skip?: string,
    @Query('limit') limit?: string,
  ) {
    if (!merchantId || !groupId) {
      return {
        statusCode: 400,
        message: 'merchantId and groupId are required',
        data: null,
      };
    }

    const pageNum = page ? parseInt(page, 10) : 1;
    const skipNum = skip ? parseInt(skip, 10) : 0;
    const limitNum = limit ? parseInt(limit, 10) : 20;

    return this.voucherService.getVoucherCodesByGroup(
      merchantId,
      groupId,
      pageNum,
      skipNum,
      limitNum,
    );
  }

  /**
   * Get voucher codes by merchant and groupId with pagination
   * GET /coupon/:merchantId/:groupId/products?page=1&skip=0&limit=20
   */
  @Get('/:merchantId/:groupId/products')
  @Public()
  @HttpCode(200)
  async getVoucherCodesByGroup(
    @Param('merchantId') merchantId: string,
    @Param('groupId') groupId: string,
    @Query('page') page?: string,
    @Query('skip') skip?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const skipNum = skip ? parseInt(skip, 10) : 0;
    const limitNum = limit ? parseInt(limit, 10) : 20;

    return this.voucherService.getVoucherCodesByGroup(
      merchantId,
      groupId,
      pageNum,
      skipNum,
      limitNum,
    );
  }

  @Get('/:id')
  @Public()
  @HttpCode(200)
  async getVoucherById(@Param('id') id: string) {
    return this.voucherService.getVoucherById(id);
  }

  @Post('/')
  @HttpCode(201)
  async createVoucher(@Body() data: CreateVoucherDto) {
    // ใช้ handler ที่สร้าง voucher พร้อม codes และ pointsCost
    return this.voucherService.createVoucherWithCodes(data);
  }

  @Delete('/:voucherId')
  @HttpCode(200)
  async deleteVoucher(@Param('voucherId') voucherId: string) {
    return this.voucherService.deleteVoucher(voucherId);
  }

  @Patch('/activate/:voucherId')
  @Public()
  @HttpCode(200)
  async activateVoucher(
    @Param('voucherId') voucherId: string,
    @Body() data: ActivateVoucherDto,
  ) {
    console.log('start');
    return this.voucherService.activateVoucher(voucherId, data);
  }

  @Post('/dev/interim-seller/:merchantId')
  @Public()
  @HttpCode(201)
  async createVoucherByDev(
    @Param('merchantId') merchantId: string,
    @Body() data: CreateVoucherByDevDto,
  ) {
    // สร้าง voucher พร้อมกับ codes ตามจำนวน amount
    return this.voucherService.createVoucherByDev(merchantId, data);
  }

  /**
   * อัปเดต pointsCost ของ VoucherCode ตามจำนวนที่กำหนด
   * POST /coupon/manage/update-price
   * Body: { voucherId: string, amount: number, price: number }
   */
  @Patch('/set-up/:voucherId')
  @HttpCode(200)
  async updateVoucherCodesPrice(
    @Param('voucherId') voucherId: string,
    @Body() data: UpdateVoucherCodesPointCostDto,
  ) {
    return this.manageCouponHandler.updateVoucherCodesPointCost({
      voucherId,
      ...data,
    });
  }

  /**
   * อัปเดต pointsCost ของ VoucherCode ทั้งหมด
   * PATCH /coupon/manage/update-all-price/:voucherId
   * Body: { price: number, name?: string, description?: string, value?: number, endDate?: string }
   */
  @Patch('/set-up-all/:voucherId')
  @HttpCode(200)
  async updateAllVoucherCodesPrice(
    @Param('voucherId') voucherId: string,
    @Body() data: UpdateAllVoucherCodesPointCostDto,
  ) {
    return this.manageCouponHandler.updateAllVoucherCodesPointCost(
      voucherId,
      data.price,
      data.name,
      data.description,
      data.value,
      data.endDate,
    );
  }

  // POST /coupon/redeem moved to ExternalModule
  // POST /coupon/redeem-ais moved to ExternalModule

  /**
   * Validate voucher code before redeem
   * GET /coupon/validate/:code
   */
  @Get('/validate/:code')
  @Public()
  @HttpCode(200)
  async validateVoucherCode(@Param('code') code: string) {
    return this.voucherService.validateVoucherCode(code);
  }

  /**
   * Seller lists vouchers on marketplace with THB as payment token
   * POST /coupon/seller/list-on-marketplace
   * Body: { voucherId: string, amount: number, pricePerUnitTHB: number, sellerWalletAddress: string, name?: string, description?: string }
   */
  @Post('/seller/list-on-marketplace')
  @Public()
  @HttpCode(200)
  async sellerListOnMarketplace(@Body() data: SellerListOnMarketplaceDto) {
    return this.sellerListHandler.execute(
      data.voucherId,
      data.amount,
      data.pricePerUnitTHB,
      data.sellerWalletAddress,
      data.name,
      data.description,
    );
  }

  /**
   * Seller batch lists multiple voucher types on marketplace
   * POST /coupon/seller/batch-list/:merchantId
   * Body: { name?: string, description?: string, items: [{ voucherId, amount, pricePerUnitTHB }] }
   */
  @Post('/seller/batch-list/:merchantId')
  @Public()
  @HttpCode(200)
  async sellerBatchListOnMarketplace(
    @Param('merchantId') merchantId: string,
    @Body() data: BatchListOnMarketplaceDto,
  ) {
    return this.batchListHandler.execute(merchantId, data);
  }

  /**
   * Get all listing batches for a seller
   * GET /coupon/seller/listings?walletAddress=0x...&page=1&limit=20&status=ACTIVE
   */
  @Get('/seller/listings')
  @Public()
  @HttpCode(200)
  async getSellerListings(
    @Query('walletAddress') walletAddress: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    if (!walletAddress) {
      return {
        statusCode: 400,
        message: 'walletAddress is required',
        data: null,
      };
    }

    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    const statusEnum = status as
      | 'ACTIVE'
      | 'SOLD_OUT'
      | 'CANCELLED'
      | 'EXPIRED'
      | undefined;

    return this.getSellerListingsHandler.execute(
      walletAddress,
      pageNum,
      limitNum,
      statusEnum,
    );
  }

  /**
   * Get listing batch detail by ID
   * GET /coupon/seller/listings/:batchId
   */
  @Get('/seller/listings/:batchId')
  @Public()
  @HttpCode(200)
  async getListingBatchDetail(@Param('batchId') batchId: string) {
    return this.getListingBatchDetailHandler.execute(batchId);
  }

  /**
   * Merchant buys coupons from seller using THB token
   * POST /coupon/merchant/buy-from-seller
   * Body: { listingId: string, amount: number, merchantId: string }
   */
  @Post('/merchant/buy-from-seller')
  @Public()
  @HttpCode(200)
  async merchantBuyCouponFromSeller(
    @Body() data: MerchantBuyCouponFromSellerDto,
  ) {
    return this.merchantBuyHandler.execute(
      data.listingId,
      data.amount,
      data.merchantId,
    );
  }

  /**
   * Buy coupon from marketplace (customer buying from marketplace)
   * POST /coupon/marketplace/buy
   * Body: { voucherGroupId: string, pointId: string, phone: string }
   */
  @Post('/marketplace/buy')
  @Public()
  @HttpCode(200)
  async buyCouponFromMarketplace(@Body() data: BuyCouponFromMarketplaceDto) {
    return this.voucherService.buyCouponFromMarketplace(
      data.voucherGroupId,
      data.pointId,
      data.phone,
    );
  }

  /**
   * GET Voucher by Listing ID
   * GET /coupon/coupon-by-listing/:listingId
   */
  @Get('/coupon-by-listing/:listingId')
  @Public()
  @HttpCode(200)
  async getVoucherByListingIds(@Param('listingId') listingId: string) {
    return this.getVoucherByListingId.execute(listingId);
  }

  // GET /coupon/my-coupons/:phone moved to ExternalModule
}
