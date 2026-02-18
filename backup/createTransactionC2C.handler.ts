import {
  Injectable,
  InternalServerErrorException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { TransactionDBService } from '../services/transaction-db.service';
import { GetPointById } from 'src/modules/internal/point/handlers/getPointById.handler';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';
import { GetCustomerPhone } from 'src/modules/internal/customer/handlers/getCustomerByPhone.handler';
import { UpdateCustomer } from 'src/modules/internal/customer/handlers/updateCustomer.handler';
import {
  CreateTransaction as CreateTransactionResponse,
  CustomerType,
  PointType,
  CustomerWithWallet,
} from '../types';
import { Prisma, AssetType, ParticipantType } from '@prisma/client';
import { randomUUID } from 'crypto';
import { TokenService } from 'src/providers/token/token.service';
import { getSignerFromSeedPhrase } from 'src/libs/derive-wallet';
import { ConfigService } from '@nestjs/config';
// import { createBufferFromHex } from 'src/libs/createBufferFromHex';

import {
  INTERNAL_SERVER_ERROR,
  RPC_SERVER_ERROR,
} from 'src/errors/error.constants';
import { convertBufferToAddress } from 'src/libs/convertBufferToAddress';
import { TransactionTypeId } from 'src/constants/transaction-types.enum';

@Injectable()
export class CreateTransactionC2C {
  private salt: string;

  private logger = new Logger(CreateTransactionC2C.name);

  constructor(
    private readonly db: TransactionDBService,
    private readonly getPointByIdHandler: GetPointById,
    private readonly blockchainService: BlockchainService,
    private readonly getCustomerByPhone: GetCustomerPhone,
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
      | 'id'
      | 'merchant'
      | 'point'
      | 'transactionType'
      | 'txHash'
      | 'sender'
      | 'receiver'
      | 'transactionTypeId'
      | 'receiverAddress'
      | 'senderAddress'
    > & { fromPhone: string; toPhone: string },
  ): Promise<CreateTransactionResponse> {
    try {
      const { fromPhone, toPhone, ...rest } = data;

      const { point } = await this.getPointByIdHandler.execute(
        pointId,
        merchantId,
      );

      const { customer: sender } = await this.getCustomer(
        merchantId,
        fromPhone,
      );

      const { customer: receiver } = await this.getCustomer(
        merchantId,
        toPhone,
      );

      const txId = await this.performBlockchainTransaction(
        data.amount,
        sender,
        receiver,
        point,
      );

      const txHashBuffer = Uint8Array.from(
        Buffer.from(txId.replace(/^0x/, ''), 'hex'),
      );
      const senderAddressBuffer = Buffer.from(
        (sender as CustomerWithWallet).wallet?.walletAddress?.replace(
          /^0x/,
          '',
        ) || '',
        'hex',
      );
      const receiverAddressBuffer = Buffer.from(
        (receiver as CustomerWithWallet).wallet?.walletAddress?.replace(
          /^0x/,
          '',
        ) || '',
        'hex',
      );

      // Create single transaction record with both sender and receiver
      const transaction = await this.db.createTransaction({
        ...rest,
        senderAddress: senderAddressBuffer,
        receiverAddress: receiverAddressBuffer,
        merchant: { connect: { id: merchantId } },
        point: { connect: { id: pointId } },
        senderId: sender.id,
        receiverId: receiver.id,
        transactionType: { connect: { id: TransactionTypeId.TRANSFER } },
        txHash: txHashBuffer,
        type: AssetType.POINT,
        senderType: ParticipantType.CUSTOMER,
        receiverType: ParticipantType.CUSTOMER,
        transactionRefId: randomUUID(),
      });

      this.logger.log(
        `[CreateTransactionC2C] Transaction created. ID: ${transaction.id}`,
      );

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
    receiver: any,
    sender: any,
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
        customerPoints: { create: { pointId: point.id, balances: amount } },
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
    phone: string,
  ): Promise<{ customer: any }> {
    const customerResponse = await this.getCustomerByPhone.execute(
      merchantId,
      phone,
    );

    // Check if customer was found
    if ('message' in customerResponse) {
      throw new BadRequestException(
        `Customer with phone ${phone} not found or not registered with this merchant`,
      );
    }

    const { customer } = customerResponse;

    // Check if customer is registered with this merchant
    const isCustomerInMerchant = (customer as any).customerMerChant?.some(
      (cm: any) => cm.merchantId === merchantId,
    );

    if (!isCustomerInMerchant) {
      throw new BadRequestException(
        `Customer with phone ${phone} is not registered with this merchant`,
      );
    }

    return { customer };
  }

  private async performBlockchainTransaction(
    amount: number,
    sender: any,
    receiver: any,
    point: PointType,
  ): Promise<string> {
    // Decrypt sender seed phrase and derive private key
    const decryptedSeedPhrase = this.tokenService.decryptKey(
      this.salt,
      (sender as CustomerWithWallet).wallet?.seedPhrase || '',
    );
    const derivationIndex =
      (sender as CustomerWithWallet).wallet?.derivationIndex || 0;

    const senderSigner = getSignerFromSeedPhrase(
      decryptedSeedPhrase,
      derivationIndex,
    );

    const { txId } = await this.blockchainService.transactionC2C({
      amount,
      to: (receiver as CustomerWithWallet).wallet?.walletAddress || '',
      senderPrivateKey: senderSigner.privateKey,
      pointAddress: point.contractAddress,
    });

    return txId;
  }
}
