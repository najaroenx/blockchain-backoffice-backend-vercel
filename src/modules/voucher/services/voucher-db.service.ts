import { Injectable } from '@nestjs/common';
import { Voucher, Prisma } from '@prisma/client';
import { VoucherRepository } from '../voucher.repository';
import { PrismaService } from 'prisma/prisma.service';
import { CreateVoucherWithCodes } from '../handlers/createVoucherWithCodes.handler';
import { ActivateVoucher } from '../handlers/activateVoucher.handler';
import { RedeemVoucher } from '../handlers/redeemVoucher.handler';
import { BuyCouponFromMarketplace } from '../handlers/buyCouponFromMarketplace.handler';
import { GetCustomerOwnedVouchers } from '../handlers/getCustomerOwnedVouchers.handler';
import { CreateVoucherByDevDto, CreateVoucherDto } from '../dtos/voucher.dto';
import { ActivateVoucherDto } from '../dtos/activate-voucher.dto';

export interface DeleteVoucherResponse {
  success: boolean;
  message: string;
  voucher: Voucher;
  deletedCodesCount: number;
}

@Injectable()
export class VoucherDBService {
  constructor(
    private readonly repository: VoucherRepository,
    private readonly prisma: PrismaService,
    private readonly createVoucherWithCodesHandler: CreateVoucherWithCodes,
    private readonly activateVoucherHandler: ActivateVoucher,
    private readonly redeemVoucherHandler: RedeemVoucher,
    private readonly buyCouponFromMarketplaceHandler: BuyCouponFromMarketplace,
    private readonly getCustomerOwnedVouchersHandler: GetCustomerOwnedVouchers,
  ) {}

  async createVoucher(data: Prisma.VoucherCreateInput): Promise<Voucher> {
    const voucher = await this.repository.create<Voucher>({
      data,
    });

    return voucher;
  }

  async createVoucherWithCodes(data: CreateVoucherDto): Promise<any> {
    // ใช้ handler ที่สร้าง voucher พร้อม codes พร้อม pointsCost
    const { ...voucherData } = data;
    return await this.createVoucherWithCodesHandler.execute(
      voucherData as CreateVoucherDto,
    );
  }

  async createVoucherByDev(data: CreateVoucherByDevDto): Promise<any> {
    // ใช้ handler ที่สร้าง voucher พร้อม codes พร้อม pointsCost
    return await this.createVoucherWithCodesHandler.execute(data.coupon);
  }

  async getVoucherById(voucherId: string): Promise<any> {
    const voucher = await this.repository.findUnique<any>({
      where: { id: voucherId },
      include: {
        merchant: true,
        voucherCodes: {
          take: 1,
          select: {
            pointsCost: true,
          },
        },
      },
    });

    if (!voucher) {
      return null;
    }

    // นับ active codes (codes ที่มี voucherGroupId และยังไม่ถูกใช้)
    const activeCodesCount = await this.prisma.voucherCode.count({
      where: { voucherId, voucherGroupId: { not: null }, isUsed: false },
    });

    // นับ redeemed codes (codes ที่ถูก redeem ไปแล้ว)
    const redeemedCodesCount = await this.prisma.voucherCode.count({
      where: { voucherId, voucherGroupId: { not: null }, isUsed: true },
    });

    // upcoming = totalIssued ที่ยังไม่ได้สร้าง codes
    const upcomingCodesCount = voucher.totalIssued;

    // Format response
    const { voucherCodes, ...voucherData } = voucher;
    return {
      ...voucherData,
      pointsCost: voucherCodes[0]?.pointsCost || 0,
      activeCodesCount,
      totalRedeemed: redeemedCodesCount,
      upcomingCodesCount,
      totalCodes: activeCodesCount + redeemedCodesCount + upcomingCodesCount,
    };
  }

