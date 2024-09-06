import { IsNumber, IsString } from 'class-validator';

export class CreatePointDto {
  @IsString()
  name: string;

  @IsString()
  symbol: string;

  @IsString()
  merchantId: string;

  @IsNumber()
  initialSupply: number;

  @IsNumber()
  decimal: number;

  @IsNumber()
  frameSize: number;

  @IsNumber()
  slotSize: number;
}
