import {
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Matches,
  IsNotEmpty,
} from 'class-validator';

export class RegisterCustomerDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message:
      'merchantId must contain only alphanumeric characters, hyphens, and underscores',
  })
  merchantId: string;

  @IsUrl()
  @IsOptional()
  callbackUri?: string;
}

export class CreateCustomerDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @MaxLength(20)
  tel: string;
}

export class UpdateCustomerDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @MaxLength(20)
  @IsOptional()
  tel?: string;
}
