import { SetMetadata } from '@nestjs/common';
import { MERCHANT_BACK_OFFICE_PUBLIC_ENDPOINT } from './auth.constant';

export const Public = () =>
  SetMetadata(MERCHANT_BACK_OFFICE_PUBLIC_ENDPOINT, true);
