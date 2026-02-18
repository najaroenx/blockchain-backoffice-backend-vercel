jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));
import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { GetTempLinkByUid } from 'src/modules/internal/templink/handlers/getTempLinkByUid.handler';
import { TempLinkDBService } from 'src/modules/internal/templink/service/templink-db.service';

describe('GetTempLinkByUid', () => {
  let handler: GetTempLinkByUid;
  let db: jest.Mocked<TempLinkDBService>;

  const mockTempLink = {
    uid: 'uid-abc',
    phoneNumber: '0812345678',
    merchantId: 'merchant-1',
    expire: new Date('2025-12-31'),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    db = { getTempLinkByUid: jest.fn() } as any;
    handler = new GetTempLinkByUid(db);
    jest.clearAllMocks();
  });

  it('should return temp link when found', async () => {
    db.getTempLinkByUid.mockResolvedValue(mockTempLink as any);

    const result = await handler.execute('uid-abc');

    expect(result.uid).toBe('uid-abc');
    expect(result.phoneNumber).toBe('0812345678');
  });

  it('should throw NotFoundException when not found', async () => {
    db.getTempLinkByUid.mockResolvedValue(null);

    await expect(handler.execute('nonexistent')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should throw InternalServerErrorException on unexpected error', async () => {
    db.getTempLinkByUid.mockRejectedValue(new Error('DB failed'));

    await expect(handler.execute('uid-abc')).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
