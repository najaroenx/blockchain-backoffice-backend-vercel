import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import {
  CreateMerchantDto,
  UpdateMerchantDto,
  UpdateMerchantStatusDto,
} from '../dtos';
import { MerchantFilterDto } from '../../../../common/dtos/pagination.dto';

import { GetMerchants } from '../handlers/getMerchants.handler';
import { CreateMerchant } from '../handlers/createMerchant.handler';
import { UpdateMerchant } from '../handlers/updateMerchant.handler';
import { GetMerchant } from '../handlers/getMerchantById.handler';
import { DeleteMerchant } from '../handlers/deleteMerchant.handler';
import { GetMerchantDashboardStats } from '../handlers/getMerchantDashboardStats.handler';
import { Public } from 'src/modules/internal/auth/public.decorator';
import { MerchantDBService } from '../services/merchant-db.service';

@Controller('merchant')
export class MerchantController {
  constructor(
    private readonly getMerchantsHandler: GetMerchants,
    private readonly createMerchantHandler: CreateMerchant,
    private readonly updateMerchantHandler: UpdateMerchant,
    private readonly getMerchantHandler: GetMerchant,
    private readonly deleteMerchantHandler: DeleteMerchant,
    private readonly getMerchantDashboardStatsHandler: GetMerchantDashboardStats,
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

  @Patch('/:merchantId/status')
  @Public()
  @HttpCode(200)
  async updateStatus(
    @Param('merchantId') merchantId: string,
    @Body() data: UpdateMerchantStatusDto,
  ) {
    return this.updateMerchantHandler.execute(merchantId, {
      status: data.status,
    });
  }

  /**
   * Get merchant dashboard statistics
   * GET /merchant/:merchantId/dashboard-stats
   * Returns comprehensive statistics including vouchers, end users, transactions, points, and THB token
   */
  @Get('/:merchantId/dashboard-stats')
  @Public()
  @HttpCode(200)
  async getDashboardStats(@Param('merchantId') merchantId: string) {
    return this.getMerchantDashboardStatsHandler.execute(merchantId);
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
