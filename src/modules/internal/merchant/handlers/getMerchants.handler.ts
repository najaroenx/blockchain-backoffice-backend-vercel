import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';
import { MerchantDBService } from '../services/merchant-db.service';

@Injectable()
export class GetMerchants {
  private readonly logger = new Logger(GetMerchants.name);

  constructor(private readonly db: MerchantDBService) {}

  async execute(userId: string): Promise<any> {
    // refactor
    try {
      const merchants = await this.db.getMerchants(userId);

      // Format response เพื่อดึง wallet address ออกจาก wallet (ไม่ส่ง seedPhrase/chainCode)
      const formattedMerchants = merchants.map((merchant) => {
        const { wallet, tel, ...merchantData } = merchant;
        return {
          ...merchantData,
          walletAddress: wallet?.walletAddress || '',
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

  async getListMerchants(): Promise<any> {
    try {
      const result = await this.db.getAllMerchants({});
      const formattedMerchants = result.merchants.map((merchant: any) => {
        const { wallet, tel, ...merchantData } = merchant;
        return {
          ...merchantData,
          walletAddress: wallet?.walletAddress || '',
          phoneNumber: tel,
        };
      });
      return {
        ...result,
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
}
