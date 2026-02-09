import {
  Injectable,
  BadRequestException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';
import { ethers } from 'ethers';

/**
 * Handler สำหรับ manual whitelist addresses บน marketplace
 */
@Injectable()
export class AddToWhitelist {
  private logger = new Logger(AddToWhitelist.name);

  constructor(private blockchainService: BlockchainService) {}

  async execute(address: string): Promise<any> {
    try {
      this.logger.log(`[START] Adding address to whitelist: ${address}`);

      if (!ethers.isAddress(address)) {
        throw new BadRequestException(
          `Invalid Ethereum address format: ${address}`,
        );
      }

      const isWhitelisted = await this.blockchainService.isWhitelisted(address);

      if (isWhitelisted) {
        this.logger.log(`[INFO] Address ${address} is already whitelisted`);
        return {
          success: true,
          message: 'Address is already whitelisted',
          data: {
            address,
            wasAlreadyWhitelisted: true,
          },
        };
      }

      this.logger.log(`[PROCESS] Adding ${address} to whitelist...`);
      const result =
        await this.blockchainService.addToMarketplaceWhitelist(address);

      this.logger.log(
        `[SUCCESS] Address ${address} whitelisted. Tx: ${result.hash}`,
      );

      return {
        success: true,
        message: 'Address added to whitelist successfully',
        data: {
          address,
          txHash: result.hash,
          blockNumber: result.blockNumber,
          wasAlreadyWhitelisted: false,
        },
      };
    } catch (error) {
      this.logger.error(
        `[ERROR] Failed to whitelist address: ${error.message}`,
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException(
        `Failed to add address to whitelist: ${error.message}`,
      );
    }
  }

  async executeBatch(addresses: string[]): Promise<any> {
    try {
      this.logger.log(
        `[START] Batch whitelisting ${addresses.length} addresses`,
      );

      const invalidAddresses = addresses.filter(
        (addr) => !ethers.isAddress(addr),
      );

      if (invalidAddresses.length > 0) {
        throw new BadRequestException(
          `Invalid address formats: ${invalidAddresses.join(', ')}`,
        );
      }

      const whitelistStatuses = await Promise.all(
        addresses.map(async (addr) => ({
          address: addr,
          isWhitelisted: await this.blockchainService.isWhitelisted(addr),
        })),
      );

      const alreadyWhitelisted = whitelistStatuses
        .filter((s) => s.isWhitelisted)
        .map((s) => s.address);
      const needsWhitelist = whitelistStatuses
        .filter((s) => !s.isWhitelisted)
        .map((s) => s.address);

      this.logger.log(
        `[INFO] ${alreadyWhitelisted.length} already whitelisted, ${needsWhitelist.length} need whitelisting`,
      );

      if (needsWhitelist.length === 0) {
        return {
          success: true,
          message: 'All addresses are already whitelisted',
          data: {
            total: addresses.length,
            alreadyWhitelisted: alreadyWhitelisted.length,
            newlyWhitelisted: 0,
            addresses: alreadyWhitelisted,
          },
        };
      }

      this.logger.log(
        `[PROCESS] Batch whitelisting ${needsWhitelist.length} addresses...`,
      );
      const result =
        await this.blockchainService.batchAddToMarketplaceWhitelist(
          needsWhitelist,
        );

      this.logger.log(`[SUCCESS] Batch whitelist complete. Tx: ${result.hash}`);

      return {
        success: true,
        message: `Successfully whitelisted ${needsWhitelist.length} addresses`,
        data: {
          total: addresses.length,
          alreadyWhitelisted: alreadyWhitelisted.length,
          newlyWhitelisted: needsWhitelist.length,
          txHash: result.hash,
          blockNumber: result.blockNumber,
          whitelistedAddresses: needsWhitelist,
          skippedAddresses: alreadyWhitelisted,
        },
      };
    } catch (error) {
      this.logger.error(`[ERROR] Batch whitelist failed: ${error.message}`);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException(
        `Failed to batch whitelist addresses: ${error.message}`,
      );
    }
  }

  async checkStatus(address: string): Promise<any> {
    try {
      this.logger.log(`[START] Checking whitelist status for: ${address}`);

      if (!ethers.isAddress(address)) {
        throw new BadRequestException(
          `Invalid Ethereum address format: ${address}`,
        );
      }

      const isWhitelisted = await this.blockchainService.isWhitelisted(address);

      this.logger.log(
        `[SUCCESS] Address ${address} whitelist status: ${isWhitelisted}`,
      );

      return {
        success: true,
        data: {
          address,
          isWhitelisted,
        },
      };
    } catch (error) {
      this.logger.error(
        `[ERROR] Failed to check whitelist status: ${error.message}`,
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException(
        `Failed to check whitelist status: ${error.message}`,
      );
    }
  }
}
