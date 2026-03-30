import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from 'src/modules/internal/auth/public.decorator';
import { FixVoucherGroupCollision } from '../handlers/fixVoucherGroupCollision.handler';
import { FixWhitelistHandler } from '../handlers/fixWhitelist.handler';
import { FixRedeemStatusHandler } from '../handlers/fixRedeemStatus.handler';
import { FixBalanceCheckHandler } from '../handlers/fixBalanceCheck.handler';
import { FixSendPointsHandler } from '../handlers/fixSendPoints.handler';
import { FixDeletePurchaseTxHandler } from '../handlers/fixDeletePurchaseTx.handler';
import { FixDeleteRedeemTxHandler } from '../handlers/fixDeleteRedeemTx.handler';
import { FixWalletOnchainHandler } from '../handlers/fixWalletOnchain.handler';

@ApiTags('Fix')
@Controller('fix')
export class FixController {
  constructor(
    private readonly fixVoucherGroupCollision: FixVoucherGroupCollision,
    private readonly fixWhitelist: FixWhitelistHandler,
    private readonly fixRedeemStatus: FixRedeemStatusHandler,
    private readonly fixBalanceCheck: FixBalanceCheckHandler,
    private readonly fixSendPoints: FixSendPointsHandler,
    private readonly fixDeletePurchaseTx: FixDeletePurchaseTxHandler,
    private readonly fixDeleteRedeemTx: FixDeleteRedeemTxHandler,
    private readonly fixWalletOnchain: FixWalletOnchainHandler,
  ) {}

  // ─── Step 1: Whitelist ──────────────────────────────────────────

  /** GET /fix/whitelist/check — Check whitelist status for all DB wallets */
  @Get('/whitelist/check')
  @Public()
  @HttpCode(200)
  async checkWhitelist() {
    return this.fixWhitelist.check();
  }

  /** POST /fix/whitelist/add?dryRun=true — Add non-whitelisted wallets */
  @Post('/whitelist/add')
  @Public()
  @HttpCode(200)
  async addWhitelist(@Query('dryRun') dryRun?: string) {
    return this.fixWhitelist.addAll(dryRun !== 'false');
  }

  // ─── Step 2: Redeem Status ──────────────────────────────────────

  /** GET /fix/redeem-status/:merchantId — Query unredeemed/redeemed coupons */
  @Get('/redeem-status/:merchantId')
  @Public()
  @HttpCode(200)
  async getRedeemStatus(@Param('merchantId') merchantId: string) {
    return this.fixRedeemStatus.execute(merchantId);
  }

  // ─── Step 3: Balance Check ──────────────────────────────────────

  /** GET /fix/balance-check/:merchantId — Check point balances before/after purchase */
  @Get('/balance-check/:merchantId')
  @Public()
  @HttpCode(200)
  async getBalanceCheck(@Param('merchantId') merchantId: string) {
    return this.fixBalanceCheck.execute(merchantId);
  }

  // ─── Step 4 & 4.1: Send Points ─────────────────────────────────

  /**
   * POST /fix/send-points?dryRun=true
   * Body: { merchantId, pointId, customers: [{ phone, amount }] }
   */
  @Post('/send-points')
  @Public()
  @HttpCode(200)
  async sendPoints(
    @Query('dryRun') dryRun?: string,
    @Body() body?: { merchantId: string; pointId: string; customers: { phone: string; amount: number }[] },
  ) {
    return this.fixSendPoints.execute(
      body.merchantId,
      body.pointId,
      body.customers,
      dryRun !== 'false',
    );
  }

  // ─── Step 7: Delete Purchase Transactions ───────────────────────

  /** POST /fix/delete-purchase-transactions/:merchantId?dryRun=true */
  @Post('/delete-purchase-transactions/:merchantId')
  @Public()
  @HttpCode(200)
  async deletePurchaseTransactions(
    @Param('merchantId') merchantId: string,
    @Query('dryRun') dryRun?: string,
  ) {
    return this.fixDeletePurchaseTx.execute(merchantId, dryRun !== 'false');
  }

  // ─── Step 8: Delete Redeem Transactions ─────────────────────────

  /** POST /fix/delete-redeem-transactions/:merchantId?dryRun=true */
  @Post('/delete-redeem-transactions/:merchantId')
  @Public()
  @HttpCode(200)
  async deleteRedeemTransactions(
    @Param('merchantId') merchantId: string,
    @Query('dryRun') dryRun?: string,
  ) {
    return this.fixDeleteRedeemTx.execute(merchantId, dryRun !== 'false');
  }

  // ─── Wallet On-chain Check ──────────────────────────────────────

  /** GET /fix/wallet-onchain/:merchantId?onlyMismatch=false — Compare DB vs on-chain balances */
  @Get('/wallet-onchain/:merchantId')
  @Public()
  @HttpCode(200)
  async checkWalletOnchain(
    @Param('merchantId') merchantId: string,
    @Query('onlyMismatch') onlyMismatch?: string,
  ) {
    return this.fixWalletOnchain.execute(merchantId, onlyMismatch === 'true');
  }

  // ─── VoucherGroupId Collision ───────────────────────────────────

  /** GET /fix/voucher-group-collision/detect */
  @Get('/voucher-group-collision/detect')
  @Public()
  @HttpCode(200)
  async detectVoucherGroupCollision() {
    return this.fixVoucherGroupCollision.detect();
  }

  /** POST /fix/voucher-group-collision/clear-old?dryRun=true */
  @Post('/voucher-group-collision/clear-old')
  @Public()
  @HttpCode(200)
  async clearOldVoucherGroupIds(@Query('dryRun') dryRun?: string) {
    return this.fixVoucherGroupCollision.clearOld(dryRun !== 'false');
  }
}
