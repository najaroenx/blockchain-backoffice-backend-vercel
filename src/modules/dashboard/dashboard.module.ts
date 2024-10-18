import { Module } from '@nestjs/common';
import { DashboardController } from './controllers/dashboard.controller';
import { DashboardService } from './handlers/dashboard.handler';
import { CustomerModule } from '../customer/customer.module';
import { TransactionModule } from '../transaction/transaction.module';

@Module({
  controllers: [DashboardController],
  providers: [DashboardService],
  imports: [CustomerModule, TransactionModule],
})
export class DashboardModule {}
