import { Module } from '@nestjs/common';
import { PointController } from './point.controller';
import { PointService } from './point.service';
import { PointRepository } from './point.repository';
import { BlockchainModule } from 'src/providers/blockchain/blockchain.module';
import { TransactionModule } from 'src/transaction/transaction.module';

@Module({
  controllers: [PointController],
  providers: [PointService, PointRepository],
  imports: [BlockchainModule, TransactionModule],
})
export class PointModule {}
