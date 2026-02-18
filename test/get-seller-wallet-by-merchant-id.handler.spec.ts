jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));
import { NotFoundException } from '@nestjs/common';
import { GetSellerWalletByMerchantId } from 'src/modules/internal/wallet/handlers/getSellerWalletByMerchantId.handler';
import { WalletDBService } from 'src/modules/internal/wallet/services/wallet-db.service';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';

describe('GetSellerWalletByMerchantId', () => {
  let handler: GetSellerWalletByMerchantId;
  let walletDB: jest.Mocked<WalletDBService>;
  let blockchainService: jest.Mocked<BlockchainService>;

  const mockWallet = {
    id: 'wallet-seller-1',
    walletAddress: '0xSellerWallet123',
    seedPhrase: 'secret seed phrase',
    chainCode: 'secret chain code',
    derivationIndex: 1,
    type: 'seller',
    status: 'active',
    phoneNumber: '0812345678',
  };

  beforeEach(() => {
    walletDB = {
      getSellerWalletByMerchantId: jest.fn(),
    } as any;

    blockchainService = {
      getUserTHBBalance: jest.fn(),
    } as any;

    handler = new GetSellerWalletByMerchantId(walletDB, blockchainService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should return seller wallet with THB balance', async () => {
    walletDB.getSellerWalletByMerchantId.mockResolvedValue(mockWallet as any);
    blockchainService.getUserTHBBalance.mockResolvedValue({
      balance: '1000',
    } as any);

    const result = await handler.execute('merchant-123');

    expect(walletDB.getSellerWalletByMerchantId).toHaveBeenCalledWith(
      'merchant-123',
    );
    expect(result.walletAddress).toBe('0xSellerWallet123');
    expect(result.thbBalance).toBe('1000');
    // Sensitive data should be excluded
    expect(result).not.toHaveProperty('seedPhrase');
    expect(result).not.toHaveProperty('chainCode');
  });

  it('should return seller wallet without THB balance when includeTHBBalance is false', async () => {
    walletDB.getSellerWalletByMerchantId.mockResolvedValue(mockWallet as any);

    const result = await handler.execute('merchant-123', false);

    expect(blockchainService.getUserTHBBalance).not.toHaveBeenCalled();
    expect(result).not.toHaveProperty('thbBalance');
  });

  it('should return wallet even when THB balance fails', async () => {
    walletDB.getSellerWalletByMerchantId.mockResolvedValue(mockWallet as any);
    blockchainService.getUserTHBBalance.mockRejectedValue(
      new Error('Blockchain error'),
    );

    const result = await handler.execute('merchant-123');

    // Should not throw, just skip THB balance
    expect(result.walletAddress).toBe('0xSellerWallet123');
    expect(result).not.toHaveProperty('thbBalance');
  });

  it('should throw NotFoundException when seller wallet not found', async () => {
    walletDB.getSellerWalletByMerchantId.mockResolvedValue(null);

    await expect(handler.execute('nonexistent')).rejects.toThrow(
      NotFoundException,
    );
  });
});
