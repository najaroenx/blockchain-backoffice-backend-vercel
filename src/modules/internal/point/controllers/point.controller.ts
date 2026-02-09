import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Put,
  Post,
  Delete,
  Query,
} from '@nestjs/common';
import { CreatePointDto, DeletePointParams, UpdatePointDto } from '../dtos';
import { GetPointsByMerchantId } from '../handlers/getPointsByMerchantId.handler';
import { UpdatePoint } from '../handlers/updatePoint.handler';
import { CreatePoint } from '../handlers/createPoint.handler';
import { DeletePoint } from '../handlers/deletePoint.handler';

@Controller('/:merchantId/point')
export class PointController {
  constructor(
    private readonly getPointsByMerchantIdHandler: GetPointsByMerchantId,
    private readonly updatePointHandler: UpdatePoint,
    private readonly createPointHandler: CreatePoint,
    private readonly deletePointHandler: DeletePoint,
  ) {}

  @Get('/')
  @HttpCode(200)
  async getPointsByMerchant(
    @Param('merchantId') merchantId: string,
    @Query() query: Record<string, any>,
  ) {
    return this.getPointsByMerchantIdHandler.execute(merchantId, query);
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
  @HttpCode(201)
  async update(
    @Body() data: UpdatePointDto,
    @Param('pointId') pointId: string,
  ) {
    // Convert Unix timestamps to Date objects
    const prismaData: any = {
      ...data,
      ...(data.startDate ? { startDate: new Date(data.startDate * 1000) } : {}),
      ...(data.endDate ? { endDate: new Date(data.endDate * 1000) } : {}),
    };

    return this.updatePointHandler.execute(pointId, prismaData);
  }

  @Delete('/:id')
  @HttpCode(201)
  async deletePoint(@Param() params: DeletePointParams) {
    const { merchantId, id } = params;

    return this.deletePointHandler.execute(id, merchantId);
  }
}
