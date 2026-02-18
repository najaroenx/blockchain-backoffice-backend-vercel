jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));
import { InternalServerErrorException } from '@nestjs/common';
import { GetTempLinksByMerchant } from 'src/modules/internal/templink/handlers/getTempLinksByMerchant.handler';
import { TempLinkDBService } from 'src/modules/internal/templink/service/templink-db.service';

describe('GetTempLinksByMerchant', () => {
  let handler: GetTempLinksByMerchant;
  let db: jest.Mocked<TempLinkDBService>;

  beforeEach(() => {
    db = { getTempLinksByMerchant: jest.fn() } as any;
    handler = new GetTempLinksByMerchant(db);
    jest.clearAllMocks();
  });

  it('should return formatted temp links for merchant', async () => {
    const mockLinks = [
      {
        uid: 'uid-1',
        phoneNumber: '0812345678',
        merchantId: 'merchant-1',
        expire: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        uid: 'uid-2',
        phoneNumber: '0899999999',
        merchantId: 'merchant-1',
        expire: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    db.getTempLinksByMerchant.mockResolvedValue(mockLinks as any);

    const result = await handler.execute('merchant-1');

    expect(result.tempLinks).toHaveLength(2);
    expect(result.tempLinks[0].uid).toBe('uid-1');
    expect(result.tempLinks[1].uid).toBe('uid-2');
  });

  it('should return empty array when no temp links', async () => {
    db.getTempLinksByMerchant.mockResolvedValue([]);

    const result = await handler.execute('merchant-x');

    expect(result.tempLinks).toEqual([]);
  });

  it('should throw InternalServerErrorException on error', async () => {
    db.getTempLinksByMerchant.mockRejectedValue(new Error('DB error'));

    await expect(handler.execute('merchant-1')).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
