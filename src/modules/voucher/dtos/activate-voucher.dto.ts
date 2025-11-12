import { IsInt, IsNotEmpty, Min } from 'class-validator';

export class ActivateVoucherDto {
  @IsInt()
  @IsNotEmpty()
  @Min(1)
  amount: number;

  @IsInt()
  @IsNotEmpty()
  @Min(0)
  pointsCost: number;
}
