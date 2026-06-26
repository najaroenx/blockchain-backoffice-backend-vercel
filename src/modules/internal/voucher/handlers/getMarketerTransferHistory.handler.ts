import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class GetMarketerTransferHistoryHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(merchantId: string, pageNum = 1, limitNum = 10) {
    if (!merchantId) {
      throw new BadRequestException('Merchant ID is required');
    }

    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
    });

    if (!merchant) {
      throw new NotFoundException(`Merchant with ID ${merchantId} not found`);
    }

    const page = pageNum > 0 ? pageNum : 1;
    const limit = limitNum > 0 ? limitNum : 10;

    const totalRecords = await this.prisma.batchTransferLog.count({
      where: { merchantId },
    });

    const logs = await this.prisma.batchTransferLog.findMany({
      where: { merchantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: (page - 1) * limit,
    });

    const history = logs.map((log) => ({
      batchJobId: log.id,
      fileName: log.fileName,
      status: log.status,
      totalRecords: log.totalRecords,
      successfulCount: log.successfulCount,
      failedCount: log.failedCount,
      createdAt: log.createdAt.toISOString(),
      details: log.details || [],
    }));

    return {
      summary: {
        page,
        limit,
        totalRecords,
      },
      history,
    };
  }
}
