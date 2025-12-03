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
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
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
import {
  AddToWhitelistDto,
  BatchAddToWhitelistDto,
} from '../dtos/add-to-whitelist.dto';
import { Public } from 'src/modules/auth/public.decorator';
import { GetMarketplaceListings } from '../handlers/getMarketplaceListings.handler';
import { ManageCouponHandler } from '../handlers/manageCoupon.handler';
import { MerchantBuyCouponFromSeller } from '../handlers/merchantBuyCouponFromSeller.handler';
import { SellerListOnMarketplace } from '../handlers/sellerListOnMarketplace.handler';
import { GetSellerVouchers } from '../handlers/getSellerVouchers.handler';
import { AddToWhitelist } from '../handlers/addToWhitelist.handler';
import { GetVoucherByListingId } from '../handlers/getVoucherByListingId.handler';
import { VoucherValueType } from '@prisma/client';

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
    private readonly addToWhitelistHandler: AddToWhitelist,
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

  @Get('/merchant/:merchantId')
  @Public()
  @HttpCode(200)
  async getVouchersByMerchant(@Param('merchantId') merchantId: string) {
    return this.voucherService.getVouchersByMerchant(merchantId);
  }

  /**
   * Get seller vouchers (vouchers not yet purchased by merchants)
   * GET /coupon/seller/vouchers
   * Optional query param: walletAddress for filtering by seller
   */
  @Get('/seller/vouchers')
  @Public()
  @HttpCode(200)
  async getSellerVouchers(@Query('walletAddress') walletAddress?: string) {
    return this.getSellerVouchersHandler.execute(walletAddress);
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

  @Get('/:voucherId')
  @Public()
  @HttpCode(200)
  async getVoucherById(@Param('voucherId') voucherId: string) {
    return this.voucherService.getVoucherById(voucherId);
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

  @Post('/dev/interim-seller')
  @Public()
  @HttpCode(201)
  async createVoucherByDev(@Body() data: CreateVoucherByDevDto) {
    // สร้าง voucher พร้อมกับ codes ตามจำนวน amount
    return this.voucherService.createVoucherByDev(data);
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

  /**
   * ดึงสถิติของ VoucherCode
   * GET /coupon/manage/statistics/:voucherId
   */
  @Get('/statistics/:voucherId')
  @Public()
  @HttpCode(200)
  async getVoucherCodesStatistics(@Param('voucherId') voucherId: string) {
    return this.manageCouponHandler.getVoucherCodesStatistics(voucherId);
  }

  /**
   * Redeem voucher code
   * POST /coupon/redeem
   * Body: { code: string, phone: string, merchantRef: string, eventId?: string }
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
        eventId: {
          type: 'string',
          example: 'event-2025-concert',
          description: 'รหัส event (สำหรับติดตามการใช้งาน)',
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
      eventId?: string;
    },
  ) {
    return this.voucherService.redeemVoucher(
      data.code,
      data.phone,
      data.merchantRef,
      data.eventId,
    );
  }

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
   * Get customer redemption history
   * GET /coupon/history/:walletAddress
   */
  @Get('/history/:walletAddress')
  @Public()
  @HttpCode(200)
  async getRedemptionHistory(@Param('walletAddress') walletAddress: string) {
    return this.voucherService.getRedemptionHistory(walletAddress);
  }

  /**
   * Seller lists vouchers on marketplace with THB as payment token
   * POST /coupon/seller/list-on-marketplace
   * Body: { voucherId: string, amount: number, pricePerUnitTHB: number, sellerWalletAddress: string }
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
    );
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
   * Get vouchers owned by customer (lookup by phone -> wallet)
   * GET /coupon/my-coupons/:phone
   * Query params: ?status=unused|used|all&page=1&limit=20
   */
  @Get('/my-coupons/:phone')
  @Public()
  @HttpCode(200)
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
   * Get on-chain coupon balances for customer (by phone -> wallet)
   * GET /coupon/my-coupons/onchain/:phone
   */
  @Get('/my-coupons/onchain/:phone')
  @Public()
  @HttpCode(200)
  async getCustomerOnChainBalances(@Param('phone') phone: string) {
    return this.voucherService.getCustomerOnChainBalances(phone);
  }

  /**
   * Manual whitelist single address
   * POST /coupon/admin/whitelist
   * Body: { address: string }
   */
  @Post('/admin/whitelist')
  @Public()
  @HttpCode(200)
  async addToWhitelist(@Body() body: AddToWhitelistDto) {
    return this.addToWhitelistHandler.execute(body.address);
  }

  /**
   * Manual whitelist multiple addresses
   * POST /coupon/admin/whitelist/batch
   * Body: { addresses: string[] }
   */
  @Post('/admin/whitelist/batch')
  @Public()
  @HttpCode(200)
  async batchAddToWhitelist(@Body() body: BatchAddToWhitelistDto) {
    return this.addToWhitelistHandler.executeBatch(body.addresses);
  }

  /**
   * Check whitelist status
   * GET /coupon/admin/whitelist/:address
   */
  @Get('/admin/whitelist/:address')
  @Public()
  @HttpCode(200)
  async checkWhitelistStatus(@Param('address') address: string) {
    return this.addToWhitelistHandler.checkStatus(address);
  }

  /**
   * GET Voucher by Listing ID
   * GET /coupon/admin/whitelist/:address
   */
  @Get('/coupon-by-listing/:listingId')
  @Public()
  @HttpCode(200)
  async getVoucherByListingIds(@Param('listingId') listingId: string) {
    return this.getVoucherByListingId.execute(listingId);
  }
}
