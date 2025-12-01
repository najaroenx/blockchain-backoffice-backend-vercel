jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));
import { InternalServerErrorException } from '@nestjs/common';
import { CreatePoint } from 'src/modules/point/handlers/createPoint.handler';
import { PointDBService } from 'src/modules/point/services/point-db.service';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';
import { GetMerchant } from 'src/modules/merchant/handlers/getMerchantById.handler';

describe('CreatePoint', () => {
  let handler: CreatePoint;
  let dbService: jest.Mocked<PointDBService>;
  let blockchainService: jest.Mocked<BlockchainService>;
  let getMerchant: jest.Mocked<GetMerchant>;

  beforeEach(() => {
    // Mock dependencies
    dbService = {
      createPoint: jest.fn(),
    } as any;

    blockchainService = {
      createNewPointToken: jest.fn(),
    } as any;

    getMerchant = {
      execute: jest.fn(),
    } as any;

    handler = new CreatePoint(dbService, blockchainService, getMerchant);
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

    // Mock getMerchant to return a merchant with wallet
    getMerchant.execute.mockResolvedValue({
      merchant: {
        id: merchantId,
        wallet: {
          walletAddress: '0x123456789',
        },
      },
    } as any);

    // Mock dependencies to return predictable values
    blockchainService.createNewPointToken.mockResolvedValue({
      contractAddress: fakeContractAddress,
      startDate: 0,
      endDate: 0,
      epochDuration: 0,
    });
    dbService.createPoint.mockResolvedValue(fakePoint);

    const result = await handler.execute(merchantId, data);

    // ✅ Expect calls and result
    expect(getMerchant.execute).toHaveBeenCalledWith(merchantId);
    expect(blockchainService.createNewPointToken).toHaveBeenCalled();
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

    // Mock getMerchant to return a merchant with wallet
    getMerchant.execute.mockResolvedValue({
      merchant: {
        id: merchantId,
        wallet: {
          walletAddress: '0x123456789',
        },
      },
    } as any);

    // Mock blockchainService to throw
    blockchainService.createNewPointToken.mockRejectedValue(
      new Error('Blockchain failed'),
    );

    await expect(handler.execute(merchantId, data)).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
