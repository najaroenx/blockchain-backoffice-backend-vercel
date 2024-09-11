import { IsString } from 'class-validator';

export class GetPointsDto {
  @IsString()
  merchantId: string;
}
