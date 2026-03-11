import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        if (data instanceof StreamableFile) {
          return data;
        }

        const normalizedData =
          data && typeof data === 'object' && !Array.isArray(data)
            ? (data as Record<string, unknown>)
            : null;
        const statusCode =
          typeof normalizedData?.statusCode === 'number'
            ? normalizedData.statusCode
            : 200;

        const responseData = normalizedData
          ? Object.fromEntries(
              Object.entries(normalizedData).filter(
                ([key]) => key !== 'statusCode',
              ),
            )
          : (data ?? null);

        return {
          statusCode,
          status: 'success',
          message: 'OK',
          data: responseData,
        };
      }),
    );
  }
}
