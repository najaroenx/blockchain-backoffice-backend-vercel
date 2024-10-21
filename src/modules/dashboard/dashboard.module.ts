import { Module } from '@nestjs/common';
import { DashboardController } from './controllers/dashboard.controller';
import { DashboardService } from './handlers/dashboard.handler';
import { PrismaModule } from 'prisma/prisma.module';

@Module({
  controllers: [DashboardController],
  providers: [DashboardService],
  imports: [PrismaModule],
})
export class DashboardModule {}
