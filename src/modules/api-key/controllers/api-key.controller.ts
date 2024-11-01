import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { CreateApiKeyDto, DeleteApiKeyParams, GetAPiKeysParams } from '../dtos';
import { GetApiKeys } from '../handlers/getApiKeys.handler';
import { CreateApiKey } from '../handlers/createApiKey.handler';
import { PageOptionsDto } from 'src/common/dtos';
import { DeleteApiKey } from '../handlers/deleteApiKey.handler';

@Controller('/:merchantId/api-key')
export class ApiKeyController {
  constructor(
    private readonly getApiKeysByMerchantIdHandler: GetApiKeys,
    private readonly createApiKeyHandler: CreateApiKey,
    private readonly deleteApiKeyHandler: DeleteApiKey,
  ) {}

  @Post('/')
  @HttpCode(201)
  async createApiKey(
    @Param('merchantId') merchantId: string,
    @Body() body: CreateApiKeyDto,
  ) {
    return this.createApiKeyHandler.execute(merchantId, body);
  }

  @Get('/')
  @HttpCode(200)
  async getApiKeys(
    @Param() params: GetAPiKeysParams,
    @Query() pageOptionsDto: PageOptionsDto,
  ) {
    const { merchantId } = params;
    return this.getApiKeysByMerchantIdHandler.execute(
      merchantId,
      pageOptionsDto,
    );
  }

  @Delete('/:id')
  @HttpCode(201)
  async deleteApiKey(@Param() params: DeleteApiKeyParams) {
    const { merchantId, id } = params;

    return this.deleteApiKeyHandler.execute(id, merchantId);
  }
}
