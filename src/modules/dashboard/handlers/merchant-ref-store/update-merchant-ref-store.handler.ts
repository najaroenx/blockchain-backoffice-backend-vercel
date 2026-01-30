import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import {
  UpdateMerchantRefStoreDto,
  MerchantRefStoreResponse,
} from '../../dtos/merchant-ref-store.dto';

@Injectable()
export class UpdateMerchantRefStoreHandler {
  private readonly logger = new Logger(UpdateMerchantRefStoreHandler.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(
    id: string,
    dto: UpdateMerchantRefStoreDto,
  ): Promise<MerchantRefStoreResponse> {
    this.logger.debug(`Updating MerchantRefStore: ${id}`);

    // Check if store exists
    const existing = await this.prisma.merchantRefStore.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`MerchantRefStore with id ${id} not found`);
    }

    // If updating merchantRef, check for uniqueness
    if (dto.merchantRef && dto.merchantRef !== existing.merchantRef) {
      const duplicate = await this.prisma.merchantRefStore.findUnique({
        where: { merchantRef: dto.merchantRef },
      });

      if (duplicate) {
        throw new ConflictException(
          `MerchantRefStore with merchantRef "${dto.merchantRef}" already exists`,
        );
      }
    }

    const store = await this.prisma.merchantRefStore.update({
      where: { id },
      data: {
        ...(dto.merchantRef && { merchantRef: dto.merchantRef }),
        ...(dto.name && { name: dto.name }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
        ...(dto.locationUrl !== undefined && { locationUrl: dto.locationUrl }),
        ...(dto.website !== undefined && { website: dto.website }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    this.logger.log(`Updated MerchantRefStore: ${store.id}`);

    return store as MerchantRefStoreResponse;
  }
}
