import { Injectable } from '@nestjs/common';
import { PrismaRepository } from 'src/repository/PrismaRepository';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class WalletRepository extends PrismaRepository<'wallet'> {
  constructor(prisma: PrismaService) {
    super(prisma, 'wallet');
  }
}
