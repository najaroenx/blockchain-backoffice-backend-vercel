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
import { Prisma, AssetType, ParticipantType } from '@prisma/client';
import { randomUUID } from 'crypto';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';
import { createBufferFromHex } from 'src/libs/createBufferFromHex';
import { CreateTransaction as CreateTransactionResponse } from '../types';
import { GetCustomerPhone } from 'src/modules/customer/handlers/getCustomerByPhone.handler';
import { UpdateCustomer } from 'src/modules/customer/handlers/updateCustomer.handler';
import { CreateCustomer } from 'src/modules/customer/handlers/createCustomer.handler';
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
    private readonly createCustomer: CreateCustomer,
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
    > & { transactionTypeId?: string; phone: string; eventId?: string },
  ): Promise<CreateTransactionResponse> {
    try {
      const { transactionTypeId, phone, eventId, ...rest } = data;

      // Default to TRANSFER if transactionTypeId not provided
      const finalTransactionTypeId =
        transactionTypeId || TransactionTypeId.TRANSFER;

      const { point } = await this.getPointByIdHandler.execute(
        pointId,
        merchantId,
      );

      // Get customer by phone
      let customerResponse = await this.getCustomerByPhone.execute(
        merchantId,
        phone,
      );

      let customer: any;

      // If customer not found or not registered with merchant, create/register them
      if ('message' in customerResponse) {
        this.logger.log(
          `[CreateTransactionB2C] Customer with phone ${phone} not found. Creating new customer...`,
        );

        // Create new customer with phone number
        // Generate email from phone if not provided
        const customerEmail = `${phone}@customer.generated`;

        try {
          const newCustomer = await this.createCustomer.execute(merchantId, {
            email: customerEmail,
            tel: phone,
            firstName: '', // Can be updated later
            lastName: '',
          });

          customer = newCustomer;
          this.logger.log(
            `[CreateTransactionB2C] New customer created successfully. ID: ${customer.id}`,
          );
        } catch (error) {
          this.logger.error(
            `[CreateTransactionB2C] Failed to create customer: ${error.message}`,
          );
          throw new BadRequestException(
            `Failed to create customer with phone ${phone}: ${error.message}`,
          );
        }
      } else {
        customer = customerResponse.customer;

        // Check if customer is registered with this merchant
        const isCustomerInMerchant = (customer as any).customerMerChant?.some(
          (cm: any) => cm.merchantId === merchantId,
        );

        if (!isCustomerInMerchant) {
          this.logger.log(
            `[CreateTransactionB2C] Customer ${customer.id} found but not associated with merchant ${merchantId}. Adding association...`,
          );

          try {
            await this.updateCustomer.execute(customer.id, {
              customerMerChant: { create: { merchantId } },
            });

            // Re-fetch customer to get updated associations
            customerResponse = await this.getCustomerByPhone.execute(
              merchantId,
              phone,
            );
            customer = (customerResponse as any).customer;

            this.logger.log(
              `[CreateTransactionB2C] Customer ${customer.id} successfully associated with merchant ${merchantId}`,
            );
          } catch (error) {
            this.logger.error(
              `[CreateTransactionB2C] Failed to associate customer with merchant: ${error.message}`,
            );
            throw new BadRequestException(
              `Failed to register customer with merchant: ${error.message}`,
            );
          }
        }
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

      // Decrypt merchant private key
      this.logger.log(`[CreateTransactionB2C] Decrypting merchant private key`);
      let merchantPrivateKey: string;
      try {
        const salt = this.configService.get<string>('SALT');

        // Detailed SALT checking
        this.logger.log(`[CreateTransactionB2C] SALT exists: ${!!salt}`);
        this.logger.log(
          `[CreateTransactionB2C] SALT length: ${salt?.length || 0}`,
        );
        this.logger.log(
          `[CreateTransactionB2C] SALT (first 10 chars): ${salt?.substring(0, 10)}...`,
        );
        this.logger.log(
          `[CreateTransactionB2C] Encrypted key length: ${merchantEncryptedPrivateKey?.length || 0}`,
        );
        this.logger.log(
          `[CreateTransactionB2C] Full encrypted key: ${merchantEncryptedPrivateKey}`,
        );

        merchantPrivateKey = this.tokenService.decryptKey(
          salt,
          merchantEncryptedPrivateKey,
        );

        // Detailed decryption result checking
        this.logger.log(
          `[CreateTransactionB2C] Decryption result type: ${typeof merchantPrivateKey}`,
        );
        this.logger.log(
          `[CreateTransactionB2C] Decryption result: "${merchantPrivateKey}"`,
        );
        this.logger.log(
          `[CreateTransactionB2C] Is null: ${merchantPrivateKey === null}`,
        );
        this.logger.log(
          `[CreateTransactionB2C] Is undefined: ${merchantPrivateKey === undefined}`,
        );
        this.logger.log(
          `[CreateTransactionB2C] Is empty string: ${merchantPrivateKey === ''}`,
        );
        this.logger.log(
          `[CreateTransactionB2C] Decrypted key length: ${merchantPrivateKey?.length || 0}`,
        );

        // Validate decryption result
        if (!merchantPrivateKey || merchantPrivateKey.length === 0) {
          this.logger.error(
            `[CreateTransactionB2C] Decryption returned empty value!`,
          );
          this.logger.error(
            `[CreateTransactionB2C] This means either: 1) SALT is wrong, 2) Encrypted key is corrupted, 3) Wallet was never properly encrypted`,
          );
          throw new Error('Decryption returned empty value');
        }

        this.logger.log(
          `[CreateTransactionB2C] Merchant private key decrypted successfully`,
        );
        this.logger.log(
          `[CreateTransactionB2C] Decrypted private key (first 10 chars): ${merchantPrivateKey?.substring(0, 10)}...`,
        );

        // Verify that private key matches merchant wallet address
        this.logger.log(
          `[CreateTransactionB2C] Verifying private key matches merchant wallet...`,
        );
        try {
          const { Wallet } = await import('ethers');
          const verifyWallet = new Wallet(merchantPrivateKey);
          const derivedAddress = verifyWallet.address;

          this.logger.log(
            `[CreateTransactionB2C] Address derived from private key: ${derivedAddress}`,
          );
          this.logger.log(
            `[CreateTransactionB2C] Merchant wallet address from DB: ${merchantWalletAddress}`,
          );

          if (
            derivedAddress.toLowerCase() !== merchantWalletAddress.toLowerCase()
          ) {
            this.logger.error(
              `[CreateTransactionB2C] ❌ Private key doesn't match merchant wallet!`,
            );
            this.logger.error(
              `[CreateTransactionB2C] This merchant wallet was encrypted with wrong private key`,
            );
            throw new Error(
              'Private key verification failed - address mismatch',
            );
          }

          this.logger.log(
            `[CreateTransactionB2C] ✅ Private key verified - matches merchant wallet address`,
          );
        } catch (verifyError) {
          this.logger.error(
            `[CreateTransactionB2C] Private key verification failed: ${verifyError.message}`,
          );
          throw verifyError;
        }
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

        // REMOVED FALLBACK: Merchant must use their own wallet, no backend wallet fallback
        // This ensures proper merchant wallet configuration and SALT environment setup
        this.logger.error(
          `[CreateTransactionB2C] ❌ Cannot proceed with transaction - merchant wallet decryption failed`,
        );
        this.logger.error(
          `[CreateTransactionB2C] Please verify: 1) SALT is correctly loaded (should be 28 chars), 2) Merchant wallet was encrypted properly`,
        );
        throw new InternalServerErrorException(
          'Failed to decrypt merchant wallet credentials. Please check SALT configuration.',
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

      // Log transaction input parameters
      this.logger.log(`[CreateTransactionB2C] Transaction input parameters:`);
      this.logger.log(`[CreateTransactionB2C] - amount: ${data.amount}`);
      this.logger.log(
        `[CreateTransactionB2C] - to: ${(customer as any).wallet?.walletAddress || ''}`,
      );
      this.logger.log(
        `[CreateTransactionB2C] - pointAddress: ${point.contractAddress}`,
      );
      this.logger.log(
        `[CreateTransactionB2C] - senderPrivateKey length: ${merchantPrivateKey?.length || 0}`,
      );
      this.logger.log(
        `[CreateTransactionB2C] - senderPrivateKey (first 10 chars): ${merchantPrivateKey?.substring(0, 10)}...`,
      );

      const { txId } = await this.blockchainService.transaction({
        amount: data.amount,
        to: (customer as any).wallet?.walletAddress || '',
        pointAddress: point.contractAddress,
        senderPrivateKey: merchantPrivateKey,
      });

      this.logger.log(
        `[CreateTransactionB2C] Blockchain transaction successful. TxId: ${txId}`,
      );

      const txHashBuffer = new Uint8Array(createBufferFromHex(txId));
      const senderAddressBuffer = Buffer.from(
        merchantWalletAddress.replace(/^0x/, ''),
        'hex',
      );
      const receiverAddressBuffer = Buffer.from(
        ((customer as any).wallet?.walletAddress || '').replace(/^0x/, ''),
        'hex',
      );

      // Create single transaction record with both sender (merchant) and receiver (customer)
      const transaction = await this.db.createTransaction({
        ...rest,
        senderAddress: senderAddressBuffer,
        receiverAddress: receiverAddressBuffer,
        merchant: { connect: { id: merchantId } },
        point: { connect: { id: pointId } },
        senderId: merchantId,
        receiverId: customer.id,
        transactionType: { connect: { id: finalTransactionTypeId } },
        txHash: txHashBuffer,
        eventId: eventId || null,
        type: AssetType.POINT,
        senderType: ParticipantType.MERCHANT,
        receiverType: ParticipantType.CUSTOMER,
        transactionRefId: randomUUID(),
      });

      this.logger.log(
        `[CreateTransactionB2C] Transaction created. ID: ${transaction.id}`,
      );

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
