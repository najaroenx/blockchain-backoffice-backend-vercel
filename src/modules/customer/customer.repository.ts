import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { PrismaRepository } from 'src/repository';

@Injectable()
export class CustomerRepository extends PrismaRepository<'customer'> {
  constructor() {
    super(new PrismaService(), 'customer');
  }
}