  async getVouchersByMerchant(merchantId: string): Promise<any[]> {
    const vouchers = await this.repository.findMany<any>({
      where: { merchantId },
      include: {
        merchant: true,
        voucherCodes: {
          select: {
            pointsCost: true,
            pointId: true,
            currency: true,
            createdAt: true,
            voucherGroupId: true,
          },
        },
      },
    });

    // Group vouchers โดย createdAt ของ VoucherCode
    const groupedMap = new Map<string, any>();

    for (const voucher of vouchers) {
      // นับ active codes (codes ที่มี voucherGroupId และยังไม่ถูกใช้)
      const activeCodesCount = await this.prisma.voucherCode.count({
        where: {
          voucherId: voucher.id,
          voucherGroupId: { not: null },
          isUsed: false,
        },
      });

      // นับ redeemed codes (codes ที่ถูก redeem ไปแล้ว)
      const redeemedCodesCount = await this.prisma.voucherCode.count({
        where: {
          voucherId: voucher.id,
          voucherGroupId: { not: null },
          isUsed: true,
        },
      });

      // upcoming = totalIssued ที่ยังไม่ได้สร้าง codes
      const upcomingCodesCount = voucher.totalIssued;

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { voucherCodes, ...voucherData } = voucher;

      // ถ้ามี active codes หรือ redeemed codes - หา voucherGroupId ที่ไม่ซ้ำกัน
      if (activeCodesCount > 0 || redeemedCodesCount > 0) {
        // หา voucherGroupId ที่ไม่ซ้ำกันของ codes ที่มี voucherGroupId พร้อมข้อมูลที่ถูกต้อง
        const activatedCodes = await this.prisma.voucherCode.findMany({
          where: { voucherId: voucher.id, voucherGroupId: { not: null } },
          select: {
            voucherGroupId: true,
            createdAt: true,
            pointsCost: true,
            pointId: true,
            currency: true,
          },
          distinct: ['voucherGroupId'],
          orderBy: {
            createdAt: 'asc',
          },
        });

        // แยกกลุ่มตาม voucherGroupId
        for (const codeGroup of activatedCodes) {
          const activeGroupKey = `active|${codeGroup.voucherGroupId}`;

          // นับ codes ที่มี voucherGroupId เดียวกัน (แยกตาม status)
          const availableCodesInGroup = await this.prisma.voucherCode.count({
            where: {
              voucherId: voucher.id,
              voucherGroupId: codeGroup.voucherGroupId,
              isUsed: false,
            },
          });

          const redeemedCodesInGroup = await this.prisma.voucherCode.count({
            where: {
              voucherId: voucher.id,
              voucherGroupId: codeGroup.voucherGroupId,
              isUsed: true,
            },
          });

          if (!groupedMap.has(activeGroupKey)) {
            groupedMap.set(activeGroupKey, {
              baseData: {
                ...voucherData,
                pointsCost: codeGroup.pointsCost,
                pointId: codeGroup.pointId,
                currency: codeGroup.currency,
                activatedAt: codeGroup.createdAt,
                voucherGroupId: codeGroup.voucherGroupId,
              },
              activeCount: 0,
              redeemedCount: 0,
              upcomingCount: 0,
              voucherIds: [],
            });
          }

          const activeGroup = groupedMap.get(activeGroupKey);
          activeGroup.activeCount += availableCodesInGroup;
          activeGroup.redeemedCount += redeemedCodesInGroup;
          if (!activeGroup.voucherIds.includes(voucher.id)) {
            activeGroup.voucherIds.push(voucher.id);
          }
        }
      }

      // ถ้ายังมี upcoming codes
      if (upcomingCodesCount > 0) {
        const upcomingGroupKey = `upcoming|${voucher.id}`;

        if (!groupedMap.has(upcomingGroupKey)) {
          groupedMap.set(upcomingGroupKey, {
            baseData: {
              ...voucherData,
              // ไม่มี pointsCost, pointId, currency เพราะยังไม่ได้ activate
            },
            activeCount: 0,
            upcomingCount: 0,
            voucherIds: [],
          });
        }

        const upcomingGroup = groupedMap.get(upcomingGroupKey);
        upcomingGroup.upcomingCount += upcomingCodesCount;
        if (!upcomingGroup.voucherIds.includes(voucher.id)) {
          upcomingGroup.voucherIds.push(voucher.id);
        }
      }
    }

    // สร้าง result array
    const result = [];
    for (const group of groupedMap.values()) {
      // ถ้ามี active codes หรือ redeemed codes
      if (group.activeCount > 0 || group.redeemedCount > 0) {
        result.push({
          ...group.baseData,
          status: 'active',
          totalIssued: group.activeCount + group.redeemedCount,
          availableCount: group.activeCount,
          totalRedeemed: group.redeemedCount,
          voucherIds: group.voucherIds,
        });
      }

      // ถ้ายังมี upcoming codes
      if (group.upcomingCount > 0) {
        result.push({
          ...group.baseData,
          status: 'upcoming',
          totalIssued: group.upcomingCount,
          availableCount: group.upcomingCount,
          totalRedeemed: 0,
          voucherIds: group.voucherIds,
        });
      }
    }

    return result;
  }

