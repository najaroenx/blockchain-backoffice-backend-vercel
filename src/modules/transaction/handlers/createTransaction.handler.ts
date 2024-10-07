import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { TransactionDBService } from '../services/transaction-db.service';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';
import { convertBufferToAddress } from 'src/libs/convertBufferToAddress';
import { Prisma } from '@prisma/client';
import { PointService } from 'src/modules/point/point.service';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';
import { createBufferFromHex } from 'src/libs/createBufferFromHex';
import { CreateTransaction as CreateTransactionResponse } from '../types';
import { GetCustomerByEmail } from 'src/modules/customer/handlers/getCustomerByEmail.handler';
import { UpdateCustomer } from 'src/modules/customer/handlers/updateCustomer.handler';

@Injectable()
export class CreateTransaction {
  constructor(
    private readonly db: TransactionDBService,
    private readonly pointService: PointService,
    private readonly blockchainService: BlockchainService,
    private readonly getCustomerByEmail: GetCustomerByEmail,
    private readonly updateCustomer: UpdateCustomer,
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
      email: string;
    },
  ): Promise<CreateTransactionResponse> {
    try {
      const { transactionTypeId, ...rest } = data;

      const { point } = await this.pointService.getPointById(pointId);

      const { customer } = await this.getCustomerByEmail.execute(
        merchantId,
        data.email,
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
        await this.updateCustomer.execute(customer.id, {
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
          await this.updateCustomer.execute(customer.id, {
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
          await this.updateCustomer.execute(customer.id, {
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
