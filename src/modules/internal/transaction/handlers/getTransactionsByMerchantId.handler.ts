import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { TransactionDBService } from '../services/transaction-db.service';
import { PrismaService } from 'prisma/prisma.service';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';
import { GetTransactionByMerchantIdResponseType } from '../types';
import {
  formatTransactionDetail,
  getParticipantDisplayName,
  sortTransactionDetails,
} from '../utils/transaction-response.util';

@Injectable()
export class GetTransactionsByMerchantId {
  private logger = new Logger(GetTransactionsByMerchantId.name);

  constructor(
    private db: TransactionDBService,
    private prisma: PrismaService,
  ) {}

  async execute(
    merchantId: string,
  ): Promise<GetTransactionByMerchantIdResponseType> {
    try {
      const transactions =
        await this.db.getTransactionsByMerchantId(merchantId);

      const res = await Promise.all(
        transactions.map(async (transaction) => {
          const { merchant, ...rest } = transaction;

          const senderDisplayName = await getParticipantDisplayName(
            this.prisma,
            rest.senderId,
            (rest as any).senderType,
          );
          const receiverDisplayName = await getParticipantDisplayName(
            this.prisma,
            rest.receiverId,
            (rest as any).receiverType,
          );

          const transactionDirection =
            (rest as any).senderType === 'MERCHANT' &&
            rest.senderId === merchantId
              ? 'SENT'
              : 'RECEIVED';

          return formatTransactionDetail(transaction, {
            fallbackParticipantId: merchantId,
            senderDisplayName,
            receiverDisplayName,
            direction: transactionDirection,
            merchant: {
              id: merchantId,
              name: merchant?.name || null,
              imageUrl: merchant?.imageUrl || null,
            },
          });
        }),
      );

      const sortedRes = sortTransactionDetails(res);

      return {
        transactions: sortedRes,
        counts: sortedRes.length,
      };
    } catch (error) {
      this.logger.error(
        `Error message : ${error.message}, \n Error detail : ${error}`,
      );
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
