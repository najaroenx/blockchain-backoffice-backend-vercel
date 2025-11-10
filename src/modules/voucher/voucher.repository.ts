import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { PrismaRepository } from 'src/repository';

@Injectable()
export class VoucherRepository extends PrismaRepository<'voucher'> {
  constructor() {
    super(new PrismaService(), 'voucher');
  }
}
