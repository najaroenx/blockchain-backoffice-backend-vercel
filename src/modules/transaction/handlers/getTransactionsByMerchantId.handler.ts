import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { TransactionDBService } from '../services/transaction-db.service';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';
import { convertBufferToAddress } from 'src/libs/convertBufferToAddress';
import { GetTransactionByMerchantIdResponseType } from '../types';

@Injectable()
export class GetTransactionsByMerchantId {
  constructor(private db: TransactionDBService) {}

  async execute(
    merchantId: string,
  ): Promise<GetTransactionByMerchantIdResponseType> {
    try {
      const transactions =
        await this.db.getTransactionsByMerchantId(merchantId);

      const res = transactions.map((transaction) => {
        const { sender, receiver, merchant, point, ...rest } = transaction;

        const formatParticipant = (
          customer,
          walletAddress,
          merchantWebsite,
        ) => ({
          id: customer?.id ?? merchantId,
          walletAddress: convertBufferToAddress(
            customer?.walletAddress ?? walletAddress,
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
          createdAt: rest.createdAt,
        };
      });

      return {
        transactions: res,
        counts: res.length,
      };
    } catch (error) {
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
