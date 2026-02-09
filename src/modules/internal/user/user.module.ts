import { Module } from '@nestjs/common';
import { UserRepository } from './user.repository';
import { UserDBService } from './services/user-db.service';

@Module({
  controllers: [],
  providers: [UserDBService, UserRepository],
  exports: [UserDBService],
})
export class UserModule {}
