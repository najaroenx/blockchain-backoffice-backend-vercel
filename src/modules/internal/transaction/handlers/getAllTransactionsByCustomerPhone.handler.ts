import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { TransactionDBService } from '../services/transaction-db.service';
import { GetTransactionsByCustomerIdResponseType } from '../types';
import { CustomerDBService } from 'src/modules/internal/customer/services/customer-db.service';
import { PrismaService } from 'prisma/prisma.service';
import {
  formatTransactionDetail,
  getParticipantDisplayName,
  sortTransactionDetails,
} from '../utils/transaction-response.util';
import { logAndRethrowOrInternalError } from 'src/common/utils/handler-error.util';

@Injectable()
export class GetAllTransactionsByCustomerPhone {
  private logger = new Logger(GetAllTransactionsByCustomerPhone.name);

  constructor(
    private db: TransactionDBService,
    private customerDb: CustomerDBService,
    private prisma: PrismaService,
  ) {}

  async execute(
    phone: string,
  ): Promise<GetTransactionsByCustomerIdResponseType> {
    try {
      // Lookup customer by phone number (without merchant filter)
      const customer = await this.customerDb.getCustomerByPhoneDetailed(phone);

      // Check if customer was found
      if (!customer) {
        throw new NotFoundException(`Customer with phone ${phone} not found`);
      }

      // Get all transactions using customer ID (no merchant filter)
      const transactions = await this.db.getAllTransactionsByCustomerId(
        customer.id,
      );

      const res = await Promise.all(
        transactions.map(async (transaction) => {
          const { merchant, voucherCode, ...rest } = transaction;

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

          return formatTransactionDetail(transaction, {
            perspectiveId: customer.id,
            fallbackParticipantId: merchant?.id,
            senderDisplayName,
            receiverDisplayName,
            resolveVoucherMerchant: true,
          });
        }),
      );

      const sortedRes = sortTransactionDetails(res);

      return {
        transactions: sortedRes,
        counts: sortedRes.length,
      };
    } catch (error) {
      logAndRethrowOrInternalError(this.logger, error, [NotFoundException]);
    }
  }
}
