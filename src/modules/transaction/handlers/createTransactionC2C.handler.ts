import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { TransactionDBService } from '../services/transaction-db.service';
import { GetPointById } from 'src/modules/point/handlers/getPointById.handler';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';
import { GetCustomerByEmail } from 'src/modules/customer/handlers/getCustomerByEmail.handler';
import { UpdateCustomer } from 'src/modules/customer/handlers/updateCustomer.handler';
import {
  CreateTransaction as CreateTransactionResponse,
  CustomerType,
  PointType,
} from '../types';
import { Prisma } from '@prisma/client';
import { TokenService } from 'src/providers/token/token.service';
import { ConfigService } from '@nestjs/config';
import { createBufferFromHex } from 'src/libs/createBufferFromHex';
import { GetCustomerByEmailResponseType } from 'src/modules/customer/types';
import {
  INTERNAL_SERVER_ERROR,
  RPC_SERVER_ERROR,
} from 'src/errors/error.constants';
import { convertBufferToAddress } from 'src/libs/convertBufferToAddress';

@Injectable()
export class CreateTransactionC2C {
  private salt: string;

  private logger = new Logger(CreateTransactionC2C.name);

  constructor(
    private readonly db: TransactionDBService,
    private readonly getPointByIdHandler: GetPointById,
    private readonly blockchainService: BlockchainService,
    private readonly getCustomerByEmail: GetCustomerByEmail,
    private readonly updateCustomer: UpdateCustomer,
    private readonly tokenService: TokenService,
    private readonly configService: ConfigService,
  ) {
    this.salt = this.configService.get<string>('SALT');
  }

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
      | 'senderAddress'
    > & {
      fromEmail: string;
      toEmail: string;
    },
  ): Promise<CreateTransactionResponse> {
    try {
      const { fromEmail, toEmail, ...rest } = data;

      const { point } = await this.getPointByIdHandler.execute(pointId);

      const { customer: sender } = await this.getCustomer(
        merchantId,
        fromEmail,
      );

      const { customer: receiver } = await this.getCustomer(
        merchantId,
        toEmail,
      );

      const txId = await this.performBlockchainTransaction(
        data.amount,
        sender,
        receiver,
        point,
      );

      const transaction = await this.db.createTransaction({
        ...rest,
        receiverAddress: createBufferFromHex(receiver.walletAddress),
        senderAddress: createBufferFromHex(sender.walletAddress),
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
            id: receiver.id,
          },
        },
        sender: {
          connect: {
            id: sender.id,
          },
        },
        transactionType: {
          connect: {
            id: 'transfer',
          },
        },
        txHash: createBufferFromHex(txId),
      });

      await this.updateReceiverPoints(receiver, sender, point, data.amount);

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

  private async updateReceiverPoints(
    receiver: CustomerType,
    sender: CustomerType,
    point: PointType,
    amount: number,
  ) {
    const customerPoints = receiver.customerPoints.find(
      (cp) => cp.pointId === point.id,
    );

    const senderPoints = sender.customerPoints.find(
      (cp) => cp.pointId === point.id,
    );

    // Check the receiver's point token. If the receiver doesn't have any points, the system will create a new one.
    if (customerPoints) {
      await this.updateCustomer.execute(receiver.id, {
        customerPoints: {
          update: {
            where: { id: customerPoints.id },
            data: { balances: customerPoints.balances + amount },
          },
        },
      });
    } else {
      await this.updateCustomer.execute(receiver.id, {
        customerPoints: {
          create: { pointId: point.id, balances: amount },
        },
      });
    }

    // After updating or creating point tokens, the system will update the sender's balance.

    await this.updateCustomer.execute(sender.id, {
      customerPoints: {
        update: {
          where: { id: senderPoints.id },
          data: { balances: senderPoints.balances - amount },
        },
      },
    });
  }

  private async getCustomer(
    merchantId: string,
    email: string,
  ): Promise<GetCustomerByEmailResponseType> {
    const customer = await this.getCustomerByEmail.execute(merchantId, email);

    return customer;
  }

  private async performBlockchainTransaction(
    amount: number,
    sender: CustomerType,
    receiver: CustomerType,
    point: any,
  ): Promise<string> {
    const senderPrivateKey = this.tokenService.decryptKey(
      this.salt,
      sender.privateKey,
    );

    const { txId } = await this.blockchainService.transactionC2C({
      amount,
      to: receiver.walletAddress,
      senderPrivateKey,
      pointAddress: point.contractAddress,
    });

    return txId;
  }
}
