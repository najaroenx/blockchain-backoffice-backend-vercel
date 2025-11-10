import { Injectable } from '@nestjs/common';
import { Voucher, Prisma, VoucherStatus } from '@prisma/client';
import { VoucherRepository } from '../voucher.repository';

@Injectable()
export class VoucherDBService {
  constructor(private readonly repository: VoucherRepository) {}

  async createVoucher(data: Prisma.VoucherCreateInput): Promise<Voucher> {
    const voucher = await this.repository.create<Voucher>({
      data,
    });

    return voucher;
  }

  async getVoucherById(voucherId: string): Promise<Voucher> {
    const voucher = await this.repository.findUnique<Voucher>({
      where: { id: voucherId },
    });

    return voucher;
  }

  async getVouchersByMerchant(merchantId: string): Promise<Voucher[]> {
    const vouchers = await this.repository.findMany<Voucher>({
      where: { merchantId },
      include: { merchant: true },
    });

    return vouchers;
  }

  async getActiveVouchers(): Promise<Voucher[]> {
    const vouchers = await this.repository.findMany<Voucher>({
      where: { status: VoucherStatus.active },
      include: { merchant: true },
    });

    return vouchers;
  }

  async updateVoucher(
    voucherId: string,
    data: Prisma.VoucherUpdateInput,
  ): Promise<Voucher> {
    const voucher = await this.repository.update<Voucher>({
      where: { id: voucherId },
      data,
    });

    return voucher;
  }

  async deleteVoucher(voucherId: string): Promise<Voucher> {
    const voucher = await this.repository.delete({
      where: { id: voucherId },
    });

    return voucher;
  }

  async getAllVouchers(): Promise<Voucher[]> {
    const vouchers = await this.repository.findMany<Voucher>({
      include: { merchant: true },
    });

    return vouchers;
  }
}
