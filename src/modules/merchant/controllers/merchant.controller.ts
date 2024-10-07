import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { CreateMerchantsDto } from '../dtos';

import { GetMerchants } from '../handlers/getMerchants.handler';
import { CreateMerchant } from '../handlers/createMerchant.handler';

@Controller('merchant')
export class MerchantController {
  constructor(
    private readonly getMerchantsHandler: GetMerchants,
    private readonly createMerchantHandler: CreateMerchant,
  ) {}

  @Get('/')
  @HttpCode(200)
  async getMerchants(@Req() request: Request) {
    const userId = (request as any).user.id as string;
    return this.getMerchantsHandler.execute(userId);
  }

  @Post('/')
  @HttpCode(201)
  async createMerchant(@Body() body: CreateMerchantsDto) {
    const { userId, name, website } = body;

    const data = {
      name,
      website,
    };

    return this.createMerchantHandler.execute(userId, data);
  }
}
