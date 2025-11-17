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
import { ADDRESS_ZERO } from 'src/constants';
import { TransactionTypeId } from 'src/constants/transaction-types.enum';

@Injectable()
export class BurnTransaction {
  private salt: string;

  private logger = new Logger(BurnTransaction.name);

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
      | 'toEmail'
    > & { fromEmail: string },
  ): Promise<CreateTransactionResponse> {
    try {
      const { fromEmail, ...rest } = data;

      const { point } = await this.getPointByIdHandler.execute(
        pointId,
        merchantId,
      );

      const { customer: sender } = await this.getCustomer(
        merchantId,
        fromEmail,
      );

      const txId = await this.performBlockchainTransaction(
        data.amount,
        sender,
        point,
      );

      const transaction = await this.db.createTransaction({
        ...rest,
        // receiverAddress: createBufferFromHex(ADDRESS_ZERO),
        receiverAddress: Buffer.from(ADDRESS_ZERO.replace(/^0x/, ''), 'hex'),

        // senderAddress: createBufferFromHex(sender.walletAddress),
        senderAddress: Buffer.from(
          sender.walletAddress.replace(/^0x/, ''),
          'hex',
        ),
        merchant: { connect: { id: merchantId } },
        point: { connect: { id: pointId } },
        sender: { connect: { id: sender.id } },
        transactionType: { connect: { id: TransactionTypeId.BURN } },
        // txHash: createBufferFromHex(txId),
        txHash: new Uint8Array(createBufferFromHex(txId)),
      });

      await this.updateBalances(sender, point, data.amount);

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

  private async updateBalances(
    sender: CustomerType,
    point: PointType,
    amount: number,
  ) {
    const senderPoints = sender.customerPoints.find(
      (cp) => cp.pointId === point.id,
    );

    // the system will update the sender's balance.

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
    point: any,
  ): Promise<string> {
    const senderPrivateKey = this.tokenService.decryptKey(
      this.salt,
      sender.privateKey,
    );

    const { txId } = await this.blockchainService.burn({
      amount,
      senderPrivateKey,
      pointAddress: point.contractAddress,
    });

    return txId;
  }
}
