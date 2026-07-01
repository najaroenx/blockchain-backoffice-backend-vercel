import { TransferVoucherToCustomerHandler } from '../handlers/transferVoucherToCustomer.handler';
import { BatchTransferVoucherToCustomerHandler } from '../handlers/batchTransferVoucherToCustomer.handler';
import { PreviewBatchTransferCsvHandler } from '../handlers/previewBatchTransferCsv.handler';
import { ExecuteBatchTransferCsvHandler } from '../handlers/executeBatchTransferCsv.handler';
import { GetMarketerTransferHistoryHandler } from '../handlers/getMarketerTransferHistory.handler';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Logger,
  Param,
  Post,
  Delete,
  Patch,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { VoucherDBService } from '../services/voucher-db.service';
import {
  CreateVoucherByDevDto,
  CreateVoucherDto,
  UpdateVoucherCodesPointCostDto,
  UpdateAllVoucherCodesPointCostDto,
  TransferVoucherToCustomerDto,
} from '../dtos';
import { BatchTransferVoucherDto } from '../dtos/batch-transfer-voucher.dto';
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
import { DelistMarketplaceListingHandler } from '../handlers/delistMarketplaceListing.handler';

@ApiTags('Voucher')
@Controller('coupon')
export class VoucherController {
  private readonly logger = new Logger(VoucherController.name);

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
    private readonly transferVoucherToCustomerHandler: TransferVoucherToCustomerHandler,
    private readonly batchTransferVoucherToCustomerHandler: BatchTransferVoucherToCustomerHandler,
    private readonly previewBatchTransferCsvHandler: PreviewBatchTransferCsvHandler,
    private readonly executeBatchTransferCsvHandler: ExecuteBatchTransferCsvHandler,
    private readonly getMarketerTransferHistoryHandler: GetMarketerTransferHistoryHandler,
    private readonly delistMarketplaceListingHandler: DelistMarketplaceListingHandler,
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

  @Get('transfer/batch/history')
  @Public()
  @HttpCode(200)
  @ApiOperation({ summary: 'Get batch transfer upload history for a merchant' })
  async getBatchTransferHistory(
    @Query('merchantId') merchantId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? Number.parseInt(page, 10) : 1;
    const limitNum = limit ? Number.parseInt(limit, 10) : 10;
    return this.getMarketerTransferHistoryHandler.execute(
      merchantId,
      pageNum,
      limitNum,
    );
  }

  @Get('transfer/batch/template-en')
  @Public()
  @HttpCode(200)
  @ApiOperation({ summary: 'Download English CSV Template for batch transfer' })
  async downloadTemplateEn() {
    return {
      success: true,
      headers: ['Sequence Number', 'Phone Number', 'Voucher ID', 'Quantity'],
      exampleRow: [
        1,
        '0809760286',
        'COUPON-95ed24b5-116f-46b7-9072-4b3287acce98',
        1,
      ],
      csvTemplateUrl: '/coupon/transfer/batch/static-template/en',
    };
  }

  @Get('transfer/batch/template-th')
  @Public()
  @HttpCode(200)
  @ApiOperation({ summary: 'Download Thai CSV Template for batch transfer' })
  async downloadTemplateTh() {
    return {
      success: true,
      headers: ['เลขอ้างอิง', 'เบอร์โทรศัพท์ลูกค้า', 'รหัสคูปอง', 'จำนวน'],
      exampleRow: [
        1,
        '0809760286',
        'COUPON-95ed24b5-116f-46b7-9072-4b3287acce98',
        1,
      ],
      csvTemplateUrl: '/coupon/transfer/batch/static-template/th',
    };
  }

  @Get('transfer/batch/static-template/en')
  @Public()
  @HttpCode(200)
  @ApiOperation({ summary: 'Static direct download of English CSV template' })
  async staticTemplateEn() {
    return 'Sequence Number,Phone Number,Voucher ID,Quantity\n1,0809760286,COUPON-95ed24b5-116f-46b7-9072-4b3287acce98,1\n2,0812345678,COUPON-95ed24b5-116f-46b7-9072-4b3287acce98,2\n3,0855554444,COUPON-6a7b8c9d-1111-2222-3333-444455556666,5\n';
  }

