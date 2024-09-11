import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { MERCHANT_BACK_OFFICE_PUBLIC_ENDPOINT } from './auth.constant';
import { Observable } from 'rxjs';

@Injectable()
export class CustomAuthGuard extends AuthGuard('authStrategy') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const decoratorSkip = this.reflector.getAllAndOverride<boolean>(
      MERCHANT_BACK_OFFICE_PUBLIC_ENDPOINT,
      [context.getHandler(), context.getClass()],
    );

    if (decoratorSkip) return true;

    return super.canActivate(context);
  }
}
