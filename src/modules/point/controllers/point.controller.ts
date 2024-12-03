import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Put,
  Post,
  Delete,
} from '@nestjs/common';
import {
  CreatePointDto,
  DeletePointParams,
  GetPointByIdParams,
  UpdatePointDto,
} from '../dtos';
import { GetPointsByMerchantId } from '../handlers/getPointsByMerchantId.handler';
import { GetPointById } from '../handlers/getPointById.handler';
import { UpdatePoint } from '../handlers/updatePoint.handler';
import { CreatePoint } from '../handlers/createPoint.handler';
import { DeletePoint } from '../handlers/deletePoint.handler';

@Controller('/:merchantId/point')
export class PointController {
  constructor(
    private readonly getPointsByMerchantIdHandler: GetPointsByMerchantId,
    private readonly getPointByIdHandler: GetPointById,
    private readonly updatePointHandler: UpdatePoint,
    private readonly createPointHandler: CreatePoint,
    private readonly deletePointHandler: DeletePoint,
  ) {}

  @Get('/')
  @HttpCode(200)
  async getPointsByMerchant(@Param('merchantId') merchantId: string) {
    return this.getPointsByMerchantIdHandler.execute(merchantId);
  }

  @Get('/:pointId')
  @HttpCode(200)
  async getPointById(@Param() params: GetPointByIdParams) {
    const { merchantId, pointId } = params;
    return this.getPointByIdHandler.execute(pointId, merchantId);
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
    return this.updatePointHandler.execute(pointId, data);
  }

  @Delete('/:id')
  @HttpCode(201)
  async deletePoint(@Param() params: DeletePointParams) {
    const { merchantId, id } = params;

    return this.deletePointHandler.execute(id, merchantId);
  }
}
