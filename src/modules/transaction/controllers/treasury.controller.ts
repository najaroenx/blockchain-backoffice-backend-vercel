import { Controller, Get, HttpCode, Param } from '@nestjs/common';
import { GetTreasuryBalance } from '../handlers/getTreasuryBalance.handler';
import { ListTreasuries } from '../handlers/listTreasuries.handler';
import { Public } from 'src/modules/auth/public.decorator';

@Controller('/treasury')
export class TreasuryController {
  constructor(
    private readonly getTreasuryBalance: GetTreasuryBalance,
    private readonly listTreasuries: ListTreasuries,
  ) {}

  @Get('/list')
  @Public()
  @HttpCode(200)
  async getAllTreasuries() {
    return this.listTreasuries.execute();
  }

  @Get('/:treasuryType/:pointId/balance')
  @Public()
  @HttpCode(200)
  async getTreasuryBalanceForPoint(
    @Param('treasuryType') treasuryType: string,
    @Param('pointId') pointId: string,
  ) {
    return this.getTreasuryBalance.execute(pointId, treasuryType);
  }
}
