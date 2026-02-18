jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));
import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DeleteTempLink } from 'src/modules/internal/templink/handlers/deleteTempLink.handler';
import { TempLinkDBService } from 'src/modules/internal/templink/service/templink-db.service';

describe('DeleteTempLink', () => {
  let handler: DeleteTempLink;
  let db: jest.Mocked<TempLinkDBService>;

  const mockTempLink = {
    uid: 'uid-abc',
    phoneNumber: '0812345678',
    merchantId: 'merchant-1',
    expire: new Date(),
  };

  beforeEach(() => {
    db = {
      getTempLinkByUid: jest.fn(),
      deleteTempLink: jest.fn(),
    } as any;
    handler = new DeleteTempLink(db);
    jest.clearAllMocks();
  });

  it('should delete temp link when found', async () => {
    db.getTempLinkByUid.mockResolvedValue(mockTempLink as any);
    db.deleteTempLink.mockResolvedValue(mockTempLink as any);

    const result = await handler.execute('uid-abc');

    expect(db.getTempLinkByUid).toHaveBeenCalledWith('uid-abc');
    expect(db.deleteTempLink).toHaveBeenCalledWith('uid-abc');
    expect(result.message).toBe('Temp link deleted successfully');
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
