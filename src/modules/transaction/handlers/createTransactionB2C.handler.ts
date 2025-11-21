/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  BadRequestException,
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
import { GetCustomerPhone } from 'src/modules/customer/handlers/getCustomerByPhone.handler';
import { UpdateCustomer } from 'src/modules/customer/handlers/updateCustomer.handler';
import { GetPointById } from 'src/modules/point/handlers/getPointById.handler';
import { GetMerchant } from 'src/modules/merchant/handlers/getMerchantById.handler';
import { TransactionTypeId } from 'src/constants/transaction-types.enum';
import { TokenService } from 'src/providers/token/token.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CreateTransactionB2C {
  private logger = new Logger(CreateTransactionB2C.name);

  constructor(
    private readonly db: TransactionDBService,
    private readonly getPointByIdHandler: GetPointById,
    private readonly blockchainService: BlockchainService,
    private readonly getCustomerByPhone: GetCustomerPhone,
    private readonly updateCustomer: UpdateCustomer,
    private readonly getMerchant: GetMerchant,
    private readonly tokenService: TokenService,
    private readonly configService: ConfigService,
  ) {}

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
    > & { transactionTypeId: string; phone: string },
  ): Promise<CreateTransactionResponse> {
    try {
      const { transactionTypeId, phone, ...rest } = data;

      const { point } = await this.getPointByIdHandler.execute(
        pointId,
        merchantId,
      );

      // Get customer by phone
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

      // Get merchant wallet for sender address
      this.logger.log(
        `[CreateTransactionB2C] Getting merchant ${merchantId} wallet information`,
      );
      const { merchant } = await this.getMerchant.execute(merchantId);
      const merchantWalletAddress =
        (merchant as any).wallet?.walletAddress || '';
      const merchantEncryptedPrivateKey =
        (merchant as any).wallet?.privateKey || '';

      if (!merchantWalletAddress) {
        this.logger.error(
          `[CreateTransactionB2C] Merchant ${merchantId} wallet address not configured`,
        );
        throw new BadRequestException('Merchant wallet not configured');
      }

      if (!merchantEncryptedPrivateKey) {
        this.logger.error(
          `[CreateTransactionB2C] Merchant ${merchantId} wallet private key not configured`,
        );
        throw new BadRequestException(
          'Merchant wallet private key not configured',
        );
      }

      this.logger.log(
        `[CreateTransactionB2C] Merchant wallet address: ${merchantWalletAddress}`,
      );
      this.logger.log(
        `[CreateTransactionB2C] Customer wallet address: ${(customer as any).wallet?.walletAddress}`,
      );

      // Decrypt merchant private key
      this.logger.log(`[CreateTransactionB2C] Decrypting merchant private key`);
      let merchantPrivateKey: string;
      try {
        const salt = this.configService.get<string>('SALT');
        this.logger.log(
          `[CreateTransactionB2C] Salt retrieved: ${salt ? 'Yes' : 'No'}`,
        );
        this.logger.log(
          `[CreateTransactionB2C] Encrypted key length: ${merchantEncryptedPrivateKey?.length || 0}`,
        );

        merchantPrivateKey = this.tokenService.decryptKey(
          salt,
          merchantEncryptedPrivateKey,
        );

        this.logger.log(
          `[CreateTransactionB2C] Merchant private key decrypted successfully`,
        );
        this.logger.log(
          `[CreateTransactionB2C] Decrypted key length: ${merchantPrivateKey?.length || 0}`,
        );
      } catch (error) {
        this.logger.error(
          `[CreateTransactionB2C] Failed to decrypt merchant private key: ${error.message}`,
        );
        this.logger.error(`[CreateTransactionB2C] Error stack: ${error.stack}`);
        this.logger.error(
          `[CreateTransactionB2C] Error details: ${JSON.stringify(error)}`,
        );
        this.logger.error(
          `[CreateTransactionB2C] Encrypted key (first 20 chars): ${merchantEncryptedPrivateKey?.substring(0, 20)}...`,
        );
        throw new InternalServerErrorException(
          'Failed to decrypt merchant wallet credentials',
        );
      }

      // Call blockchain service with merchant private key
      this.logger.log(
        `[CreateTransactionB2C] Initiating blockchain transaction`,
      );
      this.logger.log(
        `[CreateTransactionB2C] Point contract address: ${point.contractAddress}`,
      );
      this.logger.log(`[CreateTransactionB2C] Amount: ${data.amount}`);
      this.logger.log(
        `[CreateTransactionB2C] Customer wallet: ${(customer as any).wallet?.walletAddress}`,
      );
      this.logger.log(
        `[CreateTransactionB2C] Merchant wallet: ${merchantWalletAddress}`,
      );

      // Check merchant balance before transaction
      try {
        const merchantBalance = await this.blockchainService.getBalance({
          walletAddress: merchantWalletAddress,
          pointAddress: point.contractAddress,
        });
        this.logger.log(
          `[CreateTransactionB2C] Merchant current balance: ${merchantBalance} points`,
        );
        this.logger.log(
          `[CreateTransactionB2C] Required amount: ${data.amount} points`,
        );

        if (parseFloat(merchantBalance) < data.amount) {
          this.logger.error(
            `[CreateTransactionB2C] Insufficient balance! Merchant has ${merchantBalance} but needs ${data.amount}`,
          );
          throw new BadRequestException(
            `Insufficient merchant balance. Available: ${merchantBalance} points, Required: ${data.amount} points`,
          );
        }
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        this.logger.warn(
          `[CreateTransactionB2C] Failed to check balance: ${error.message}`,
        );
      }

      const { txId } = await this.blockchainService.transaction({
        amount: data.amount,
        to: (customer as any).wallet?.walletAddress || '',
        pointAddress: point.contractAddress,
        senderPrivateKey: merchantPrivateKey,
      });

      this.logger.log(
        `[CreateTransactionB2C] Blockchain transaction successful. TxId: ${txId}`,
      );

      const transaction = await this.db.createTransaction({
        ...rest,
        // senderAddress: merchant wallet address
        senderAddress: Buffer.from(
          merchantWalletAddress.replace(/^0x/, ''),
          'hex',
        ),
        // receiverAddress: customer wallet address
        receiverAddress: Buffer.from(
          ((customer as any).wallet?.walletAddress || '').replace(/^0x/, ''),
          'hex',
        ),
        merchant: { connect: { id: merchantId } },
        point: { connect: { id: pointId } },
        receiver: { connect: { id: customer.id } },
        transactionType: { connect: { id: TransactionTypeId.EARN } },
        txHash: new Uint8Array(createBufferFromHex(txId)),
      });

      if (customer.customerPoints.length === 0) {
        await this.updateCustomer.execute(customer.id, {
          customerPoints: {
            create: { pointId: point.id, balances: data.amount },
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
                where: { id: customerPoint.id },
                data: { balances: customerPoint.balances + data.amount },
              },
            },
          });
        } else {
          await this.updateCustomer.execute(customer.id, {
            customerPoints: {
              create: { pointId: point.id, balances: data.amount },
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
      this.logger.error(`[CreateTransactionB2C] Transaction failed`);
      this.logger.error(
        `[CreateTransactionB2C] Error message: ${error.message}`,
      );
      this.logger.error(`[CreateTransactionB2C] Error name: ${error.name}`);
      this.logger.error(`[CreateTransactionB2C] Error stack: ${error.stack}`);
      this.logger.error(
        `[CreateTransactionB2C] Full error details: ${JSON.stringify(error, null, 2)}`,
      );
      this.logger.error(`[CreateTransactionB2C] Merchant ID: ${merchantId}`);
      this.logger.error(`[CreateTransactionB2C] Point ID: ${pointId}`);
      this.logger.error(`[CreateTransactionB2C] Phone: ${data.phone}`);

      if (error.message === '500001: RPC server error') {
        throw new InternalServerErrorException(RPC_SERVER_ERROR);
      }

      // Re-throw if it's already an HttpException (like BadRequestException)
      if (error.status) {
        throw error;
      }

      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
