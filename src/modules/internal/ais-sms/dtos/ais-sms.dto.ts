import { IsString, IsNotEmpty, IsOptional, IsIn, IsBoolean } from 'class-validator';

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
