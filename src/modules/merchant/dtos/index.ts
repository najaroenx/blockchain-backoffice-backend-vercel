import { IsOptional, IsString } from 'class-validator';

export class CreateMerchantDto {
  @IsString()
  name: string;

  @IsString()
  website: string;

  @IsString()
  userId: string;
}

export class UpdateMerchantDto {
  @IsString()
  @IsOptional()
  name: string;

  @IsString()
  @IsOptional()
  website: string;
}
