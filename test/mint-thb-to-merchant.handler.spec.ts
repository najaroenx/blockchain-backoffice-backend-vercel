jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MintTHBToMerchant } from 'src/modules/internal/admin/handlers/mintTHBToMerchant.handler';

describe('MintTHBToMerchant', () => {
  let handler: MintTHBToMerchant;
  let prisma: any;
  let blockchainService: any;

  beforeEach(() => {
    prisma = {
      merchant: { findUnique: jest.fn() },
      wallet: { findUnique: jest.fn() },
    };
    blockchainService = {
      mintTHB: jest.fn(),
      getUserTHBBalance: jest.fn(),
    };
    handler = new MintTHBToMerchant(prisma, blockchainService);
    jest.clearAllMocks();
  });

  it('should mint THB to merchant wallet successfully', async () => {
    prisma.merchant.findUnique.mockResolvedValue({
      id: 'merchant-1',
      name: 'Test Merchant',
      walletId: 'wallet-1',
    });
    prisma.wallet.findUnique.mockResolvedValue({
      walletAddress: '0xMerchantWallet',
    });
    blockchainService.mintTHB.mockResolvedValue({
      hash: '0xTxHash',
      blockNumber: 12345,
    });
    blockchainService.getUserTHBBalance.mockResolvedValue({
      balance: '1100',
      balanceWei: '1100000000000000000000',
    });

    const result = await handler.execute('merchant-1', 1000);

    expect(result.success).toBe(true);
    expect(result.merchant.id).toBe('merchant-1');
    expect(result.mint.amount).toBe(1000);
    expect(result.blockchain.transactionHash).toBe('0xTxHash');
  });

  it('should throw NotFoundException when merchant not found', async () => {
    prisma.merchant.findUnique.mockResolvedValue(null);

    await expect(handler.execute('nonexistent', 100)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should throw BadRequestException when merchant has no wallet', async () => {
    prisma.merchant.findUnique.mockResolvedValue({
      id: 'merchant-1',
      name: 'Test',
      walletId: null,
    });

    await expect(handler.execute('merchant-1', 100)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should throw NotFoundException when wallet not found in DB', async () => {
    prisma.merchant.findUnique.mockResolvedValue({
      id: 'merchant-1',
      name: 'Test',
      walletId: 'wallet-1',
    });
    prisma.wallet.findUnique.mockResolvedValue(null);

    await expect(handler.execute('merchant-1', 100)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should propagate blockchain error', async () => {
    prisma.merchant.findUnique.mockResolvedValue({
      id: 'merchant-1',
      name: 'Test',
      walletId: 'wallet-1',
    });
    prisma.wallet.findUnique.mockResolvedValue({
      walletAddress: '0xMerchantWallet',
    });
    blockchainService.mintTHB.mockRejectedValue(new Error('Blockchain error'));

    await expect(handler.execute('merchant-1', 100)).rejects.toThrow(Error);
  });
});
