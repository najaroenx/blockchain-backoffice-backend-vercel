import { IsOptional, IsString } from 'class-validator';

export class CreateMerchantsDto {
  @IsString()
  name: string;

  @IsString()
  website: string;

  @IsOptional()
  @IsString()
  lineOfficialId?: string;

  @IsString()
  userId: string;
}
