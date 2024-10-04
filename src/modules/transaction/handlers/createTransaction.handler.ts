import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { TransactionDBService } from '../services/transaction-db.service';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';
import { convertBufferToAddress } from 'src/libs/convertBufferToAddress';
import { Prisma } from '@prisma/client';
import { PointService } from 'src/modules/point/point.service';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';
import { CustomerService } from 'src/modules/customer/customer.service';
import { createBufferFromHex } from 'src/libs/createBufferFromHex';
import { CreateTransaction as CreateTransactionResponse } from '../types';

@Injectable()
export class CreateTransaction {
  constructor(
    private readonly db: TransactionDBService,
    private readonly pointService: PointService,
    private readonly blockchainService: BlockchainService,
    private readonly customerService: CustomerService,
  ) {}

  async execute(
    merchantId: string,
    pointId: string,
    data: Omit<
      Prisma.TransactionCreateInput,
      | 'merchant'
      | 'point'
      | 'transactionType'
      | 'txHash'
      | 'sender'
      | 'receiver'
      | 'transactionTypeId'
    > & {
      transactionTypeId: string;
    },
  ): Promise<CreateTransactionResponse> {
    try {
      const { transactionTypeId, ...rest } = data;

      const { point } = await this.pointService.getPointById(pointId);

      const { customer } = await this.customerService.getCustomerByAddress(
        merchantId,
        data.receiverAddress,
      );

      const { txId } = await this.blockchainService.transaction({
        amount: data.amount,
        to: convertBufferToAddress(data.receiverAddress),
        pointAddress: point.contractAddress,
      });

      const transaction = await this.db.createTransaction({
        ...rest,
        merchant: {
          connect: {
            id: merchantId,
          },
        },
        point: {
          connect: {
            id: pointId,
          },
        },
        receiver: {
          connect: {
            id: customer.id,
          },
        },
        transactionType: {
          connect: {
            id: transactionTypeId,
          },
        },
        txHash: createBufferFromHex(txId),
      });

      if (customer.customerPoints.length === 0) {
        await this.customerService.updateCustomer(customer.id, {
          customerPoints: {
            create: {
              pointId: point.id,
              balances: data.amount,
            },
          },
        });
      }

      if (customer.customerPoints.length > 0) {
        const customerPoint = customer.customerPoints.find(
          (cp) => cp.pointId === point.id,
        );

        if (customerPoint) {
          await this.customerService.updateCustomer(customer.id, {
            customerPoints: {
              update: {
                where: {
                  id: customerPoint.id,
                },
                data: {
                  balances: customerPoint.balances + data.amount,
                },
              },
            },
          });
          return;
        } else {
          await this.customerService.updateCustomer(customer.id, {
            customerPoints: {
              create: {
                pointId: point.id,
                balances: data.amount,
              },
            },
          });
          return;
        }
      }

      return {
        ...transaction,
        txHash: convertBufferToAddress(transaction.txHash),
        senderAddress: convertBufferToAddress(transaction.senderAddress),
        receiverAddress: convertBufferToAddress(transaction.receiverAddress),
      };
    } catch (error) {
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
