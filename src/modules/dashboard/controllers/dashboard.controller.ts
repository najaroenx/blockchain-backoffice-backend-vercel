import { Controller, Get, HttpCode, Param } from '@nestjs/common';
import { DashboardService } from '../handlers/dashboard.handler';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('/:merchantId')
  @HttpCode(200)
  async getData(@Param('merchantId') merchantId: string) {
    return this.dashboardService.execute(merchantId);
  }
}