  async getActiveVouchers(): Promise<any[]> {
    // ดึง vouchers ที่มี active codes (codes ที่มี voucherGroupId)
    const vouchersWithActiveCodes = await this.prisma.voucherCode.findMany({
      where: {
        voucherGroupId: { not: null },
        isUsed: false,
      },
      select: {
        voucherId: true,
      },
      distinct: ['voucherId'],
    });

    const voucherIds = vouchersWithActiveCodes.map((v) => v.voucherId);

    if (voucherIds.length === 0) {
      return [];
    }

    // ดึงข้อมูล vouchers
    const vouchers = await this.prisma.voucher.findMany({
      where: {
        id: { in: voucherIds },
      },
      include: {
        merchant: true,
        voucherCodes: {
          take: 1,
          select: {
            pointsCost: true,
          },
        },
      },
    });

    // Format response
    const result = await Promise.all(
      vouchers.map(async (voucher) => {
        const activeCodesCount = await this.prisma.voucherCode.count({
          where: {
            voucherId: voucher.id,
            voucherGroupId: { not: null },
            isUsed: false,
          },
        });

        const redeemedCodesCount = await this.prisma.voucherCode.count({
          where: {
            voucherId: voucher.id,
            voucherGroupId: { not: null },
            isUsed: true,
          },
        });

        const upcomingCodesCount = voucher.totalIssued;

        const { voucherCodes, ...voucherData } = voucher;
        return {
          ...voucherData,
          pointsCost: voucherCodes[0]?.pointsCost || 0,
          activeCodesCount,
          totalRedeemed: redeemedCodesCount,
          upcomingCodesCount,
          totalCodes:
            activeCodesCount + redeemedCodesCount + upcomingCodesCount,
        };
      }),
    );

    return result;
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

  async activateVoucher(
    voucherId: string,
    data: ActivateVoucherDto,
  ): Promise<any> {
    return this.activateVoucherHandler.execute(
      voucherId,
      data.amount,
      data.pointsCost,
      data.pointId,
      data.currency,
    );
  }

  async deleteVoucher(voucherId: string): Promise<DeleteVoucherResponse> {
    // ใช้ transaction เพื่อความปลอดภัย
    const result = await this.prisma.$transaction(async (tx) => {
      // ตรวจสอบว่า voucher มีอยู่จริง
      const voucher = await tx.voucher.findUnique({
        where: { id: voucherId },
        include: {
          _count: {
            select: { voucherCodes: true },
          },
        },
      });

      if (!voucher) {
        throw new Error(`Voucher with ID ${voucherId} not found`);
      }

      const codesCount = voucher._count.voucherCodes;

      // ลบ voucher (cascade จะลบ codes ทั้งหมดอัตโนมัติ)
      const deletedVoucher = await tx.voucher.delete({
        where: { id: voucherId },
      });

      return { voucher: deletedVoucher, deletedCodesCount: codesCount };
    });

    return {
      success: true,
      message: `Voucher deleted successfully with ${result.deletedCodesCount} codes`,
      voucher: result.voucher,
      deletedCodesCount: result.deletedCodesCount,
    };
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

  /**
   * Redeem voucher code
   */
  async redeemVoucher(code: string, phone: string, merchantRef: string) {
    return this.redeemVoucherHandler.execute(code, phone, merchantRef);
  }

  /**
   * Validate voucher code before redeem
   */
  async validateVoucherCode(code: string) {
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

    if (!voucherCode) {
      return {
        valid: false,
        message: 'Voucher code not found',
      };
    }

    if (voucherCode.isUsed) {
      return {
        valid: false,
        message: 'Voucher code has already been redeemed',
        usedAt: voucherCode.usedAt,
        usedBy: voucherCode.usedBy,
      };
    }

    if (!voucherCode.voucherGroupId) {
      return {
        valid: false,
        message: 'Voucher code has not been activated yet',
      };
    }

    const now = new Date();
    const voucher = voucherCode.voucher;

    if (voucher.endDate && new Date(voucher.endDate) < now) {
      return {
        valid: false,
        message: 'Voucher has expired',
        endDate: voucher.endDate,
      };
    }

    if (voucher.startDate && new Date(voucher.startDate) > now) {
      return {
        valid: false,
        message: 'Voucher is not yet valid',
        startDate: voucher.startDate,
      };
    }

    return {
      valid: true,
      message: 'Voucher code is valid',
      voucher: {
        id: voucher.id,
        name: voucher.name,
        description: voucher.description,
        valueType: voucher.valueType,
        value: voucher.value,
        merchantName: voucher.merchant?.name || voucher.merchantName,
        startDate: voucher.startDate,
        endDate: voucher.endDate,
      },
      pointsCost: voucherCode.pointsCost,
    };
  }

  /**
   * Get available vouchers for end users with pagination
   * แยกตาม voucherGroupId
   */
  async getAvailableVouchersForCustomers(
    merchantId: string,
    page: number = 1,
    skip: number = 0,
    limit: number = 20,
  ) {
    const now = new Date();

    // ดึงข้อมูล vouchers ที่ available
    const vouchers = await this.prisma.voucher.findMany({
      where: {
        merchantId,
        startDate: { lte: now },
        endDate: { gte: now },
        voucherCodes: {
          some: {
            voucherGroupId: { not: null },
            isUsed: false,
          },
        },
      },
      include: {
        merchant: {
          select: {
            name: true,
            id: true,
          },
        },
        voucherCodes: {
          where: {
            voucherGroupId: { not: null },
          },
          select: {
            voucherGroupId: true,
            pointsCost: true,
            createdAt: true,
            isUsed: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // แยกตาม voucherGroupId
    const products = [];
    for (const voucher of vouchers) {
      // หา voucherGroupId ที่ไม่ซ้ำกัน
      const uniqueGroups = await this.prisma.voucherCode.findMany({
        where: {
          voucherId: voucher.id,
          voucherGroupId: { not: null },
        },
        select: {
          voucherGroupId: true,
          createdAt: true,
          pointsCost: true,
          point: {
            select: {
              id: true,
              name: true,
              symbol: true,
              imageUrl: true,
            },
          },
        },
        distinct: ['voucherGroupId'],
        orderBy: {
          createdAt: 'desc',
        },
      });

      // สร้าง product สำหรับแต่ละ group
      for (const group of uniqueGroups) {
        // นับ available codes ใน group นี้
        const availableCount = await this.prisma.voucherCode.count({
          where: {
            voucherId: voucher.id,
            voucherGroupId: group.voucherGroupId,
            isUsed: false,
          },
        });

        // ถ้ามี codes available ให้แสดง
        if (availableCount > 0) {
          products.push({
            id: voucher.id,
            voucherGroupId: group.voucherGroupId,
            name: voucher.name,
            description: voucher.description,
            valueType: voucher.valueType,
            value: voucher.value,
            pointsCost: group.pointsCost,
            availableCount,
            activatedAt: group.createdAt,
            startDate: voucher.startDate,
            endDate: voucher.endDate,
            imageUrl: voucher.imageUrl,
            limitPerMember: voucher.limitPerMember,
            merchant: {
              id: (voucher as any).merchant.id,
              name: (voucher as any).merchant.name,
            },
            point: (group as any).point
              ? {
                  id: (group as any).point.id,
                  name: (group as any).point.name,
                  symbol: (group as any).point.symbol,
                  imageUrl: (group as any).point.imageUrl,
                }
              : null,
          });
        }
      }
    }

    // Apply pagination
    const total = products.length;
    const paginatedProducts = products.slice(skip, skip + limit);

    return {
      page,
      limit,
      skip,
      total,
      totalPages: Math.ceil(total / limit),
      products: paginatedProducts,
    };
  }

  /**
   * Get voucher codes by merchant and groupId with pagination
   */
  async getVoucherCodesByGroup(
    merchantId: string,
    groupId: string,
    page: number = 1,
    skip: number = 0,
    limit: number = 20,
  ) {
    // ตรวจสอบว่า voucherGroupId นี้มีอยู่จริงและเป็นของ merchant นี้
    const groupInfo = await this.prisma.voucherCode.findFirst({
      where: {
        voucherGroupId: groupId,
        voucher: {
          merchantId,
        },
      },
      include: {
        voucher: {
          include: {
            merchant: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!groupInfo) {
      return {
        page,
        limit,
        skip,
        total: 0,
        totalPages: 0,
        products: [],
        message: 'Voucher group not found',
      };
    }

    // นับจำนวน codes available ทั้งหมดใน group นี้
    const totalAvailable = await this.prisma.voucherCode.count({
      where: {
        voucherGroupId: groupId,
        isUsed: false,
      },
    });

    // ดึง codes available พร้อม pagination
    const codes = await this.prisma.voucherCode.findMany({
      where: {
        voucherGroupId: groupId,
        isUsed: false,
      },
      skip,
      take: limit,
      orderBy: {
        createdAt: 'asc',
      },
      select: {
        id: true,
        code: true,
        pointsCost: true,
        createdAt: true,
      },
    });

    const voucher = groupInfo.voucher;

    return {
      page,
      limit,
      skip,
      total: totalAvailable,
      totalPages: Math.ceil(totalAvailable / limit),
      voucher: {
        id: voucher.id,
        voucherGroupId: groupId,
        name: voucher.name,
        description: voucher.description,
        valueType: voucher.valueType,
        value: voucher.value,
        startDate: voucher.startDate,
        endDate: voucher.endDate,
        imageUrl: voucher.imageUrl,
        limitPerMember: voucher.limitPerMember,
        merchant: {
          id: voucher.merchant.id,
          name: voucher.merchant.name,
        },
      },
      codes: codes.map((code) => ({
        id: code.id,
        code: code.code,
        pointsCost: code.pointsCost,
        createdAt: code.createdAt,
      })),
    };
  }

  /**
   * Get redemption history for customer by wallet address
   */
  async getRedemptionHistory(walletAddress: string) {
    // Find customer by wallet address
    const wallet = await this.prisma.wallet.findUnique({
      where: { walletAddress },
      include: { customer: true },
    });

    const customer = wallet?.customer;

    if (!customer) {
      return {
        walletAddress,
        customerId: null,
        totalRedeemed: 0,
        redemptions: [],
      };
    }

    const customerId = customer.id;

    const redeemedCodes = await this.prisma.voucherCode.findMany({
      where: {
        usedBy: customerId,
        isUsed: true,
      },
      include: {
        voucher: {
          include: {
            merchant: true,
          },
        },
      },
      orderBy: {
        usedAt: 'desc',
      },
    });

    return {
      walletAddress,
      customerId,
      totalRedeemed: redeemedCodes.length,
      redemptions: redeemedCodes.map((code) => ({
        code: code.code,
        redeemedAt: code.usedAt,
        pointsCost: code.pointsCost,
        voucher: {
          id: code.voucher.id,
          name: code.voucher.name,
          description: code.voucher.description,
          valueType: code.voucher.valueType,
          value: code.voucher.value,
          merchantName:
            code.voucher.merchant?.name || code.voucher.merchantName,
        },
      })),
    };
  }

  /**
   * Buy coupon from marketplace
   */
  async buyCouponFromMarketplace(
    voucherGroupId: string,
    pointId: string,
    address: string,
    phone: string,
  ) {
    return await this.buyCouponFromMarketplaceHandler.execute(
      voucherGroupId,
      pointId,
      address,
      phone,
    );
  }

  /**
   * Get vouchers owned by customer by wallet address
   */
  async getCustomerOwnedVouchers(
    walletAddress: string,
    status?: 'unused' | 'used' | 'all',
    page?: number,
    limit?: number,
  ) {
    return await this.getCustomerOwnedVouchersHandler.execute(
      walletAddress,
      status,
      page,
      limit,
    );
  }
}
