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
import { Public } from 'src/modules/auth/public.decorator';

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
  @Public()
  async createMerchant(@Body() body: CreateMerchantDto) {
    const {
      userId,
      name,
      website,
      tel,
      description,
      imageUrl,
      points,
      location,
      voucherIds,
      walletId,
    } = body;

    const data = {
      name,
      website,
      tel,
      ...(description && { description }),
      ...(imageUrl && { imageUrl }),
      ...(points !== undefined && { points }),
      ...(location && { location }),
      ...(voucherIds && { voucherIds }),
      ...(walletId && { walletId }),
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
  @Public()
  @HttpCode(200)
  async getMerchant(@Param('merchantId') merchantId: string) {
    return this.getMerchantHandler.execute(merchantId);
  }

  @Public()
  @Delete('/:merchantId')
  @HttpCode(200)
  async deleteMerchant(@Param('merchantId') merchantId: string) {
    return this.deleteMerchantHandler.execute(merchantId);
  }
}
