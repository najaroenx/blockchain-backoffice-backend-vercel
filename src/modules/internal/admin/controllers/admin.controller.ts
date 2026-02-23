import { Controller, Post, Body, Logger } from '@nestjs/common';
import { MintTHBToMerchant } from '../handlers/mintTHBToMerchant.handler';

/**
 * ⚠️ PHASE 1 SOLUTION - DEVELOPMENT/TESTING ONLY
 *
 * This admin controller provides endpoints for minting THB tokens directly to merchants.
 * This is a temporary solution for Phase 1 development and testing.
 *
 * FUTURE IMPROVEMENTS (Phase 2+):
 * - Replace with real payment gateway integration (Stripe, PayPal, Bank Transfer, etc.)
 * - Implement proper KYC/AML verification
 * - Add transaction monitoring and fraud detection
 * - Implement proper admin authentication and authorization
 * - Add rate limiting and security measures
 * - Integrate with real banking systems
 *
 * SECURITY WARNING:
 * - These endpoints should ONLY be accessible to verified admins
 * - Must be disabled or heavily restricted in production
 * - Consider using API keys or admin-only authentication
 */
@Controller('admin')
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(private mintTHBToMerchantHandler: MintTHBToMerchant) {}

  /**
   * PHASE 1: Mint THB tokens to merchant wallet
   *
   * This endpoint allows admins to mint THB tokens directly to a merchant's wallet.
   * In Phase 1, this simulates a merchant purchasing THB tokens with real money.
   *
   * In real-world implementation (Phase 2+), this should be replaced with:
   * 1. Merchant deposits real money (bank transfer, credit card, etc.)
   * 2. Payment gateway verifies the deposit
   * 3. System mints equivalent THB tokens to merchant's wallet
   * 4. Proper audit trail and compliance reporting
   *
   * @param merchantId - The merchant ID who should receive THB tokens
   * @param amount - Amount of THB tokens to mint (in THB, e.g., 1000 = 1000 THB)
   */
  @Post('mint-thb-to-merchant')
  async mintTHBToMerchant(
    @Body('merchantId') merchantId: string,
    @Body('amount') amount: number,
  ) {
    this.logger.warn(
      `[PHASE 1] Admin minting ${amount} THB to merchant ${merchantId}`,
    );
    this.logger.warn(
      '[WARNING] This is a Phase 1 development endpoint. Should be replaced with payment gateway in production.',
    );

    return this.mintTHBToMerchantHandler.execute(merchantId, amount);
  }
}
