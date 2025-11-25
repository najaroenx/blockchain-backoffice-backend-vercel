import {
  Controller,
  Get,
  HttpCode,
  Query,
} from '@nestjs/common';
import { PointFilterDto } from '../../../common/dtos/pagination.dto';
import { Public } from 'src/modules/auth/public.decorator';
import { PointDBService } from '../services/point-db.service';

@Controller('points')
export class GlobalPointController {
  constructor(private readonly pointDBService: PointDBService) {}

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
}