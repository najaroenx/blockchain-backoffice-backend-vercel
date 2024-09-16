import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { PrismaRepository } from 'src/repository';

@Injectable()
export class TransactionRepository extends PrismaRepository<'transaction'> {
  constructor() {
    super(new PrismaService(), 'transaction');
  }
}
