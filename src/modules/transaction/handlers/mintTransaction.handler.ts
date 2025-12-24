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
import { Prisma, AssetType } from '@prisma/client';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';
// import { createBufferFromHex } from 'src/libs/createBufferFromHex';
import { CreateTransaction as CreateTransactionResponse } from '../types';
import { GetCustomerPhone } from 'src/modules/customer/handlers/getCustomerByPhone.handler';
import { UpdateCustomer } from 'src/modules/customer/handlers/updateCustomer.handler';
import { GetPointById } from 'src/modules/point/handlers/getPointById.handler';
import { ConfigService } from '@nestjs/config';
import { TransactionTypeId } from 'src/constants/transaction-types.enum';
import { ADDRESS_ZERO } from 'src/constants';

@Injectable()
export class MintTransaction {
  private salt: string;

  private logger = new Logger(MintTransaction.name);

  constructor(
    private readonly db: TransactionDBService,
    private readonly getPointByIdHandler: GetPointById,
    private readonly blockchainService: BlockchainService,
    private readonly getCustomerByPhone: GetCustomerPhone,
    private readonly updateCustomer: UpdateCustomer,
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
    > & { transactionTypeId: string; phone: string },
  ): Promise<CreateTransactionResponse> {
    try {
      const { phone, ...rest } = data;

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

      const { txId } = await this.blockchainService.mint({
        amount: data.amount,
        to: (customer as any).wallet?.walletAddress || '',
        pointAddress: point.contractAddress,
      });

      const transaction = await this.db.createTransaction({
        ...rest,
        senderAddress: Buffer.from(ADDRESS_ZERO.replace(/^0x/, ''), 'hex'),
        receiverAddress: Uint8Array.from(
          Buffer.from(
            ((customer as any).wallet?.walletAddress || '').replace(/^0x/, ''),
            'hex',
          ),
        ),
        merchant: { connect: { id: merchantId } },
        point: { connect: { id: pointId } },
        receiver: { connect: { id: customer.id } },
        transactionType: { connect: { id: TransactionTypeId.MINT } },
        // txHash: createBufferFromHex(txId),
        txHash: Uint8Array.from(Buffer.from(txId.replace(/^0x/, ''), 'hex')),
        type: AssetType.POINT,
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
