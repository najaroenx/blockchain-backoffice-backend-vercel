import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { TransactionDBService } from '../services/transaction-db.service';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';
import { TransactionDetail } from '../types';
import { PrismaService } from 'prisma/prisma.service';
import {
  formatTransactionDetail,
  getParticipantDisplayName,
} from '../utils/transaction-response.util';

@Injectable()
export class GetTransactionById {
  private logger = new Logger(GetTransactionById.name);

  constructor(
    private db: TransactionDBService,
    private prisma: PrismaService,
  ) {}

  async execute(transactionId: string): Promise<TransactionDetail> {
    try {
      this.logger.log(`[START] Getting transaction by id: ${transactionId}`);

      // Get transaction by ID
      const transaction = await this.db.getTransactionById(transactionId);

      if (!transaction) {
        throw new NotFoundException(
          `Transaction with id ${transactionId} not found`,
        );
      }

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

      let transactionDirection: 'SENT' | 'RECEIVED' = 'SENT';
      if (rest.senderId) {
        transactionDirection = 'SENT';
      } else if (rest.receiverId) {
        transactionDirection = 'RECEIVED';
      }

      const result: TransactionDetail = formatTransactionDetail(transaction, {
        fallbackParticipantId: merchant?.id,
        senderDisplayName,
        receiverDisplayName,
        direction: transactionDirection,
      });

      this.logger.log(
        `[SUCCESS] Retrieved transaction ${transactionId} successfully`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `[FATAL ERROR] Failed to get transaction: ${error.message}`,
        error.stack,
      );

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
