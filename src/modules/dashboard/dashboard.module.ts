import { Module } from '@nestjs/common';
import { DashboardController } from './controllers/dashboard.controller';
import { DashboardService } from './handlers/dashboard.handler';
import { PrismaModule } from 'prisma/prisma.module';
import { TransactionModule } from '../transaction/transaction.module';

@Module({
  controllers: [DashboardController],
  providers: [DashboardService],
  imports: [PrismaModule, TransactionModule],
})
export class DashboardModule {}
