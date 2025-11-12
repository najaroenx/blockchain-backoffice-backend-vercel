import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';
import { MerchantDBService } from '../services/merchant-db.service';
import { Wallet } from 'ethers';

@Injectable()
export class GetMerchants {
  private logger = new Logger(GetMerchants.name);

  constructor(private db: MerchantDBService) {}

  async execute(userId: string): Promise<any> {
    // refactor
    try {
      const merchants = await this.db.getMerchants(userId);

      // Format response เพื่อดึง wallet address และ privateKey ออกจาก wallet
      const formattedMerchants = merchants.map((merchant) => {
        const { wallet, tel, ...merchantData } = merchant;

        return {
          ...merchantData,
          walletAddress: wallet?.privateKey
            ? this.getAddressFromPrivateKey(wallet.privateKey)
            : null,
          phoneNumber: tel,
        };
      });

      return {
        merchants: formattedMerchants,
        counts: formattedMerchants.length,
      };
    } catch (error) {
      this.logger.error(
        `Error message : ${error.message}, \n Error detail : ${error}`,
      );
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }

  private getAddressFromPrivateKey(privateKey: string): string | null {
    // ใช้ ethers เพื่อดึง address จาก private key
    try {
      const wallet = new Wallet(privateKey);
      return wallet.address;
    } catch (error) {
      this.logger.error(
        `Error getting address from private key: ${error.message}`,
      );
      return null;
    }
  }
}
