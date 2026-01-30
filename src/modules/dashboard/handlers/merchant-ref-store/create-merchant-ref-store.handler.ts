import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import {
  CreateMerchantRefStoreDto,
  MerchantRefStoreResponse,
} from '../../dtos/merchant-ref-store.dto';

@Injectable()
export class CreateMerchantRefStoreHandler {
  private readonly logger = new Logger(CreateMerchantRefStoreHandler.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(
    dto: CreateMerchantRefStoreDto,
  ): Promise<MerchantRefStoreResponse> {
    this.logger.debug(
      `Creating MerchantRefStore with merchantRef: ${dto.merchantRef}`,
    );

    // Check if merchantRef already exists
    const existing = await this.prisma.merchantRefStore.findUnique({
      where: { merchantRef: dto.merchantRef },
    });

    if (existing) {
      throw new ConflictException(
        `MerchantRefStore with merchantRef "${dto.merchantRef}" already exists`,
      );
    }

    const store = await this.prisma.merchantRefStore.create({
      data: {
        merchantRef: dto.merchantRef,
        name: dto.name,
        category: dto.category,
        description: dto.description,
        imageUrl: dto.imageUrl,
        locationUrl: dto.locationUrl,
        website: dto.website,
        isActive: true,
      },
    });

    this.logger.log(
      `Created MerchantRefStore: ${store.id} with merchantRef: ${store.merchantRef}`,
    );

    return store as MerchantRefStoreResponse;
  }
}
