import { Body, Controller, Post } from '@nestjs/common';
import { UserService } from './user.service';
import { UserLoginDto } from './dtos';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('login')
  async login(@Body() body: UserLoginDto) {
    const { email, password } = body;
    const user = await this.userService.login(email, password);

    return user;
  }
}
