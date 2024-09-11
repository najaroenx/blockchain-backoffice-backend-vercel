import { IsString } from 'class-validator';

export class CreateMerchantsDto {
  @IsString()
  name: string;

  @IsString()
  website: string;

  @IsString()
  userId: string;
}
