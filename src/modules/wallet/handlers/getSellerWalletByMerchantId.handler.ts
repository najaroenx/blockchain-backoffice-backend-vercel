import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { WalletDBService } from '../services/wallet-db.service';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';

@Injectable()
export class GetSellerWalletByMerchantId {
  private logger = new Logger(GetSellerWalletByMerchantId.name);

  constructor(
    private walletDB: WalletDBService,
    private blockchainService: BlockchainService,
  ) {}

  /**
   * Get seller wallet by merchant ID
   * @param merchantId - Merchant ID to find seller wallet
   * @param includeTHBBalance - Whether to fetch THB balance from blockchain
   */
  async execute(merchantId: string, includeTHBBalance: boolean = true) {
    this.logger.log(
      `[GetSellerWalletByMerchantId] Finding seller wallet for merchant: ${merchantId}`,
    );

    const wallet = await this.walletDB.getSellerWalletByMerchantId(merchantId);

    if (!wallet) {
      throw new NotFoundException(
        `Seller wallet not found for merchant ID: ${merchantId}`,
      );
    }

    this.logger.log(
      `[GetSellerWalletByMerchantId] Found seller wallet: ${wallet.walletAddress}`,
    );

    // ไม่ return seedPhrase และ chainCode ออกไป
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { seedPhrase, chainCode, ...walletWithoutSensitiveData } = wallet;

    // Optionally fetch THB balance from blockchain
    let thbBalance = null;
    if (includeTHBBalance && wallet.walletAddress) {
      try {
        thbBalance = await this.blockchainService.getUserTHBBalance(
          wallet.walletAddress,
        );
        this.logger.log(
          `[GetSellerWalletByMerchantId] THB balance for ${wallet.walletAddress}: ${thbBalance.balance}`,
        );
      } catch (error) {
        this.logger.warn(
          `[GetSellerWalletByMerchantId] Failed to get THB balance: ${error.message}`,
        );
        // ไม่ throw error ถ้าดึง balance ไม่ได้ แค่ไม่ส่ง balance กลับไป
      }
    }

    return {
      ...walletWithoutSensitiveData,
      ...(thbBalance ? { thbBalance: thbBalance.balance } : {}),
    };
  }
}
