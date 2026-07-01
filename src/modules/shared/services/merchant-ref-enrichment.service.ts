import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';

export interface MerchantRefDetail {
  id: string;
  merchantRef: string;
  name: string;
  category: string | null;
  description: string | null;
  imageUrl: string | null;
  locationUrl: string | null;
  website: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class MerchantRefEnrichmentService {
  private readonly logger = new Logger(MerchantRefEnrichmentService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Enrich a single merchantRef string into full MerchantRefStore detail
   */
  async enrich(merchantRef: string): Promise<MerchantRefDetail | null> {
    if (!merchantRef) return null;

    try {
      const store = await this.prisma.merchantRefStore.findUnique({
        where: { merchantRef },
      });

      if (!store) {
        this.logger.warn(`MerchantRefStore not found for ref: ${merchantRef}`);
        return null;
      }

      return store;
    } catch (error) {
      this.logger.error(
        `Failed to enrich merchantRef: ${merchantRef}`,
        error.stack,
      );
      return null;
    }
  }

  /**
   * Batch enrich multiple merchantRefs in one query (prevents N+1)
   */
  async enrichBatch(
    merchantRefs: string[],
  ): Promise<Map<string, MerchantRefDetail>> {
    const uniqueRefs = [...new Set(merchantRefs.filter(Boolean))];
    const map = new Map<string, MerchantRefDetail>();

    if (uniqueRefs.length === 0) return map;

    try {
      const stores = await this.prisma.merchantRefStore.findMany({
        where: { merchantRef: { in: uniqueRefs } },
      });

      for (const store of stores) {
        map.set(store.merchantRef, store);
      }
    } catch (error) {
      this.logger.error('Failed to batch enrich merchantRefs', error.stack);
    }

    return map;
  }
}
