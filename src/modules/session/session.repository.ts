import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { PrismaRepository } from 'src/repository';

@Injectable()
export class SessionRepository extends PrismaRepository<'session'> {
  constructor() {
    super(new PrismaService(), 'session');
  }
}
