import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsBoolean,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SendAisSmsTestDto {
  @IsString()
  @IsNotEmpty()
  to: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsOptional()
  @IsIn(['TEXT', 'UNICODE'])
  ctype?: 'TEXT' | 'UNICODE';

  @IsOptional()
  @IsBoolean()
  report?: boolean;
}

export class TelnetCheckQueryDto {
  @IsString()
  @IsNotEmpty()
  host: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  port: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  timeoutMs?: number;
}
