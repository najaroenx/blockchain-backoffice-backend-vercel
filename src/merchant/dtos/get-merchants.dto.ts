import { IsString } from 'class-validator';

export class GetMerchantsDto {
  @IsString()
  userId: string;
}
