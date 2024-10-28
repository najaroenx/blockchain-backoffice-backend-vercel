import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class PageOptionsDto {
  @IsInt()
  @Transform(({ value }) => {
    return Number(value);
  })
  @IsOptional()
  @Min(1)
  @Max(100)
  readonly page?: number = 1;

  @IsNumber()
  @Transform(({ value }) => {
    return Number(value);
  })
  @IsOptional()
  @Min(1)
  @Max(100)
  readonly take?: number = 10;

  get skip(): number {
    return (this.page - 1) * this.take;
  }
}
