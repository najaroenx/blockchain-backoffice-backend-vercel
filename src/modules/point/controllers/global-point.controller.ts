import { Controller, Get, HttpCode, Param, Query } from '@nestjs/common';
import { PointFilterDto } from '../../../common/dtos/pagination.dto';
import { Public } from 'src/modules/auth/public.decorator';
import { PointDBService } from '../services/point-db.service';
import { GetPointById } from '../handlers/getPointById.handler';
import { GetPointByIdParams } from '../dtos';

@Controller('points')
export class GlobalPointController {
  constructor(
    private readonly pointDBService: PointDBService,
    private readonly getPointByIdHandler: GetPointById,
  ) {}

  /**
   * Get all points with pagination and filtering
   * GET /points/all?page=1&limit=20&name=gold&symbol=GOLD&merchantName=store
   */
  @Get('/all')
  @Public()
  @HttpCode(200)
  async getAllPoints(@Query() filters: PointFilterDto) {
    return this.pointDBService.getAllPoints(filters);
  }

  /**
   * Get point by ID
   * GET /points/:pointId
   */
  @Get('/:pointId')
  @Public()
  @HttpCode(200)
  async getPointById(@Param() params: GetPointByIdParams) {
    const { pointId } = params;
    return this.getPointByIdHandler.execute(pointId);
  }
}
