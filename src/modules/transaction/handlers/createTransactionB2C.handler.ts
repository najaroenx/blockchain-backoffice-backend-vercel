import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { TransactionDBService } from '../services/transaction-db.service';
import {
  INTERNAL_SERVER_ERROR,
  RPC_SERVER_ERROR,
} from 'src/errors/error.constants';
import { convertBufferToAddress } from 'src/libs/convertBufferToAddress';
import { Prisma } from '@prisma/client';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';
import { createBufferFromHex } from 'src/libs/createBufferFromHex';
import { CreateTransaction as CreateTransactionResponse } from '../types';
import { GetCustomerByEmail } from 'src/modules/customer/handlers/getCustomerByEmail.handler';
import { UpdateCustomer } from 'src/modules/customer/handlers/updateCustomer.handler';
import { GetPointById } from 'src/modules/point/handlers/getPointById.handler';

@Injectable()
export class CreateTransactionB2C {
  private logger = new Logger(CreateTransactionB2C.name);

  constructor(
    private readonly db: TransactionDBService,
    private readonly getPointByIdHandler: GetPointById,
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
      | 'receiverAddress'
    > & {
      transactionTypeId: string;
      email: string;
    },
  ): Promise<CreateTransactionResponse> {
    try {
      const { transactionTypeId, email, ...rest } = data;

      const { point } = await this.getPointByIdHandler.execute(pointId);

      const { customer } = await this.getCustomerByEmail.execute(
        merchantId,
        email,
      );

      const { txId } = await this.blockchainService.transaction({
        amount: data.amount,
        to: customer.walletAddress,
        pointAddress: point.contractAddress,
      });

      const transaction = await this.db.createTransaction({
        ...rest,
        receiverAddress: createBufferFromHex(customer.walletAddress),
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
            id: 'redeem',
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
        } else {
          await this.updateCustomer.execute(customer.id, {
            customerPoints: {
              create: {
                pointId: point.id,
                balances: data.amount,
              },
            },
          });
        }
      }

      return {
        ...transaction,
        txHash: convertBufferToAddress(transaction.txHash),
        senderAddress: convertBufferToAddress(transaction.senderAddress),
        receiverAddress: convertBufferToAddress(transaction.receiverAddress),
      };
    } catch (error) {
      this.logger.error(
        `Error message : ${error.message}, \n Error detail : ${error}`,
      );
      if (error.message === '500001: RPC server error') {
        throw new InternalServerErrorException(RPC_SERVER_ERROR);
      }
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
