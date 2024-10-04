import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import { PrismaRepository } from 'src/repository';

@Injectable()
export class UserRepository extends PrismaRepository<'user'> {
  constructor() {
    super(new PrismaService(), 'user');
  }

  async getUserByEmail(email: string, password: string): Promise<User> {
    const user = await this.findFirst<User>({
      where: {
        email,
        password,
      },
    });

    return user;
  }
}
