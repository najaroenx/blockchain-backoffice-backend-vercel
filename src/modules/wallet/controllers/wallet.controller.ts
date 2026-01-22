import {
  Controller,
  Get,
  HttpCode,
  Param,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GetWalletByPhoneOrEmail } from '../handlers/getWalletByPhoneOrEmail.handler';
import { GetThbBalance } from '../handlers/getThbBalance.handler';
import { GetSellerWalletByMerchantId } from '../handlers/getSellerWalletByMerchantId.handler';
import { Public } from 'src/modules/auth/public.decorator';

@ApiTags('Wallet')
@Controller('wallet')
export class WalletController {
  constructor(
    private readonly getWalletByPhoneOrEmailHandler: GetWalletByPhoneOrEmail,
    private readonly getThbBalanceHandler: GetThbBalance,
    private readonly getSellerWalletByMerchantIdHandler: GetSellerWalletByMerchantId,
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

  @Get('/:walletAddress/thb-balance')
  @Public()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get THB Balance',
    description: 'ดึงยอด THB token ของ wallet address จาก blockchain',
  })
  @ApiParam({
    name: 'walletAddress',
    description: 'Wallet address (0x...)',
    example: '0xaa18f00e63efea1de8b18308bf74b740811b3c0f',
  })
  @ApiResponse({
    status: 200,
    description: 'Balance retrieved successfully',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getThbBalance(@Param('walletAddress') walletAddress: string) {
    return this.getThbBalanceHandler.execute(walletAddress);
  }

  @Get('/seller/:merchantId')
  @Public()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get Seller Wallet by Merchant ID',
    description: 'ดึง seller wallet จาก merchant ID',
  })
  @ApiParam({
    name: 'merchantId',
    description: 'Merchant ID',
    example: 'clxxxx...',
  })
  @ApiResponse({
    status: 200,
    description: 'Seller wallet retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Seller wallet not found',
  })
  async getSellerWalletByMerchantId(@Param('merchantId') merchantId: string) {
    return this.getSellerWalletByMerchantIdHandler.execute(merchantId);
  }
}
