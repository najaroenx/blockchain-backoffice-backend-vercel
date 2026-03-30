import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';
import { convertBufferToAddress } from 'src/libs/convertBufferToAddress';

@Injectable()
export class FixWalletOnchainHandler {
  private logger = new Logger(FixWalletOnchainHandler.name);

  constructor(
    private prisma: PrismaService,
    private blockchainService: BlockchainService,
  ) {}

  /**
   * GET /fix/wallet-onchain/:merchantId
   * Compare DB balances vs on-chain balances for all customers of a merchant
   * @param onlyMismatch — if true, return only mismatched wallets
   */
  async execute(merchantId: string, onlyMismatch: boolean = false) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { id: true, name: true },
    });
    if (!merchant) throw new NotFoundException(`Merchant ${merchantId} not found`);

    // Find points for this merchant
    const points = await this.prisma.point.findMany({
      where: { merchantId },
      select: { id: true, name: true, symbol: true, contractAddress: true },
    });

    if (points.length === 0) {
      return {
        merchant: { id: merchant.id, name: merchant.name },
        points: [],
        total: 0,
        match: 0,
        mismatch: 0,
        wallets: [],
      };
    }

    // Get customer points with wallet info
    const customerPoints = await this.prisma.customerPoint.findMany({
      where: { pointId: { in: points.map((p) => p.id) } },
      include: {
        customer: {
          select: {
            id: true,
            tel: true,
            wallet: { select: { walletAddress: true } },
          },
        },
      },
    });

    const pointMap = new Map(points.map((p) => [p.id, p]));

    const wallets: {
      phone: string;
      pointName: string;
      walletAddress: string;
      dbBalance: number;
      onChainBalance: number;
      diff: number;
      match: boolean;
    }[] = [];

    for (const cp of customerPoints) {
      const point = pointMap.get(cp.pointId!);
      if (!point || !cp.customer?.wallet?.walletAddress) continue;

      const walletAddress = cp.customer.wallet.walletAddress;
      const pointAddress = convertBufferToAddress(point.contractAddress as any);

      let onChainBalance = 0;
      try {
        const result = await this.blockchainService.getBalance({
          walletAddress,
          pointAddress,
        });
        onChainBalance = Math.floor(parseFloat(result.balance));
      } catch (err: any) {
        this.logger.warn(`Error reading balance for ${walletAddress}: ${err.message}`);
        continue;
      }

      const dbBalance = cp.balances || 0;
      const diff = dbBalance - onChainBalance;

      if (onlyMismatch && diff === 0) continue;

      wallets.push({
        phone: cp.customer.tel || cp.customer.id,
        pointName: `${point.name} (${point.symbol})`,
        walletAddress,
        dbBalance,
        onChainBalance,
        diff,
        match: diff === 0,
      });
    }

    wallets.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

    const matchCount = wallets.filter((w) => w.match).length;
    const mismatchCount = wallets.filter((w) => !w.match).length;

    return {
      merchant: { id: merchant.id, name: merchant.name },
      points: points.map((p) => ({
        id: p.id,
        name: p.name,
        symbol: p.symbol,
        contractAddress: convertBufferToAddress(p.contractAddress as any),
      })),
      total: wallets.length,
      match: matchCount,
      mismatch: mismatchCount,
      wallets,
    };
  }
}
