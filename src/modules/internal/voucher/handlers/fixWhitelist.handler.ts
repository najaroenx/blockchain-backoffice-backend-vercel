import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';

@Injectable()
export class FixWhitelistHandler {
  private logger = new Logger(FixWhitelistHandler.name);

  constructor(
    private prisma: PrismaService,
    private blockchainService: BlockchainService,
  ) {}

  /**
   * GET /fix/whitelist/check — Check whitelist status for all wallets
   */
  async check() {
    const wallets = await this.prisma.wallet.findMany({
      select: { id: true, walletAddress: true },
    });

    const addresses = [
      ...new Set(
        wallets
          .map((w) => w.walletAddress)
          .filter((a): a is string => !!a),
      ),
    ];

    const results: { address: string; whitelisted: boolean }[] = [];
    for (const addr of addresses) {
      const whitelisted = await this.blockchainService.isWhitelisted(addr);
      results.push({ address: addr, whitelisted });
    }

    const whitelisted = results.filter((r) => r.whitelisted).length;
    const notWhitelisted = results.filter((r) => !r.whitelisted).length;

    return {
      total: results.length,
      whitelisted,
      notWhitelisted,
      addresses: results,
    };
  }

  /**
   * POST /fix/whitelist/add — Add all non-whitelisted wallets to whitelist
   */
  async addAll(dryRun: boolean = true) {
    const wallets = await this.prisma.wallet.findMany({
      select: { id: true, walletAddress: true },
    });

    const addresses = [
      ...new Set(
        wallets
          .map((w) => w.walletAddress)
          .filter((a): a is string => !!a),
      ),
    ];

    // Check current status
    const toAdd: string[] = [];
    const alreadyWhitelisted: string[] = [];

    for (const addr of addresses) {
      const whitelisted = await this.blockchainService.isWhitelisted(addr);
      if (whitelisted) {
        alreadyWhitelisted.push(addr);
      } else {
        toAdd.push(addr);
      }
    }

    if (toAdd.length === 0) {
      return {
        dryRun,
        total: addresses.length,
        alreadyWhitelisted: alreadyWhitelisted.length,
        added: 0,
        message: 'All addresses already whitelisted',
      };
    }

    const added: { address: string; txHash: string }[] = [];

    if (!dryRun) {
      for (const addr of toAdd) {
        const result =
          await this.blockchainService.addToMarketplaceWhitelist(addr);
        added.push({ address: addr, txHash: result.hash });
      }
    }

    return {
      dryRun,
      total: addresses.length,
      alreadyWhitelisted: alreadyWhitelisted.length,
      toAdd: toAdd.length,
      added: dryRun ? 0 : added.length,
      addressesToAdd: toAdd,
      addedDetails: dryRun ? undefined : added,
      message: dryRun
        ? `${toAdd.length} addresses need whitelisting. Use ?dryRun=false to apply.`
        : `Added ${added.length} addresses to whitelist.`,
    };
  }
}
