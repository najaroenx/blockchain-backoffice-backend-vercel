jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { AddToWhitelist } from 'src/modules/internal/voucher/handlers/addToWhitelist.handler';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';

// Mock ethers.isAddress
jest.mock('ethers', () => ({
  ethers: {
    isAddress: jest.fn(
      (addr: string) => addr.startsWith('0x') && addr.length === 42,
    ),
  },
}));

describe('AddToWhitelist', () => {
  let handler: AddToWhitelist;
  let blockchainService: any;

  beforeEach(() => {
    blockchainService = {
      isWhitelisted: jest.fn(),
      addToMarketplaceWhitelist: jest.fn(),
      batchAddToMarketplaceWhitelist: jest.fn(),
    };
    handler = new AddToWhitelist(
      blockchainService as unknown as BlockchainService,
    );
  });

  describe('execute', () => {
    const validAddress = '0x1234567890123456789012345678901234567890';

    it('should throw BadRequestException for invalid address', async () => {
      await expect(handler.execute('invalid')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return already whitelisted when address is already on whitelist', async () => {
      blockchainService.isWhitelisted.mockResolvedValue(true);
      const result = await handler.execute(validAddress);
      expect(result.success).toBe(true);
      expect(result.data.wasAlreadyWhitelisted).toBe(true);
    });

    it('should add address to whitelist successfully', async () => {
      blockchainService.isWhitelisted.mockResolvedValue(false);
      blockchainService.addToMarketplaceWhitelist.mockResolvedValue({
        hash: '0xtxhash',
        blockNumber: 12345,
      });

      const result = await handler.execute(validAddress);

      expect(result.success).toBe(true);
      expect(result.data.wasAlreadyWhitelisted).toBe(false);
      expect(result.data.txHash).toBe('0xtxhash');
      expect(result.data.blockNumber).toBe(12345);
    });

    it('should throw InternalServerErrorException on blockchain failure', async () => {
      blockchainService.isWhitelisted.mockRejectedValue(new Error('RPC fail'));

      await expect(handler.execute(validAddress)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('executeBatch', () => {
    const addr1 = '0x1234567890123456789012345678901234567890';
    const addr2 = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';

    it('should throw BadRequestException for invalid addresses in batch', async () => {
      await expect(handler.executeBatch([addr1, 'invalid'])).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return message when all already whitelisted', async () => {
      blockchainService.isWhitelisted.mockResolvedValue(true);

      const result = await handler.executeBatch([addr1, addr2]);

      expect(result.success).toBe(true);
      expect(result.data.newlyWhitelisted).toBe(0);
      expect(result.data.alreadyWhitelisted).toBe(2);
    });

    it('should batch whitelist new addresses', async () => {
      blockchainService.isWhitelisted
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      blockchainService.batchAddToMarketplaceWhitelist.mockResolvedValue({
        hash: '0xbatchhash',
        blockNumber: 99,
      });

      const result = await handler.executeBatch([addr1, addr2]);

      expect(result.success).toBe(true);
      expect(result.data.alreadyWhitelisted).toBe(1);
      expect(result.data.newlyWhitelisted).toBe(1);
      expect(result.data.txHash).toBe('0xbatchhash');
    });

    it('should throw InternalServerErrorException on batch failure', async () => {
      blockchainService.isWhitelisted.mockResolvedValue(false);
      blockchainService.batchAddToMarketplaceWhitelist.mockRejectedValue(
        new Error('fail'),
      );

      await expect(handler.executeBatch([addr1])).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('checkStatus', () => {
    const validAddress = '0x1234567890123456789012345678901234567890';

    it('should throw BadRequestException for invalid address', async () => {
      await expect(handler.checkStatus('bad')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return whitelist status', async () => {
      blockchainService.isWhitelisted.mockResolvedValue(true);

      const result = await handler.checkStatus(validAddress);

      expect(result.success).toBe(true);
      expect(result.data.isWhitelisted).toBe(true);
    });

    it('should throw InternalServerErrorException on failure', async () => {
      blockchainService.isWhitelisted.mockRejectedValue(new Error('fail'));

      await expect(handler.checkStatus(validAddress)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
