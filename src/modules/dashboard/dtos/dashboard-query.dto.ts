import { IsDateString, IsOptional } from 'class-validator';

export class DashboardQueryDto {
  @IsOptional()
  @IsDateString()
  startDate?: string; // Default: start of current month

  @IsOptional()
  @IsDateString()
  endDate?: string; // Default: today
}
