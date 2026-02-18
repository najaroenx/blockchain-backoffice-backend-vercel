jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));
import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { UpdateTempLink } from 'src/modules/internal/templink/handlers/updateTempLink.handler';
import { TempLinkDBService } from 'src/modules/internal/templink/service/templink-db.service';

describe('UpdateTempLink', () => {
  let handler: UpdateTempLink;
  let db: jest.Mocked<TempLinkDBService>;

  const mockTempLink = {
    uid: 'uid-abc',
    phoneNumber: '0812345678',
    merchantId: 'merchant-1',
    expire: new Date('2025-12-31'),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    db = {
      getTempLinkByUid: jest.fn(),
      updateTempLink: jest.fn(),
    } as any;
    handler = new UpdateTempLink(db);
    jest.clearAllMocks();
  });

  it('should update temp link with new expire', async () => {
    const newExpire = new Date('2026-06-30');
    db.getTempLinkByUid.mockResolvedValue(mockTempLink as any);
    db.updateTempLink.mockResolvedValue({
      ...mockTempLink,
      expire: newExpire,
    } as any);

    const result = await handler.execute('uid-abc', newExpire);

    expect(db.updateTempLink).toHaveBeenCalledWith('uid-abc', {
      expire: newExpire,
    });
    expect(result.uid).toBe('uid-abc');
  });

  it('should use existing expire when no new expire provided', async () => {
    db.getTempLinkByUid.mockResolvedValue(mockTempLink as any);
    db.updateTempLink.mockResolvedValue(mockTempLink as any);

    await handler.execute('uid-abc');

    expect(db.updateTempLink).toHaveBeenCalledWith('uid-abc', {
      expire: mockTempLink.expire,
    });
  });

  it('should throw NotFoundException when temp link not found', async () => {
    db.getTempLinkByUid.mockResolvedValue(null);

    await expect(handler.execute('nonexistent')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should throw InternalServerErrorException on unexpected error', async () => {
    db.getTempLinkByUid.mockRejectedValue(new Error('DB error'));

    await expect(handler.execute('uid-abc')).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
