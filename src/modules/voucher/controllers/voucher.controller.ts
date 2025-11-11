import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Put,
  Post,
  Delete,
} from '@nestjs/common';
import { VoucherDBService } from '../services/voucher-db.service';
import {
  CreateVoucherByDevDto,
  CreateVoucherDto,
  UpdateVoucherDto,
} from '../dtos';
import { Public } from 'src/modules/auth/public.decorator';

@Controller('voucher')
export class VoucherController {
  constructor(private readonly voucherService: VoucherDBService) {}

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
  @HttpCode(200)
  async getVouchersByMerchant(@Param('merchantId') merchantId: string) {
    return this.voucherService.getVouchersByMerchant(merchantId);
  }

  @Get('/:voucherId')
  @HttpCode(200)
  async getVoucherById(@Param('voucherId') voucherId: string) {
    return this.voucherService.getVoucherById(voucherId);
  }

  @Post('/')
  @HttpCode(201)
  async createVoucher(@Body() data: CreateVoucherDto) {
    return this.voucherService.createVoucher({
      ...data,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
    });
  }

  @Put('/:voucherId')
  @HttpCode(200)
  async updateVoucher(
    @Param('voucherId') voucherId: string,
    @Body() data: UpdateVoucherDto,
  ) {
    const updateData: any = { ...data };
    if (data.startDate) {
      updateData.startDate = new Date(data.startDate);
    }
    if (data.endDate) {
      updateData.endDate = new Date(data.endDate);
    }
    return this.voucherService.updateVoucher(voucherId, updateData);
  }

  @Delete('/:voucherId')
  @HttpCode(200)
  async deleteVoucher(@Param('voucherId') voucherId: string) {
    return this.voucherService.deleteVoucher(voucherId);
  }

  @Post('/dev/interim-seller')
  @Public()
  @HttpCode(201)
  async createVoucherByDev(@Body() data: CreateVoucherByDevDto) {
    // สร้าง voucher พร้อมกับ codes ตามจำนวน amount
    return this.voucherService.createVoucherByDev(data);
  }
}
