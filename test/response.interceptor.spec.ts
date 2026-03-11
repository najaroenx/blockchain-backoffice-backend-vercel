import { CallHandler, ExecutionContext, StreamableFile } from '@nestjs/common';
import { of } from 'rxjs';
import { lastValueFrom } from 'rxjs';
import { ResponseInterceptor } from '../src/common/response.interceptor';

describe('ResponseInterceptor', () => {
  let interceptor: ResponseInterceptor;
  let context: ExecutionContext;

  beforeEach(() => {
    interceptor = new ResponseInterceptor();
    context = {} as ExecutionContext;
  });

  it('lifts statusCode to the top level and removes it from data', async () => {
    const next: CallHandler = {
      handle: () =>
        of({
          statusCode: 200,
          success: true,
          message: 'Voucher redeemed successfully',
        }),
    };

    const result = await lastValueFrom(interceptor.intercept(context, next));

    expect(result).toEqual({
      statusCode: 200,
      status: 'success',
      message: 'OK',
      data: {
        success: true,
        message: 'Voucher redeemed successfully',
      },
    });
  });

  it('passes through streamable files unchanged', async () => {
    const file = new StreamableFile(Buffer.from('test'));
    const next: CallHandler = {
      handle: () => of(file),
    };

    const result = await lastValueFrom(interceptor.intercept(context, next));

    expect(result).toBe(file);
  });
});