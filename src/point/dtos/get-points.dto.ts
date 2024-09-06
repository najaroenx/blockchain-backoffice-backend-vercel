import { IsString } from 'class-validator';

export class GetPointsDto {
  @IsString()
  userId: string;
}
