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
import { VoucherDBService } from '../services/voucher-db.service';
import {
  CreateVoucherByDevDto,
  CreateVoucherDto,
  UpdateVoucherCodesPointCostDto,
  UpdateAllVoucherCodesPointCostDto,
} from '../dtos';
import { ActivateVoucherDto } from '../dtos/activate-voucher.dto';
import { BuyCouponFromMarketplaceDto } from '../dtos/buy-coupon-marketplace.dto';
import { Public } from 'src/modules/auth/public.decorator';
import { ManageCouponHandler } from '../handlers/manageCoupon.handler';

@Controller('coupon')
export class VoucherController {
  constructor(
    private readonly voucherService: VoucherDBService,
    private readonly manageCouponHandler: ManageCouponHandler,
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

  @Get('/merchant/:merchantId')
  @Public()
  @HttpCode(200)
  async getVouchersByMerchant(@Param('merchantId') merchantId: string) {
    return this.voucherService.getVouchersByMerchant(merchantId);
  }

  /**
   * Get available vouchers for end users with pagination
   * GET /coupon/:merchantId/products?page=1&skip=0&limit=20
   */
  @Get('/:merchantId/products')
  @Public()
  @HttpCode(200)
  async getAvailableVouchersForCustomers(
    @Param('merchantId') merchantId: string,
    @Query('page') page?: string,
    @Query('skip') skip?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const skipNum = skip ? parseInt(skip, 10) : 0;
    const limitNum = limit ? parseInt(limit, 10) : 20;

    return this.voucherService.getAvailableVouchersForCustomers(
      merchantId,
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
   * Body: { code: string, customerId: string }
   */
  @Post('/redeem')
  @Public()
  @HttpCode(200)
  async redeemVoucher(@Body() data: { code: string; customerId: string }) {
    return this.voucherService.redeemVoucher(data.code, data.customerId);
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
  // @Get('/history/:walletAddress')
  // @Public()
  // @HttpCode(200)
  // async getRedemptionHistory(@Param('walletAddress') walletAddress: string) {
  //   return this.voucherService.getRedemptionHistory(walletAddress);
  // }

  /**
   * Buy coupon from marketplace (customer buying from marketplace)
   * POST /coupon/marketplace/buy
   * Body: { voucherGroupId: string, pointId: string, address: string, customerId: string }
   */
  @Post('/marketplace/buy')
  @Public()
  @HttpCode(200)
  async buyCouponFromMarketplace(@Body() data: BuyCouponFromMarketplaceDto) {
    return this.voucherService.buyCouponFromMarketplace(
      data.voucherGroupId,
      data.pointId,
      data.address,
      data.phone,
    );
  }

  /**
   * Get vouchers owned by customer
   * GET /coupon/my-vouchers/:walletAddress
   * Query params: ?status=unused|used|all&page=1&limit=20
   */
  @Get('/my-coupons/:walletAddress')
  @Public()
  @HttpCode(200)
  async getCustomerOwnedVouchers(
    @Param('walletAddress') walletAddress: string,
    @Query('status') status?: 'unused' | 'used' | 'all',
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;

    return this.voucherService.getCustomerOwnedVouchers(
      walletAddress,
      status || 'all',
      pageNum,
      limitNum,
    );
  }
}
