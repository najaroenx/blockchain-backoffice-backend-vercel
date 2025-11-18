import { Module } from '@nestjs/common';
import { PointController } from './controllers/point.controller';
import { PointRepository } from './point.repository';
import { BlockchainModule } from 'src/providers/blockchain/blockchain.module';
import { PointDBService } from './services/point-db.service';
import { MerchantModule } from '../merchant/merchant.module';
import { GetPointsByMerchantId } from './handlers/getPointsByMerchantId.handler';
import { GetPointById } from './handlers/getPointById.handler';
import { UpdatePoint } from './handlers/updatePoint.handler';
import { CreatePoint } from './handlers/createPoint.handler';
import { DeletePoint } from './handlers/deletePoint.handler';

@Module({
  controllers: [PointController],
  providers: [
    PointRepository,
    PointDBService,
    GetPointsByMerchantId,
    GetPointById,
    UpdatePoint,
    CreatePoint,
    DeletePoint,
  ],
  imports: [BlockchainModule, MerchantModule],
  exports: [UpdatePoint, GetPointById],
})
export class PointModule {}
