import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { CreateMerchantDto, UpdateMerchantDto } from '../dtos';
import { MerchantFilterDto } from '../../../common/dtos/pagination.dto';

import { GetMerchants } from '../handlers/getMerchants.handler';
import { CreateMerchant } from '../handlers/createMerchant.handler';
import { UpdateMerchant } from '../handlers/updateMerchant.handler';
import { GetMerchant } from '../handlers/getMerchantById.handler';
import { DeleteMerchant } from '../handlers/deleteMerchant.handler';
import { Public } from 'src/modules/auth/public.decorator';
import { MerchantDBService } from '../services/merchant-db.service';

@Controller('merchant')
export class MerchantController {
  constructor(
    private readonly getMerchantsHandler: GetMerchants,
    private readonly createMerchantHandler: CreateMerchant,
    private readonly updateMerchantHandler: UpdateMerchant,
    private readonly getMerchantHandler: GetMerchant,
    private readonly deleteMerchantHandler: DeleteMerchant,
    private readonly merchantDBService: MerchantDBService,
  ) {}

  @Get('/')
  @HttpCode(200)
  async getMerchants(@Req() request: Request) {
    const userId = (request as any).user.id as string;
    return this.getMerchantsHandler.execute(userId);
  }

  @Get('/all')
  @HttpCode(200)
  @Public()
  async getAllMerchants(@Query() filters: MerchantFilterDto) {
    return this.merchantDBService.getAllMerchants(filters);
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

  /**
   * Get all merchants with pagination and filtering
   * GET /merchant/all?page=1&limit=20&name=test&location=bangkok
   * TODO: need implement more use only test
   */
  @Get('/all')
  @Public()
  @HttpCode(200)
  async all(@Query() filters: MerchantFilterDto) {
    return this.merchantDBService.getAllMerchants(filters);
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
