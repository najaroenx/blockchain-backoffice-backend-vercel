import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { WalletDBService } from '../services/wallet-db.service';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';

@Injectable()
export class GetWalletByPhoneOrEmail {
  private logger = new Logger(GetWalletByPhoneOrEmail.name);

  constructor(
    private walletDB: WalletDBService,
    private blockchainService: BlockchainService,
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

    // ไม่ return privateKey ออกไป
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { privateKey, ...walletWithoutPrivateKey } = wallet;

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
      ...walletWithoutPrivateKey,
      thbBalance,
    };
  }
}
