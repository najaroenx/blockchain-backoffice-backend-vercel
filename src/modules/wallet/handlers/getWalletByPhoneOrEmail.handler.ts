import { Injectable, NotFoundException } from '@nestjs/common';
import { WalletDBService } from '../services/wallet-db.service';

@Injectable()
export class GetWalletByPhoneOrEmail {
  constructor(private walletDB: WalletDBService) {}

  async execute(phoneNumber?: string, email?: string) {
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
    const { ...walletWithoutPrivateKey } = wallet;

    return walletWithoutPrivateKey;
  }
}
