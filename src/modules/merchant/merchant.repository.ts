import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { PrismaRepository } from 'src/repository';

@Injectable()
export class MerchantRepository extends PrismaRepository<'merchant'> {
  constructor() {
    super(new PrismaService(), 'merchant');
  }
}
