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
} from '../types';
import { Prisma, AssetType, ParticipantType } from '@prisma/client';
import { randomUUID } from 'crypto';
import { TokenService } from 'src/providers/token/token.service';
import { ConfigService } from '@nestjs/config';
import { getSignerFromSeedPhrase } from 'src/libs/derive-wallet';
import { createBufferFromHex } from 'src/libs/createBufferFromHex';
// import { GetCustomerByEmailResponseType } from 'src/modules/internal/customer/types';
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
      | 'toPhone'
    > & { fromPhone: string },
  ): Promise<CreateTransactionResponse> {
    try {
      const { fromPhone, ...rest } = data;

      const { point } = await this.getPointByIdHandler.execute(
        pointId,
        merchantId,
      );

      const { customer: sender } = await this.getCustomer(
        merchantId,
        fromPhone,
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

        // senderAddress: access from wallet relation
        senderAddress: Buffer.from(
          ((sender as any).wallet?.walletAddress || '').replace(/^0x/, ''),
          'hex',
        ),
        merchant: { connect: { id: merchantId } },
        point: { connect: { id: pointId } },
        senderId: sender.id,
        senderType: ParticipantType.CUSTOMER,
        transactionType: { connect: { id: TransactionTypeId.BURN } },
        // txHash: createBufferFromHex(txId),
        txHash: new Uint8Array(createBufferFromHex(txId)),
        type: AssetType.POINT,
        transactionRefId: randomUUID(),
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
    const senderPoints = sender.customerPoints.find((cp) => cp.id === point.id);

    // the system will update the sender's balance.

    await this.updateCustomer.execute(sender.id, {
      customerPoints: {
        update: {
          where: { id: senderPoints.id },
          data: {
            balances: new Prisma.Decimal(senderPoints.balance)
              .minus(amount)
              .toNumber(),
          },
        },
      },
    });
  }

  private async getCustomer(merchantId: string, phone: string): Promise<any> {
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
    sender: CustomerType,
    point: any,
  ): Promise<string> {
    // Decrypt sender seed phrase and derive private key
    const decryptedSeedPhrase = this.tokenService.decryptKey(
      this.salt,
      (sender as any).wallet?.seedPhrase || '',
    );
    const derivationIndex = (sender as any).wallet?.derivationIndex || 0;

    const senderSigner = getSignerFromSeedPhrase(
      decryptedSeedPhrase,
      derivationIndex,
    );

    const { txId } = await this.blockchainService.burn({
      amount,
      senderPrivateKey: senderSigner.privateKey,
      pointAddress: point.contractAddress,
    });

    return txId;
  }
}
