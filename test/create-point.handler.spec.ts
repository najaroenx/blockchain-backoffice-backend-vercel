jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));
import { InternalServerErrorException } from '@nestjs/common';
import { CreatePoint } from 'src/modules/point/handlers/createPoint.handler';
import { PointDBService } from 'src/modules/point/services/point-db.service';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';

describe('CreatePoint', () => {
  let handler: CreatePoint;
  let dbService: jest.Mocked<PointDBService>;
  let blockchainService: jest.Mocked<BlockchainService>;

  beforeEach(() => {
    // Mock dependencies
    dbService = {
      createPoint: jest.fn(),
    } as any;

    blockchainService = {
      createNewPointToken: jest.fn(),
    } as any;

    handler = new CreatePoint(dbService, blockchainService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should create a point successfully', async () => {
    const merchantId = 'merchant-123';
    const data = { name: 'My Point', initialSupply: 100 } as any;
    const fakeContractAddress = Buffer.from('0xABCDEF');
    const fakePoint = {
      id: '1',
      name: 'My Point',
      contractAddress: fakeContractAddress,
    } as any;

    // Mock dependencies to return predictable values
    blockchainService.createNewPointToken.mockResolvedValue(
      fakeContractAddress,
    );
    dbService.createPoint.mockResolvedValue(fakePoint);

    const result = await handler.execute(merchantId, data);

    // ✅ Expect calls and result
    expect(blockchainService.createNewPointToken).toHaveBeenCalledWith(data);
    expect(dbService.createPoint).toHaveBeenCalledWith(
      merchantId,
      fakeContractAddress,
      data,
    );
    expect(result).toEqual(fakePoint);
  });
  it('should throw InternalServerErrorException on error', async () => {
    const merchantId = 'merchant-123';
    const data = { name: 'My Point' } as any;

    // Mock blockchainService to throw
    blockchainService.createNewPointToken.mockRejectedValue(
      new Error('Blockchain failed'),
    );

    await expect(handler.execute(merchantId, data)).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
