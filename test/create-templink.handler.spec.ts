jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));
import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateTempLink } from 'src/modules/internal/templink/handlers/createTempLink.handler';
import { TempLinkDBService } from 'src/modules/internal/templink/service/templink-db.service';

jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'mock-uuid-1234'),
}));

describe('CreateTempLink', () => {
  let handler: CreateTempLink;
  let db: jest.Mocked<TempLinkDBService>;

  const mockTempLink = {
    id: 'tl-1',
    uid: 'mock-uuid-1234',
    phoneNumber: '0812345678',
    merchantId: 'merchant-1',
    expire: new Date('2025-12-31'),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    db = { createTempLink: jest.fn() } as any;
    handler = new CreateTempLink(db);
    jest.clearAllMocks();
  });

  it('should create temp link and return formatted response', async () => {
    db.createTempLink.mockResolvedValue(mockTempLink as any);

    const result = await handler.execute(
      '0812345678',
      'merchant-1',
      new Date('2025-12-31'),
    );

    expect(db.createTempLink).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: 'mock-uuid-1234',
        phoneNumber: '0812345678',
        merchantId: 'merchant-1',
      }),
    );
    expect(result.uid).toBe('mock-uuid-1234');
    expect(result.phoneNumber).toBe('0812345678');
  });

  it('should throw InternalServerErrorException on error', async () => {
    db.createTempLink.mockRejectedValue(new Error('DB failed'));

    await expect(
      handler.execute('0812345678', 'merchant-1', new Date()),
    ).rejects.toThrow(InternalServerErrorException);
  });
});
