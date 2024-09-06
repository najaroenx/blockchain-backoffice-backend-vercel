import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { PointService } from './point.service';
import { GetPointsDto, CreatePointDto } from './dtos';

@Controller('point')
export class PointController {
  constructor(private readonly pointService: PointService) {}

  @Get('/:userId')
  @HttpCode(200)
  async getPoints(@Param() params: GetPointsDto) {
    const { userId } = params;
    return this.pointService.getPoints(userId);
  }

  @Post('/')
  @HttpCode(201)
  async createPoint(@Body() body: CreatePointDto) {
    const {
      name,
      symbol,
      merchantId,
      initialSupply,
      slotSize,
      frameSize,
      decimal,
    } = body;

    return this.pointService.createPoint({
      name,
      symbol,
      merchantId,
      initialSupply,
      slotSize,
      frameSize,
      decimal,
    });
  }
}
