import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { PrismaRepository } from 'src/repository';

@Injectable()
export class TempLinkRepository extends PrismaRepository<'tempLinkCreateUser'> {
  constructor() {
    super(new PrismaService(), 'tempLinkCreateUser');
  }
}
