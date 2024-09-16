import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { PointService } from './point.service';
import {
  GetPointsDto,
  CreatePointDto,
  RedeemPointsDto,
  RedeemPointBodyDto,
} from './dtos';

@Controller('point')
export class PointController {
  constructor(private readonly pointService: PointService) {}

  @Get('/:merchantId')
  @HttpCode(200)
  async getPoints(@Param() params: GetPointsDto) {
    const { merchantId } = params;
    return this.pointService.getPoints(merchantId);
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

  @Post('/redeem/:merchantId/point/:pointId')
  @HttpCode(200)
  async redeemPoint(
    @Param() params: RedeemPointsDto,
    @Body() body: RedeemPointBodyDto,
  ) {
    const { merchantId, pointId } = params;

    const { receiverAddress, transactionTypeId, amount, email } = body;

    return this.pointService.transaction({
      merchantId,
      amount,
      pointId,
      receiverAddress,
      transactionTypeId,
      email,
    });
  }
}
