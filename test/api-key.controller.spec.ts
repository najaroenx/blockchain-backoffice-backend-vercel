jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));
import { Test, TestingModule } from '@nestjs/testing';
import { ApiKeyController } from '../src/modules/api-key/controllers/api-key.controller';
import { GetApiKeys } from '../src/modules/api-key/handlers/getApiKeys.handler';
import { CreateApiKey } from '../src/modules/api-key/handlers/createApiKey.handler';
import { DeleteApiKey } from '../src/modules/api-key/handlers/deleteApiKey.handler';
import { PageOptionsDto } from 'src/common/dtos';

describe('ApiKeyController', () => {
  let controller: ApiKeyController;
  let getApiKeysHandler: GetApiKeys;
  let createApiKeyHandler: CreateApiKey;
  let deleteApiKeyHandler: DeleteApiKey;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApiKeyController],
      providers: [
        { provide: GetApiKeys, useValue: { execute: jest.fn() } },
        { provide: CreateApiKey, useValue: { execute: jest.fn() } },
        { provide: DeleteApiKey, useValue: { execute: jest.fn() } },
      ],
    }).compile();

    controller = module.get<ApiKeyController>(ApiKeyController);
    getApiKeysHandler = module.get<GetApiKeys>(GetApiKeys);
    createApiKeyHandler = module.get<CreateApiKey>(CreateApiKey);
    deleteApiKeyHandler = module.get<DeleteApiKey>(DeleteApiKey);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call createApiKey handler with correct params', async () => {
    const merchantId = '123';
    const dto = { name: 'test-key' } as any;

    await controller.createApiKey(merchantId, dto);
    expect(createApiKeyHandler.execute).toHaveBeenCalledWith(merchantId, dto);
  });

  it('should call getApiKeys handler with merchantId and page options', async () => {
    const params = { merchantId: '123' };
    const pageOptions = new PageOptionsDto();

    await controller.getApiKeys(params as any, pageOptions);
    expect(getApiKeysHandler.execute).toHaveBeenCalledWith('123', pageOptions);
  });

  it('should call deleteApiKey handler with correct id and merchantId', async () => {
    const params = { merchantId: '123', id: '999' };

    await controller.deleteApiKey(params as any);
    expect(deleteApiKeyHandler.execute).toHaveBeenCalledWith('999', '123');
  });
});
