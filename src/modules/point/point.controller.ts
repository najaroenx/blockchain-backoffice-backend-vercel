import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Put,
  Post,
} from '@nestjs/common';
import { PointService } from './point.service';
import { CreatePointDto, UpdatePointDto } from './dto';

@Controller('/:merchantId/point')
export class PointController {
  constructor(private readonly pointService: PointService) {}

  @Get('/')
  @HttpCode(200)
  async getPointsByMerchant(@Param('merchantId') merchantId: string) {
    return this.pointService.getPointsByMerchant(merchantId);
  }

  @Get('/:pointId')
  async getPointById(@Param('pointId') pointId: string) {
    return this.pointService.getPointById(pointId);
  }

  @Post('/')
  @HttpCode(201)
  async createPoint(
    @Param('merchantId') merchantId: string,
    @Body() data: CreatePointDto,
  ) {
    return this.pointService.createPoint(merchantId, data);
  }

  @Put('/:pointId')
  async update(
    @Body() data: UpdatePointDto,
    @Param('pointId') pointId: string,
  ) {
    return this.pointService.updatePoint(pointId, data);
  }
}
