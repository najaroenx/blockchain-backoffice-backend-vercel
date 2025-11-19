import { Injectable } from '@nestjs/common';
import { TempLinkRepository } from '../templink.repository';
import { TempLinkCreateUser, Prisma } from '@prisma/client';

@Injectable()
export class TempLinkDBService {
  constructor(private readonly repository: TempLinkRepository) {}

  async createTempLink(
    data: Prisma.TempLinkCreateUserCreateInput,
  ): Promise<TempLinkCreateUser> {
    const tempLink = await this.repository.create<TempLinkCreateUser>({
      data,
    });
    return tempLink;
  }

  async getTempLinkByUid(uid: string): Promise<TempLinkCreateUser | null> {
    const tempLink = await this.repository.findUnique<TempLinkCreateUser>({
      where: { uid },
    });
    return tempLink;
  }

  async getTempLinkByPhoneNumber(
    phoneNumber: string,
  ): Promise<TempLinkCreateUser | null> {
    const tempLink = await this.repository.findFirst<TempLinkCreateUser>({
      where: { phoneNumber },
      orderBy: { createdAt: 'desc' },
    });
    return tempLink;
  }

  async getTempLinksByMerchant(
    merchantId: string,
  ): Promise<TempLinkCreateUser[]> {
    const tempLinks = await this.repository.findMany<TempLinkCreateUser>({
      where: { merchantId },
      orderBy: { createdAt: 'desc' },
    });
    return tempLinks;
  }

  async deleteTempLink(uid: string): Promise<TempLinkCreateUser> {
    const deleted = await this.repository.delete({
      where: { uid },
    });
    return deleted;
  }

  async deleteExpiredTempLinks(): Promise<number> {
    const result = await this.repository.deleteMany({
      where: {
        expire: {
          lt: new Date(),
        },
      },
    });
    return result.count;
  }

  async updateTempLink(
    uid: string,
    data: Prisma.TempLinkCreateUserUpdateInput,
  ): Promise<TempLinkCreateUser> {
    const updated = await this.repository.update<TempLinkCreateUser>({
      where: { uid },
      data,
    });
    return updated;
  }

  async getActiveTempLink(uid: string): Promise<TempLinkCreateUser | null> {
    const tempLink = await this.repository.findFirst<TempLinkCreateUser>({
      where: {
        uid,
        expire: {
          gt: new Date(),
        },
      },
    });
    return tempLink;
  }
}
