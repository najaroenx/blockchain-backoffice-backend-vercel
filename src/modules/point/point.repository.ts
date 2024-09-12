import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { PrismaRepository } from 'src/repository';

@Injectable()
export class PointRepository extends PrismaRepository<'point'> {
  constructor() {
    super(new PrismaService(), 'point');
  }
}
