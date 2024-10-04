import { IsOptional, IsString } from 'class-validator';

export class CreateApiKeyDto {
  @IsString()
  @IsOptional()
  description: string;

  @IsString()
  name: string;
}

export class GetAPiKeysParams {
  @IsString()
  merchantId: string;
}
