import { IsDateString, IsEnum, IsOptional } from 'class-validator';

export enum Granularity {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

export class DashboardQueryDto {
  @IsOptional()
  @IsDateString()
  startDate?: string; // Default: start of current month

  @IsOptional()
  @IsDateString()
  endDate?: string; // Default: today

  @IsOptional()
  @IsEnum(Granularity)
  granularity?: Granularity; // Default: monthly
}
