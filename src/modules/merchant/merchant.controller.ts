import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { MerchantService } from './merchant.service';
import { CreateMerchantsDto } from './dtos';

@Controller('merchant')
export class MerchantController {
  constructor(private readonly merchantService: MerchantService) {}

  @Get('/')
  @HttpCode(200)
  async getMerchants(@Req() request: Request) {
    const userId = (request as any).user.id as string;
    return this.merchantService.getMerchants(userId);
  }

  @Post('/')
  @HttpCode(201)
  async createMerchant(@Body() body: CreateMerchantsDto) {
    const { userId, name, website } = body;

    return this.merchantService.createMerchant({
      userId,
      name,
      website,
    });
  }
}
