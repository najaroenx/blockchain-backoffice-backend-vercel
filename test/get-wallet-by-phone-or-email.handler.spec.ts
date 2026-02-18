jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));
import { NotFoundException } from '@nestjs/common';
import { GetWalletByPhoneOrEmail } from 'src/modules/internal/wallet/handlers/getWalletByPhoneOrEmail.handler';
import { WalletDBService } from 'src/modules/internal/wallet/services/wallet-db.service';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';

describe('GetWalletByPhoneOrEmail', () => {
  let handler: GetWalletByPhoneOrEmail;
  let walletDB: jest.Mocked<WalletDBService>;
  let blockchainService: jest.Mocked<BlockchainService>;

  const mockWallet = {
    id: 'wallet-1',
    walletAddress: '0xWalletAddress123',
    seedPhrase: 'secret seed',
    chainCode: 'secret chain code',
    derivationIndex: 0,
    type: 'customer',
    status: 'active',
    phoneNumber: '0812345678',
    email: 'test@example.com',
  };

  beforeEach(() => {
    walletDB = {
      getWalletByPhoneOrEmail: jest.fn(),
    } as any;

    blockchainService = {
      getUserTHBBalance: jest.fn(),
    } as any;

    handler = new GetWalletByPhoneOrEmail(walletDB, blockchainService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should return wallet with THB balance by phone', async () => {
    walletDB.getWalletByPhoneOrEmail.mockResolvedValue(mockWallet as any);
    blockchainService.getUserTHBBalance.mockResolvedValue({
      balance: '250',
    } as any);

    const result = await handler.execute('0812345678', undefined, true);

    expect(walletDB.getWalletByPhoneOrEmail).toHaveBeenCalledWith(
      '0812345678',
      undefined,
    );
    expect(result.walletAddress).toBe('0xWalletAddress123');
    expect(result.thbBalance).toEqual({ balance: '250' });
    expect(result).not.toHaveProperty('seedPhrase');
    expect(result).not.toHaveProperty('chainCode');
  });

  it('should return wallet by email', async () => {
    walletDB.getWalletByPhoneOrEmail.mockResolvedValue(mockWallet as any);
    blockchainService.getUserTHBBalance.mockResolvedValue({
      balance: '100',
    } as any);

    const result = await handler.execute(undefined, 'test@example.com', true);

    expect(walletDB.getWalletByPhoneOrEmail).toHaveBeenCalledWith(
      undefined,
      'test@example.com',
    );
    expect(result.walletAddress).toBe('0xWalletAddress123');
  });

  it('should return wallet without THB balance when includeTHBBalance is false', async () => {
    walletDB.getWalletByPhoneOrEmail.mockResolvedValue(mockWallet as any);

    const result = await handler.execute('0812345678', undefined, false);

    expect(blockchainService.getUserTHBBalance).not.toHaveBeenCalled();
    expect(result.thbBalance).toBeNull();
  });

  it('should return wallet with null THB balance when blockchain fails', async () => {
    walletDB.getWalletByPhoneOrEmail.mockResolvedValue(mockWallet as any);
    blockchainService.getUserTHBBalance.mockRejectedValue(
      new Error('Blockchain error'),
    );

    const result = await handler.execute('0812345678');

    expect(result.walletAddress).toBe('0xWalletAddress123');
    expect(result.thbBalance).toBeNull();
  });

  it('should throw NotFoundException when wallet not found', async () => {
    walletDB.getWalletByPhoneOrEmail.mockResolvedValue(null);

    await expect(handler.execute('0000000000')).rejects.toThrow(
      NotFoundException,
    );
  });
});
