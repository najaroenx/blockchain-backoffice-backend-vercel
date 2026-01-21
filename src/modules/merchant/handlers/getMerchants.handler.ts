import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';
import { MerchantDBService } from '../services/merchant-db.service';

@Injectable()
export class GetMerchants {
  private logger = new Logger(GetMerchants.name);

  constructor(private db: MerchantDBService) {}

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
      const merchants = await this.db.getAllMerchants({});
      return merchants;
    } catch (error) {
      this.logger.error(
        `Error message : ${error.message}, \n Error detail : ${error}`,
      );
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
