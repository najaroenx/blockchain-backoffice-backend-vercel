jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));
jest.mock('src/libs/convertBufferToAddress', () => ({
  convertBufferToAddress: jest.fn(
    (buf) => '0x' + Buffer.from(buf || []).toString('hex'),
  ),
}));

import {
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { GetVoucherByMerchantRef } from 'src/modules/internal/voucher/handlers/getVoucherByMerchantRef.handler';
import { PrismaService } from 'prisma/prisma.service';
import { MerchantRefEnrichmentService } from 'src/modules/shared/services/merchant-ref-enrichment.service';

describe('GetVoucherByMerchantRef', () => {
  let handler: GetVoucherByMerchantRef;
  let prisma: any;
  let merchantRefEnrichment: any;

  beforeEach(() => {
    prisma = {
      voucher: { findFirst: jest.fn() },
      transaction: { findMany: jest.fn() },
      customer: { findUnique: jest.fn() },
      merchant: { findUnique: jest.fn() },
    };
    merchantRefEnrichment = { enrich: jest.fn() };
    handler = new GetVoucherByMerchantRef(
      prisma as unknown as PrismaService,
      merchantRefEnrichment as unknown as MerchantRefEnrichmentService,
    );
  });

  it('should throw NotFoundException when voucher not found', async () => {
    prisma.voucher.findFirst.mockResolvedValue(null);
    await expect(handler.execute('ref1')).rejects.toThrow(NotFoundException);
  });

  it('should return empty when no voucherCodes', async () => {
    prisma.voucher.findFirst.mockResolvedValue({
      id: 'v1',
      merchantRef: 'ref1',
      merchant: {
        id: 'm1',
        name: 'Merchant1',
        wallet: { walletAddress: '0x1' },
      },
      voucherCodes: [],
    });

    const result = await handler.execute('ref1');
    expect(result).toEqual({ transactions: [], counts: 0 });
  });

  it('should return transformed transactions', async () => {
    prisma.voucher.findFirst.mockResolvedValue({
      id: 'v1',
      merchantRef: 'ref1',
      merchant: {
        id: 'm1',
        name: 'Merchant1',
        website: 'web',
        wallet: { walletAddress: '0x1' },
      },
      voucherCodes: [{ id: 'vc1' }],
    });

    merchantRefEnrichment.enrich.mockResolvedValue({ name: 'Store1' });

    prisma.transaction.findMany.mockResolvedValue([
      {
        id: 'tx1',
        txHash: Buffer.from('abc', 'hex'),
        senderAddress: Buffer.from('def', 'hex'),
        receiverAddress: Buffer.from('123', 'hex'),
        transactionTypeId: 'REDEEM',
        amount: 1,
        senderId: 'customer1',
        receiverId: 'm1',
        merchantId: 'm1',
        eventId: null,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        type: 'VOUCHER',
        merchant: { name: 'Merchant1' },
        point: null,
        voucherCode: {
          voucher: {
            id: 'v1',
            name: 'V1',
            valueType: 'cash',
            value: 100,
            imageUrl: null,
          },
        },
      },
    ]);

    prisma.customer.findUnique.mockResolvedValue({ tel: '0891234567' });
    prisma.merchant.findUnique.mockResolvedValue({ name: 'Merchant1' });

    const result = await handler.execute('ref1');

    expect(result.counts).toBe(1);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].id).toBe('tx1');
  });

  it('should throw InternalServerErrorException on unexpected error', async () => {
    prisma.voucher.findFirst.mockRejectedValue(new Error('DB fail'));

    await expect(handler.execute('ref1')).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
