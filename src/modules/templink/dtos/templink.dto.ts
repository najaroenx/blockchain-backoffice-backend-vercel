import { IsString, IsNotEmpty, IsDateString } from 'class-validator';

export class CreateTempLinkDto {
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @IsString()
  @IsNotEmpty()
  merchantId: string;

  @IsDateString()
  @IsNotEmpty()
  expire: string;
}

export class UpdateTempLinkDto {
  @IsDateString()
  expire?: string;
}

export class GetTempLinkByUidParams {
  @IsString()
  @IsNotEmpty()
  uid: string;
}

export class GetTempLinksByMerchantParams {
  @IsString()
  @IsNotEmpty()
  merchantId: string;
}
