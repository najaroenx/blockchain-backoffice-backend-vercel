import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { UserRepository } from './user.repository';

@Injectable()
export class UserService {
  constructor(private repository: UserRepository) {}

  async login(email: string, password: string) {
    try {
      const user = await this.repository.getUserByEmail(email, password);

      if (!user) throw new NotFoundException('data_not_found');

      return {
        id: user.id,
        email: user.email,
      };
    } catch (error) {
      console.log(error);
      if (error instanceof NotFoundException) {
        throw error;
      } else {
        throw new InternalServerErrorException('server_error');
      }
    }
  }
}
