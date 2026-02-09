import { Module } from '@nestjs/common';
import { PointController } from './controllers/point.controller';
// GlobalPointController moved to ExternalModule
import { PointRepository } from './point.repository';
import { BlockchainModule } from 'src/providers/blockchain/blockchain.module';
import { PointDBService } from './services/point-db.service';
import { MerchantModule } from '../merchant/merchant.module';
import { GetPointsByMerchantId } from './handlers/getPointsByMerchantId.handler';
import { GetPointById } from './handlers/getPointById.handler';
import { GetPointByPhone } from './handlers/getPointByPhone.handler';
import { UpdatePoint } from './handlers/updatePoint.handler';
import { CreatePoint } from './handlers/createPoint.handler';
import { DeletePoint } from './handlers/deletePoint.handler';
import { PrismaModule } from 'prisma/prisma.module';

@Module({
  controllers: [PointController],
  providers: [
    PointRepository,
    PointDBService,
    GetPointsByMerchantId,
    GetPointById,
    GetPointByPhone,
    UpdatePoint,
    CreatePoint,
    DeletePoint,
  ],
  imports: [BlockchainModule, MerchantModule, PrismaModule],
  exports: [UpdatePoint, GetPointById, GetPointByPhone, PointDBService],
})
export class PointModule {}
