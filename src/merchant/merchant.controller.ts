import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { MerchantService } from './merchant.service';
import { CreateMerchantsDto, GetMerchantsDto } from './dtos';

@Controller('merchant')
export class MerchantController {
  constructor(private readonly merchantService: MerchantService) {}

  @Get('/:userId')
  @HttpCode(200)
  async getMerchants(@Param() params: GetMerchantsDto) {
    const { userId } = params;
    return this.merchantService.getMerchants(userId);
  }

  @Post('/')
  @HttpCode(201)
  async createMerchant(@Body() body: CreateMerchantsDto) {
    const { userId, name, website, lineOfficialId } = body;

    return this.merchantService.createMerchant({
      userId,
      name,
      website,
      lineOfficialId,
    });
  }
}
