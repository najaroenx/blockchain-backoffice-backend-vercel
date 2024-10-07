import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Put,
  Post,
} from '@nestjs/common';
import { CreatePointDto, UpdatePointDto } from '../dtos';
import { GetPointsByMerchantId } from '../handlers/getPointsByMerchantId.handler';
import { GetPointById } from '../handlers/getPointById.handler';
import { UpdatePoint } from '../handlers/updatePoint.handler';
import { CreatePoint } from '../handlers/createPoint.handler';

@Controller('/:merchantId/point')
export class PointController {
  constructor(
    private readonly getPointsByMerchantIdHandler: GetPointsByMerchantId,
    private readonly getPointByIdHandler: GetPointById,
    private readonly updatePointHandler: UpdatePoint,
    private readonly createPointHandler: CreatePoint,
  ) {}

  @Get('/')
  @HttpCode(200)
  async getPointsByMerchant(@Param('merchantId') merchantId: string) {
    return this.getPointsByMerchantIdHandler.execute(merchantId);
  }

  @Get('/:pointId')
  async getPointById(@Param('pointId') pointId: string) {
    return this.getPointByIdHandler.execute(pointId);
  }

  @Post('/')
  @HttpCode(201)
  async createPoint(
    @Param('merchantId') merchantId: string,
    @Body() data: CreatePointDto,
  ) {
    return this.createPointHandler.execute(merchantId, data);
  }

  @Put('/:pointId')
  async update(
    @Body() data: UpdatePointDto,
    @Param('pointId') pointId: string,
  ) {
    return this.updatePointHandler.execute(pointId, data);
  }
}
