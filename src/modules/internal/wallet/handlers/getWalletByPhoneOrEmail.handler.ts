import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { WalletDBService } from '../services/wallet-db.service';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';

@Injectable()
export class GetWalletByPhoneOrEmail {
  private readonly logger = new Logger(GetWalletByPhoneOrEmail.name);

  constructor(
    private readonly walletDB: WalletDBService,
    private readonly blockchainService: BlockchainService,
  ) {}

  /**
   * Get wallet by phone or email with optional THB balance
   * @param phoneNumber - Phone number to search
   * @param email - Email to search
   * @param includeTHBBalance - Whether to fetch THB balance from blockchain
   */
  async execute(
    phoneNumber?: string,
    email?: string,
    includeTHBBalance: boolean = true,
  ) {
    const wallet = await this.walletDB.getWalletByPhoneOrEmail(
      phoneNumber,
      email,
    );

    if (!wallet) {
      throw new NotFoundException(
        `Wallet not found for ${phoneNumber ? `phone: ${phoneNumber}` : ''} ${email ? `email: ${email}` : ''}`,
      );
    }

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
          `[GetWalletByPhoneOrEmail] THB balance for ${wallet.walletAddress}: ${thbBalance.balance}`,
        );
      } catch (error) {
        this.logger.warn(
          `[GetWalletByPhoneOrEmail] Failed to get THB balance: ${error.message}`,
        );
        // Don't fail the request if THB balance fetch fails
        thbBalance = null;
      }
    }

    return {
      ...walletWithoutSensitiveData,
      thbBalance,
    };
  }
}
