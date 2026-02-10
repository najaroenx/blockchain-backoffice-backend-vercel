import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { MerchantRefStoreResponse } from '../../dtos/merchant-ref-store.dto';

@Injectable()
export class DeleteMerchantRefStoreHandler {
  private readonly logger = new Logger(DeleteMerchantRefStoreHandler.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Soft delete - set isActive = false
   */
  async execute(id: string): Promise<MerchantRefStoreResponse> {
    this.logger.debug(`Soft deleting MerchantRefStore: ${id}`);

    // Check if store exists
    const existing = await this.prisma.merchantRefStore.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`MerchantRefStore with id ${id} not found`);
    }

    const store = await this.prisma.merchantRefStore.update({
      where: { id },
      data: { isActive: false },
    });

    this.logger.log(`Soft deleted MerchantRefStore: ${store.id}`);

    return store as MerchantRefStoreResponse;
  }

  /**
   * Hard delete - remove from database permanently
   */
  async hardDelete(id: string): Promise<void> {
    this.logger.debug(`Hard deleting MerchantRefStore: ${id}`);

    // Check if store exists
    const existing = await this.prisma.merchantRefStore.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`MerchantRefStore with id ${id} not found`);
    }

    await this.prisma.merchantRefStore.delete({
      where: { id },
    });

    this.logger.log(`Hard deleted MerchantRefStore: ${id}`);
  }
}
