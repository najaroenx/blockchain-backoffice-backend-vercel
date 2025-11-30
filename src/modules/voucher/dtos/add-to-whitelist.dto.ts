import { IsNotEmpty, IsString, IsArray } from 'class-validator';

/**
 * DTO for manually adding address(es) to marketplace whitelist
 */
export class AddToWhitelistDto {
  @IsString()
  @IsNotEmpty()
  address: string;
}

export class BatchAddToWhitelistDto {
  @IsArray()
  @IsNotEmpty()
  addresses: string[];
}
