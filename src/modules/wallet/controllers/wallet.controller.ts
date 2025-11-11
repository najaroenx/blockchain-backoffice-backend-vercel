import {
  Controller,
  Get,
  HttpCode,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { GetWalletByPhoneOrEmail } from '../handlers/getWalletByPhoneOrEmail.handler';
import { Public } from 'src/modules/auth/public.decorator';

@Controller('wallet')
export class WalletController {
  constructor(
    private readonly getWalletByPhoneOrEmailHandler: GetWalletByPhoneOrEmail,
  ) {}

  @Get('/search')
  @Public()
  @HttpCode(200)
  async getWalletByPhoneOrEmail(
    @Query('phone') phoneNumber?: string,
    @Query('email') email?: string,
  ) {
    if (!phoneNumber && !email) {
      throw new BadRequestException(
        'Please provide either phone number or email',
      );
    }

    return this.getWalletByPhoneOrEmailHandler.execute(phoneNumber, email);
  }
}
