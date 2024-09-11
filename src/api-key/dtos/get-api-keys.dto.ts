import { IsString } from 'class-validator';

export class GetAPiKeysDto {
  @IsString()
  merchantId: string;
}
