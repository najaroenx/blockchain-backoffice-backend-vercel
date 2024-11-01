import { Module } from '@nestjs/common';
import { ApiKeyController } from './controllers/api-key.controller';
import { ApiKeyRepository } from './api-key.repository';
import { TokenModule } from 'src/providers/token/token.module';
import { ApiKeyDBService } from './services/api-key-db.service';
import { GetApiKeys } from './handlers/getApiKeys.handler';
import { GetApiKey } from './handlers/getApiKey.handler';
import { CreateApiKey } from './handlers/createApiKey.handler';
import { DeleteApiKey } from './handlers/deleteApiKey.handler';

@Module({
  imports: [TokenModule],
  controllers: [ApiKeyController],
  providers: [
    ApiKeyRepository,
    ApiKeyDBService,
    GetApiKeys,
    GetApiKey,
    CreateApiKey,
    DeleteApiKey,
  ],
  exports: [GetApiKey, CreateApiKey],
})
export class ApiKeyModule {}
