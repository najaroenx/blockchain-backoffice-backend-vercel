import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { CreateApiKeyDto, GetAPiKeysParams } from '../dtos';
import { GetApiKeys } from '../handlers/getApiKeys.handler';
import { CreateApiKey } from '../handlers/createApiKey.handler';

@Controller('api-key')
export class ApiKeyController {
  constructor(
    private readonly getApiKeysByMerchantId: GetApiKeys,
    private readonly createNewApiKey: CreateApiKey,
  ) {}

  @Post('/:merchantId')
  @HttpCode(201)
  async createApiKey(
    @Param('merchantId') merchantId: string,
    @Body() body: CreateApiKeyDto,
  ) {
    return this.createNewApiKey.execute(merchantId, body);
  }

  @Get('/:merchantId')
  @HttpCode(200)
  async getApiKeys(@Param() params: GetAPiKeysParams) {
    const { merchantId } = params;
    return this.getApiKeysByMerchantId.execute(merchantId);
  }
}
