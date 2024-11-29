import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import { CreateMerchantDto, UpdateMerchantDto } from '../dtos';

import { GetMerchants } from '../handlers/getMerchants.handler';
import { CreateMerchant } from '../handlers/createMerchant.handler';
import { UpdateMerchant } from '../handlers/updateMerchant.handler';
import { GetMerchant } from '../handlers/getMerchantById.handler';
import { DeleteMerchant } from '../handlers/deleteMerchant.handler';

@Controller('merchant')
export class MerchantController {
  constructor(
    private readonly getMerchantsHandler: GetMerchants,
    private readonly createMerchantHandler: CreateMerchant,
    private readonly updateMerchantHandler: UpdateMerchant,
    private readonly getMerchantHandler: GetMerchant,
    private readonly deleteMerchantHandler: DeleteMerchant,
  ) {}

  @Get('/')
  @HttpCode(200)
  async getMerchants(@Req() request: Request) {
    const userId = (request as any).user.id as string;
    return this.getMerchantsHandler.execute(userId);
  }

  @Post('/')
  @HttpCode(201)
  async createMerchant(@Body() body: CreateMerchantDto) {
    const { userId, name, website } = body;

    const data = {
      name,
      website,
    };

    return this.createMerchantHandler.execute(userId, data);
  }

  @Put('/:merchantId')
  @HttpCode(201)
  async update(
    @Body() data: UpdateMerchantDto,
    @Param('merchantId') merchantId: string,
  ) {
    return this.updateMerchantHandler.execute(merchantId, data);
  }

  @Get('/:merchantId')
  @HttpCode(200)
  async getMerchant(@Param('merchantId') merchantId: string) {
    return this.getMerchantHandler.execute(merchantId);
  }

  @Delete('/:merchantId')
  @HttpCode(201)
  async deleteMerchant(@Param('merchantId') merchantId: string) {
    return this.deleteMerchantHandler.execute(merchantId);
  }
}
