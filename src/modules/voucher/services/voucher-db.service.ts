import { Injectable } from '@nestjs/common';
import { Voucher, Prisma, VoucherStatus } from '@prisma/client';
import { VoucherRepository } from '../voucher.repository';
import { PrismaService } from 'prisma/prisma.service';
import { CreateVoucherWithCodes } from '../handlers/createVoucherWithCodes.handler';
import { CreateVoucherByDevDto, CreateVoucherDto } from '../dtos/voucher.dto';

@Injectable()
export class VoucherDBService {
  constructor(
    private readonly repository: VoucherRepository,
    private readonly prisma: PrismaService,
    private readonly createVoucherWithCodesHandler: CreateVoucherWithCodes,
  ) {}

  async createVoucher(data: Prisma.VoucherCreateInput): Promise<Voucher> {
    const voucher = await this.repository.create<Voucher>({
      data,
    });

    return voucher;
  }

  async createVoucherByDev(data: CreateVoucherByDevDto): Promise<any> {
    // ใช้ handler ที่สร้าง voucher พร้อม codes
    return await this.createVoucherWithCodesHandler.execute(data.coupon);
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

  /**
   * ดึง voucher พร้อม codes ทั้งหมด
   */
  async getVoucherWithCodes(voucherId: string) {
    const voucher = await this.repository.findUnique({
      where: { id: voucherId },
      include: {
        voucherCodes: true,
        merchant: true,
      },
    });

    return voucher;
  }

  /**
   * ตรวจสอบ code และดึงข้อมูล
   */
  async getVoucherByCode(code: string) {
    const voucherCode = await this.prisma.voucherCode.findUnique({
      where: { code },
      include: {
        voucher: {
          include: {
            merchant: true,
          },
        },
      },
    });

    return voucherCode;
  }

  /**
   * ดึง code ที่ยังไม่ได้ใช้
   */
  async getAvailableCode(voucherId: string) {
    const code = await this.prisma.voucherCode.findFirst({
      where: {
        voucherId,
        isUsed: false,
      },
    });

    return code;
  }

  /**
   * Mark code ว่าใช้แล้ว
   */
  async markCodeAsUsed(codeId: string, customerId: string) {
    const code = await this.prisma.voucherCode.update({
      where: { id: codeId },
      data: {
        isUsed: true,
        usedBy: customerId,
        usedAt: new Date(),
      },
    });

    return code;
  }

  /**
   * นับจำนวน codes ที่เหลือ
   */
  async countAvailableCodes(voucherId: string): Promise<number> {
    return this.prisma.voucherCode.count({
      where: {
        voucherId,
        isUsed: false,
      },
    });
  }
}