  @Get('transfer/batch/static-template/th')
  @Public()
  @HttpCode(200)
  @ApiOperation({ summary: 'Static direct download of Thai CSV template' })
  async staticTemplateTh() {
    return 'เลขอ้างอิง,เบอร์โทรศัพท์ลูกค้า,รหัสคูปอง,จำนวน\n1,0809760286,COUPON-95ed24b5-116f-46b7-9072-4b3287acce98,1\n2,0812345678,COUPON-95ed24b5-116f-46b7-9072-4b3287acce98,2\n3,0855554444,COUPON-6a7b8c9d-1111-2222-3333-444455556666,5\n';
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
    const pageNum = page ? Number.parseInt(page, 10) : undefined;
    const limitNum = limit ? Number.parseInt(limit, 10) : undefined;
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
   * Get marketer inventory with optional status filter
   * GET /coupon/marketer/:merchantId/inventory?status=upcoming
   */
  @Get('/marketer/:merchantId/inventory')
  @Public()
  @HttpCode(200)
  async getMarketerInventory(
    @Param('merchantId') merchantId: string,
    @Query('status') status?: string,
  ) {
    return this.voucherService.getMarketerInventory(merchantId, status);
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

    const pageNum = page ? Number.parseInt(page, 10) : 1;
    const skipNum = skip ? Number.parseInt(skip, 10) : 0;
    const limitNum = limit ? Number.parseInt(limit, 10) : 20;

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
    const pageNum = page ? Number.parseInt(page, 10) : 1;
    const skipNum = skip ? Number.parseInt(skip, 10) : 0;
    const limitNum = limit ? Number.parseInt(limit, 10) : 20;

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
  async getVoucherById(
    @Param('id') id: string,
    @Query('status') codeStatus?: 'used' | 'unused',
  ) {
    return this.voucherService.getVoucherById(id, codeStatus);
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
    this.logger.log('start activateVoucher');
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

    const pageNum = page ? Number.parseInt(page, 10) : 1;
    const limitNum = limit ? Number.parseInt(limit, 10) : 20;
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

  @Post('transfer')
  @Public()
  @ApiOperation({ summary: 'Transfer voucher directly to customer' })
  async transferVoucher(
    @Body()
    dto: TransferVoucherToCustomerDto,
  ) {
    return this.transferVoucherToCustomerHandler.execute(dto);
  }

  @Post('transfer/batch')
  @Public()
  @ApiOperation({
    summary: 'Transfer multiple vouchers directly to multiple customers',
  })
  async transferVouchersBatch(
    @Body()
    dto: BatchTransferVoucherDto,
  ) {
    return this.batchTransferVoucherToCustomerHandler.execute(dto);
  }

  @Post('transfer/batch/preview-csv')
  @Public()
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(200)
  @ApiOperation({
    summary: 'Upload and preview coupon direct transfers from CSV',
    description:
      'พาร์สและตรวจสอบข้อมูลความสอดคล้อง/ความต้องการของลูกค้าและคลังสินค้า เพื่อแสดง Preview และข้อผิดพลาดระดับ Row',
  })
  async previewVouchersBatchCsv(
    @Query('merchantId') queryMerchantId: string,
    @Body('merchantId') bodyMerchantId: string,
    @UploadedFile() file: any,
  ) {
    const merchantId = queryMerchantId || bodyMerchantId;
    return this.previewBatchTransferCsvHandler.execute(merchantId, file);
  }

  @Post('transfer/batch/execute-csv')
  @Public()
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(201)
  @ApiOperation({
    summary: 'Upload and execute coupon direct transfers from CSV',
    description:
      'พาร์สและดำเนินการโอน NFT คูปองลงบล็อกเชนพร้อมสลับสิทธิ์ข้อมูลในระบบจริง และบันทึกประวัติลงตาราง BatchTransferLog',
  })
  async executeVouchersBatchCsv(
    @Query('merchantId') queryMerchantId: string,
    @Body('merchantId') bodyMerchantId: string,
    @UploadedFile() file: any,
  ) {
    const merchantId = queryMerchantId || bodyMerchantId;
    return this.executeBatchTransferCsvHandler.execute(merchantId, file);
  }

  @Post('marketplace/delist/:listingId')
  @ApiOperation({ summary: 'Delist a coupon from marketplace' })
  async delistCoupon(
    @Param('listingId') listingId: string,
    @Body() dto: { merchantId: string },
  ) {
    return this.delistMarketplaceListingHandler.execute(
      listingId,
      dto.merchantId,
    );
  }
}
