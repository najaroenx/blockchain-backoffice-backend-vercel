import { Injectable } from '@nestjs/common';
import { UserRepository } from '../user.repository';
import { User, Prisma } from '@prisma/client';

@Injectable()
export class UserDBService {
  constructor(private readonly repository: UserRepository) {}

  async createUser(
    data: Omit<Prisma.UserCreateInput, 'userMerchant' | 'session'>,
  ): Promise<User> {
    const user = await this.repository.create<User>({
      data: {
        ...data,
      },
    });

    return user;
  }

  async getUserByEmail(email: string): Promise<User> {
    const user = await this.repository.findFirst<User>({
      where: {
        email,
      },
    });

    return user;
  }
}
