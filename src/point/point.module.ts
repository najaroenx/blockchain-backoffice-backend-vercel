import { Module } from '@nestjs/common';
import { PointController } from './point.controller';
import { PointService } from './point.service';
import { PointRepository } from './point.repository';

@Module({
  controllers: [PointController],
  providers: [PointService, PointRepository],
})
export class PointModule {}
