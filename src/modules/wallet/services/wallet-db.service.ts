import { Injectable, NotFoundException } from '@nestjs/common';
import { WalletRepository } from '../wallet.repository';
import { Wallet } from '@prisma/client';

@Injectable()
export class WalletDBService {
  constructor(private readonly repository: WalletRepository) {}

  /**
   * ดึง wallet จาก phone number หรือ email
   */
  async getWalletByPhoneOrEmail(
    phoneNumber?: string,
    email?: string,
  ): Promise<Wallet | null> {
    if (!phoneNumber && !email) {
      return null;
    }

    const wallet = await this.repository.findFirst<Wallet>({
      where: {
        OR: [
          ...(phoneNumber ? [{ phoneNumber }] : []),
          ...(email ? [{ email }] : []),
        ],
      },
    });

    return wallet;
  }

  /**
   * ดึง wallet จาก ID
   */
  async getWalletById(id: string): Promise<Wallet> {
    const wallet = await this.repository.findUnique<Wallet>({
      where: { id },
    });

    if (!wallet) {
      throw new NotFoundException(`Wallet with ID ${id} not found`);
    }

    return wallet;
  }

  /**
   * ดึง wallet จาก customer ID
   */
  async getWalletByCustomerId(customerId: string): Promise<Wallet | null> {
    const wallet = await this.repository.findFirst<Wallet>({
      where: {
        customer: {
          id: customerId,
        },
      },
    });

    return wallet;
  }

  /**
   * ดึง wallet จาก merchant ID
   */
  async getWalletByMerchantId(merchantId: string): Promise<Wallet | null> {
    const wallet = await this.repository.findFirst<Wallet>({
      where: {
        merchant: {
          id: merchantId,
        },
      },
    });

    return wallet;
  }

  /**
   * สร้าง wallet ใหม่
   */
  async createWallet(data: {
    privateKey: string;
    email: string;
    phoneNumber: string;
    type: string;
    status: string;
  }): Promise<Wallet> {
    return await this.repository.create<Wallet>({
      data,
    });
  }

  /**
   * อัพเดท wallet
   */
  async updateWallet(
    id: string,
    data: {
      email?: string;
      phoneNumber?: string;
      status?: string;
    },
  ): Promise<Wallet> {
    return await this.repository.update<Wallet>({
      where: { id },
      data,
    });
  }
}
