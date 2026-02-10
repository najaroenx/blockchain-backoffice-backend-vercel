import { ApiKey } from '@prisma/client';

export type GetApiKeysResponseType = {
  apiKeys: ApiKey[];
  counts: number;
};
