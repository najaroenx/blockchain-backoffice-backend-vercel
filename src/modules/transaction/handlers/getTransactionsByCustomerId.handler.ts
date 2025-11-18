import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { TransactionDBService } from '../services/transaction-db.service';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';
import { convertBufferToAddress } from 'src/libs/convertBufferToAddress';
import { GetTransactionsByCustomerIdResponseType } from '../types';

@Injectable()
export class GetTransactionsByCustomerId {
  private logger = new Logger(GetTransactionsByCustomerId.name);

  constructor(private db: TransactionDBService) {}

  async execute(
    customerId: string,
    merchantId: string,
  ): Promise<GetTransactionsByCustomerIdResponseType> {
    try {
      const transactions = await this.db.getTransactionsByCustomerId(
        customerId,
        merchantId,
      );

      const res = transactions.map((transaction) => {
        const { sender, receiver, merchant, point, ...rest } = transaction;

        const formatParticipant = (
          customer,
          walletAddress,
          merchantWebsite,
        ) => ({
          id: customer?.id ?? merchantId,
          walletAddress: convertBufferToAddress(
            (customer as any)?.wallet?.walletAddress
              ? Buffer.from(
                  (customer as any).wallet.walletAddress.replace(/^0x/, ''),
                  'hex',
                )
              : walletAddress,
          ),
          emailOrWebsite: customer?.email ?? merchantWebsite,
        });

        return {
          id: rest.id,
          txHash: convertBufferToAddress(rest.txHash),
          senderAddress: convertBufferToAddress(rest.senderAddress),
          receiverAddress: convertBufferToAddress(rest.receiverAddress),
          transactionTypeId: rest.transactionTypeId,
          amount: rest.amount,
          point: {
            id: point.id,
            name: point.name,
            symbol: point.symbol,
          },
          sender: formatParticipant(
            sender,
            rest.senderAddress,
            merchant.website,
          ),
          receiver: formatParticipant(
            receiver,
            rest.receiverAddress,
            merchant.website,
          ),
          voucherCodeId: rest.voucherCodeId || null,
          createdAt: rest.createdAt,
        };
      });

      return {
        transactions: res,
        counts: res.length,
      };
    } catch (error) {
      this.logger.error(
        `Error message : ${error.message}, \n Error detail : ${error}`,
      );
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
