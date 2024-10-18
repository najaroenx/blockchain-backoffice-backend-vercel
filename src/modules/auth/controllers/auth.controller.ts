import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import { LoginDto, RegisterDto } from '../dtos';
import { Public } from '../public.decorator';

@Controller('auth')
@Public()
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  async login(@Body() data: LoginDto) {
    return this.authService.login(data.email, data.password);
  }

  @Post('register')
  @HttpCode(201)
  async register(@Body() data: RegisterDto) {
    return this.authService.register({
      email: data.email,
      password: data.password,
    });
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body('token') refreshToken: string) {
    return this.authService.refresh(refreshToken);
  }
}
