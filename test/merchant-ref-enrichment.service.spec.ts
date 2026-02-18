jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));
import { MerchantRefEnrichmentService } from 'src/modules/shared/services/merchant-ref-enrichment.service';

describe('MerchantRefEnrichmentService', () => {
  let service: MerchantRefEnrichmentService;
  let prisma: any;

  const mockStore = {
    id: 'mrs-1',
    merchantRef: 'REF001',
    name: 'Store One',
    category: 'Food',
    description: 'Desc',
    imageUrl: null,
    locationUrl: null,
    website: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    prisma = {
      merchantRefStore: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
    };
    service = new MerchantRefEnrichmentService(prisma);
    jest.clearAllMocks();
  });

  describe('enrich', () => {
    it('should return store detail for valid merchantRef', async () => {
      prisma.merchantRefStore.findUnique.mockResolvedValue(mockStore);

      const result = await service.enrich('REF001');

      expect(result).toEqual(mockStore);
      expect(prisma.merchantRefStore.findUnique).toHaveBeenCalledWith({
        where: { merchantRef: 'REF001' },
      });
    });

    it('should return null for empty merchantRef', async () => {
      const result = await service.enrich('');

      expect(result).toBeNull();
      expect(prisma.merchantRefStore.findUnique).not.toHaveBeenCalled();
    });

    it('should return null when store not found', async () => {
      prisma.merchantRefStore.findUnique.mockResolvedValue(null);

      const result = await service.enrich('NONEXISTENT');

      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      prisma.merchantRefStore.findUnique.mockRejectedValue(
        new Error('DB error'),
      );

      const result = await service.enrich('REF001');

      expect(result).toBeNull();
    });
  });

  describe('enrichBatch', () => {
    it('should return map of merchantRef details', async () => {
      prisma.merchantRefStore.findMany.mockResolvedValue([mockStore]);

      const result = await service.enrichBatch(['REF001', 'REF002']);

      expect(result.get('REF001')).toEqual(mockStore);
      expect(prisma.merchantRefStore.findMany).toHaveBeenCalledWith({
        where: { merchantRef: { in: ['REF001', 'REF002'] } },
      });
    });

    it('should return empty map for empty input', async () => {
      const result = await service.enrichBatch([]);

      expect(result.size).toBe(0);
      expect(prisma.merchantRefStore.findMany).not.toHaveBeenCalled();
    });

    it('should deduplicate refs', async () => {
      prisma.merchantRefStore.findMany.mockResolvedValue([mockStore]);

      await service.enrichBatch(['REF001', 'REF001', 'REF001']);

      expect(prisma.merchantRefStore.findMany).toHaveBeenCalledWith({
        where: { merchantRef: { in: ['REF001'] } },
      });
    });

    it('should filter out falsy values', async () => {
      prisma.merchantRefStore.findMany.mockResolvedValue([]);

      await service.enrichBatch([null, '', undefined] as any);

      expect(prisma.merchantRefStore.findMany).not.toHaveBeenCalled();
    });

    it('should return empty map on error', async () => {
      prisma.merchantRefStore.findMany.mockRejectedValue(new Error('DB error'));

      const result = await service.enrichBatch(['REF001']);

      expect(result.size).toBe(0);
    });
  });
});
