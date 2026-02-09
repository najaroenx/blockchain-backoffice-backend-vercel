import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { PrismaRepository } from 'src/repository';

@Injectable()
export class ApiKeyRepository extends PrismaRepository<'apiKey'> {
  constructor() {
    super(new PrismaService(), 'apiKey');
  }
}
