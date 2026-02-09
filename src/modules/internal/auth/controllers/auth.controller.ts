import {
  Body,
  Controller,
  HttpCode,
  Logger,
  Post,
  Param,
  Get,
} from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import { LoginDto, RegisterDto } from '../dtos';
import { Public } from '../public.decorator';

@Controller('auth')
@Public()
export class AuthController {
  private logger = new Logger(AuthController.name);
  constructor(private authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  async login(@Body() data: LoginDto) {
    return this.authService.login(data.email, data.password);
  }

  @Get('toverify')
  @HttpCode(200)
  async toverify(@Param('merchantId') merchantId: string) {
    return {
      message: `This merchant ${merchantId} is to verify`,
      url: 'http://localhost:3000/otp?kid=dsadasdasdasd&cb=profile',
      callbackUrl: 'http://localhost:4001/auth/verify',
    };
  }

  @Post('register')
  @HttpCode(201)
  async register(@Body() data: RegisterDto) {
    this.logger.log(`Registering user with`);
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
