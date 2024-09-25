import { Module } from '@nestjs/common';
import { PointController } from './point.controller';
import { PointService } from './point.service';
import { PointRepository } from './point.repository';
import { BlockchainModule } from 'src/providers/blockchain/blockchain.module';

@Module({
  controllers: [PointController],
  providers: [PointService, PointRepository],
  imports: [BlockchainModule],
  exports: [PointService],
})
export class PointModule {}
