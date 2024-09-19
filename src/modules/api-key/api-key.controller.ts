import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiKeyService } from './api-key.service';
import { CreateApiKeyDto, GetAPiKeysDto } from './dto';

@Controller('api-key')
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Post('/:merchantId')
  @HttpCode(201)
  async createApiKey(
    @Param('merchantId') merchantId: string,
    @Body() body: CreateApiKeyDto,
  ) {
    return this.apiKeyService.createApiKey(merchantId, body);
  }

  @Get('/:merchantId')
  @HttpCode(200)
  async getApiKeys(@Param() params: GetAPiKeysDto) {
    const { merchantId } = params;
    return this.apiKeyService.getApiKeys(merchantId);
  }
}
