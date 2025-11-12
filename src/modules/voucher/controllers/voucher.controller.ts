import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Delete,
  Patch,
} from '@nestjs/common';
import { VoucherDBService } from '../services/voucher-db.service';
import {
  CreateVoucherByDevDto,
  CreateVoucherDto,
  UpdateVoucherCodesPointCostDto,
  UpdateAllVoucherCodesPointCostDto,
} from '../dtos';
import { ActivateVoucherDto } from '../dtos/activate-voucher.dto';
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
}
