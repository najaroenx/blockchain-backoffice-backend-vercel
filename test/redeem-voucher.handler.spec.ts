import { Test, TestingModule } from '@nestjs/testing';
import { RedeemVoucher } from '../src/modules/voucher/handlers/redeemVoucher.handler';
import { PrismaService } from '../prisma/prisma.service';
import { BlockchainService } from '../src/providers/blockchain/blockchain.service';
import { TokenService } from '../src/providers/token/token.service';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  MockDataFactory,
  createMockPrismaClient,
  createMockBlockchainService,
  createMockTokenService,
  createMockConfigService,
} from './fixtures';

describe('RedeemVoucher', () => {
  let handler: RedeemVoucher;
  let prisma: any;
  let blockchainService: any;
  let tokenService: any;
  let configService: any;

  beforeEach(async () => {
    prisma = createMockPrismaClient();
    blockchainService = createMockBlockchainService();
    tokenService = createMockTokenService();
    configService = createMockConfigService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedeemVoucher,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: BlockchainService,
          useValue: blockchainService,
        },
        {
          provide: TokenService,
          useValue: tokenService,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    handler = module.get<RedeemVoucher>(RedeemVoucher);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  describe('execute', () => {
    it('should successfully redeem voucher and release vault funds', async () => {
      const code = 'VOUCHER-0001';
      const phone = '0812345678';
      const merchantRef = 'REF-123';

      const mockCustomer = MockDataFactory.createMockCustomer({
        id: 'customer-123',
        tel: phone,
      });

      const mockVoucher = MockDataFactory.createMockVoucher({
        id: 'voucher-123',
        merchantRef,
        status: 'active',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-12-31'),
        tokenId: '12345',
      });

      const mockVoucherCode = MockDataFactory.createMockVoucherCode({
        id: 'code-123',
        code,
        voucherId: mockVoucher.id,
        currentOwnerId: mockCustomer.id,
        isUsed: false,
        voucher: mockVoucher,
      });

      const mockPoint = MockDataFactory.createMockPoint({
        id: 'point-123',
        contractAddress: Buffer.from('POINT_ADDRESS', 'hex'),
      });

      // Setup mocks
      prisma.customer.findFirst.mockResolvedValue(mockCustomer);
      prisma.voucherCode.findUnique.mockResolvedValue(mockVoucherCode);
      prisma.point.findUnique.mockResolvedValue(mockPoint);

      blockchainService.redeemVoucher.mockResolvedValue({
        hash: '0xREDEEM_TX_HASH',
      });

      blockchainService.hasActiveVaultEscrow.mockResolvedValue(true);
      blockchainService.releaseVaultFundsPartial.mockResolvedValue({
        hash: '0xVAULT_RELEASE_TX_HASH',
      });

      prisma.$transaction.mockImplementation(async (callback) => {
        return callback(prisma);
      });

      prisma.voucherCode.update.mockResolvedValue({
        ...mockVoucherCode,
        isUsed: true,
        usedBy: mockCustomer.id,
        usedAt: new Date(),
      });

      prisma.voucher.update.mockResolvedValue({
        ...mockVoucher,
        totalRedeemed: 1,
      });

      // Execute
      const result = await handler.execute(code, phone, merchantRef);

      // Assertions
      expect(prisma.customer.findFirst).toHaveBeenCalledWith({
        where: { tel: phone },
        include: { wallet: true },
      });

      expect(prisma.voucherCode.findUnique).toHaveBeenCalledWith({
        where: { code },
        include: expect.objectContaining({
          voucher: true,
        }),
      });

      expect(blockchainService.redeemVoucher).toHaveBeenCalled();
      expect(blockchainService.releaseVaultFundsPartial).toHaveBeenCalled();

      expect(prisma.voucherCode.update).toHaveBeenCalledWith({
        where: { code },
        data: expect.objectContaining({
          isUsed: true,
          usedBy: mockCustomer.id,
        }),
      });

      expect(prisma.voucher.update).toHaveBeenCalledWith({
        where: { id: mockVoucher.id },
        data: { totalRedeemed: { increment: 1 } },
      });

      expect(result).toMatchObject({
        message: expect.stringContaining('successfully redeemed'),
      });
    });

    it('should throw NotFoundException when customer not found', async () => {
      prisma.customer.findFirst.mockResolvedValue(null);

      await expect(
        handler.execute('VOUCHER-0001', '0812345678', 'REF-123'),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.customer.findFirst).toHaveBeenCalled();
    });

    it('should throw NotFoundException when voucher code not found', async () => {
      const mockCustomer = MockDataFactory.createMockCustomer();

      prisma.customer.findFirst.mockResolvedValue(mockCustomer);
      prisma.voucherCode.findUnique.mockResolvedValue(null);

      await expect(
        handler.execute('INVALID-CODE', '0812345678', 'REF-123'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when voucher already used', async () => {
      const mockCustomer = MockDataFactory.createMockCustomer();
      const mockVoucher = MockDataFactory.createMockVoucher();
      const mockVoucherCode = MockDataFactory.createMockVoucherCode({
        isUsed: true,
        voucher: mockVoucher,
      });

      prisma.customer.findFirst.mockResolvedValue(mockCustomer);
      prisma.voucherCode.findUnique.mockResolvedValue(mockVoucherCode);

      await expect(
        handler.execute('VOUCHER-0001', '0812345678', 'REF-123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when voucher code not owned by customer', async () => {
      const mockCustomer = MockDataFactory.createMockCustomer({
        id: 'customer-123',
      });
      const mockVoucher = MockDataFactory.createMockVoucher();
      const mockVoucherCode = MockDataFactory.createMockVoucherCode({
        currentOwnerId: 'different-customer',
        isUsed: false,
        voucher: mockVoucher,
      });

      prisma.customer.findFirst.mockResolvedValue(mockCustomer);
      prisma.voucherCode.findUnique.mockResolvedValue(mockVoucherCode);

      await expect(
        handler.execute('VOUCHER-0001', '0812345678', 'REF-123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when voucher expired', async () => {
      const mockCustomer = MockDataFactory.createMockCustomer({
        id: 'customer-123',
      });
      const mockVoucher = MockDataFactory.createMockVoucher({
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'), // Expired
      });
      const mockVoucherCode = MockDataFactory.createMockVoucherCode({
        currentOwnerId: 'customer-123',
        isUsed: false,
        voucher: mockVoucher,
      });

      prisma.customer.findFirst.mockResolvedValue(mockCustomer);
      prisma.voucherCode.findUnique.mockResolvedValue(mockVoucherCode);

      await expect(
        handler.execute('VOUCHER-0001', '0812345678', 'REF-123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when merchantRef does not match', async () => {
      const mockCustomer = MockDataFactory.createMockCustomer({
        id: 'customer-123',
      });
      const mockVoucher = MockDataFactory.createMockVoucher({
        merchantRef: 'REF-123',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-12-31'),
      });
      const mockVoucherCode = MockDataFactory.createMockVoucherCode({
        currentOwnerId: 'customer-123',
        isUsed: false,
        voucher: mockVoucher,
      });

      prisma.customer.findFirst.mockResolvedValue(mockCustomer);
      prisma.voucherCode.findUnique.mockResolvedValue(mockVoucherCode);

      await expect(
        handler.execute('VOUCHER-0001', '0812345678', 'WRONG-REF'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
