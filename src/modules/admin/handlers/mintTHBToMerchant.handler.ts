import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';
import { ethers } from 'ethers';

/**
 * ⚠️ PHASE 1 HANDLER - DEVELOPMENT/TESTING ONLY
 *
 * This handler mints THB tokens directly to merchant wallets.
 * This is a temporary solution for Phase 1 where we simulate merchant purchasing THB.
 *
 * PHASE 2+ IMPROVEMENTS:
 * - Replace with payment gateway integration
 * - Add proper KYC/AML verification
 * - Implement escrow system for real money deposits
 * - Add transaction approval workflow
 * - Integrate with banking APIs
 */
@Injectable()
export class MintTHBToMerchant {
  private logger = new Logger(MintTHBToMerchant.name);

  constructor(
    private prisma: PrismaService,
    private blockchainService: BlockchainService,
  ) {}

  async execute(merchantId: string, amount: number): Promise<any> {
    try {
      this.logger.warn(
        `[PHASE 1 START] Minting ${amount} THB to merchant ${merchantId}`,
      );
      this.logger.warn(
        '[PHASE 1 WARNING] This is a development endpoint. In production, merchants should purchase THB through payment gateway.',
      );

      // 1. Validate merchant exists and has wallet
      this.logger.log(`[STEP 1] Validating merchant ${merchantId}`);
      const merchant = await this.prisma.merchant.findUnique({
        where: { id: merchantId },
        select: {
          id: true,
          name: true,
          walletId: true,
        },
      });

      if (!merchant) {
        throw new NotFoundException(`Merchant ${merchantId} not found`);
      }

      if (!merchant.walletId) {
        throw new BadRequestException(
          'Merchant has no wallet. Please create wallet first.',
        );
      }

      const wallet = await this.prisma.wallet.findUnique({
        where: { id: merchant.walletId },
        select: {
          walletAddress: true,
        },
      });

      if (!wallet) {
        throw new NotFoundException('Merchant wallet not found');
      }

      this.logger.log(
        `[STEP 1] Merchant validated. Wallet: ${wallet.walletAddress}`,
      );

      // 2. Mint THB tokens to merchant wallet
      this.logger.log(
        `[STEP 2] Minting ${amount} THB to ${wallet.walletAddress}`,
      );

      const amountWei = ethers.parseEther(amount.toString());
      const mintResult = await this.blockchainService.mintTHB(
        wallet.walletAddress,
        amountWei,
      );

      this.logger.log(
        `[STEP 2] Minted successfully. TxHash: ${mintResult.hash}, Block: ${mintResult.blockNumber}`,
      );

      // 3. Get updated balance
      const balance = await this.blockchainService.getUserTHBBalance(
        wallet.walletAddress,
      );

      this.logger.warn(
        `[PHASE 1 SUCCESS] Minted ${amount} THB to merchant ${merchant.name}`,
      );

      return {
        success: true,
        message: `[PHASE 1] Successfully minted ${amount} THB to merchant`,
        warning:
          'This is a Phase 1 development feature. In production, use payment gateway.',
        merchant: {
          id: merchant.id,
          name: merchant.name,
          walletAddress: wallet.walletAddress,
        },
        mint: {
          amount: amount,
          amountWei: amountWei.toString(),
          newBalance: balance.balance,
          newBalanceWei: balance.balanceWei,
        },
        blockchain: {
          transactionHash: mintResult.hash,
          blockNumber: mintResult.blockNumber,
        },
        nextSteps: {
          phase1: 'Merchant can now purchase vouchers from sellers using THB',
          phase2_todo: [
            'Integrate payment gateway (Stripe, PayPal, etc.)',
            'Implement KYC/AML verification',
            'Add bank transfer integration',
            'Implement escrow system',
            'Add compliance reporting',
          ],
        },
      };
    } catch (error) {
      this.logger.error(
        `[PHASE 1 ERROR] Failed to mint THB: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
