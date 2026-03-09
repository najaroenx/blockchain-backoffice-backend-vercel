import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    if (exception instanceof HttpException) {
      if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
        this.logger.error(
          `${request.method} ${request.url} failed with ${status}`,
          exception.stack,
        );
      }

      // ส่ง response ตามที่ exception กำหนดไว้
      return response.status(status).json(exception.getResponse());
    }

    const error = exception as Error;

    this.logger.error(
      `${request.method} ${request.url} failed with ${status}: ${error?.message ?? 'Unknown error'}`,
      error?.stack,
    );

    response.status(status).json({
      statusCode: status,
      message: 'We got an error in processing this request',
      error: 'Internal server error',
    });
  }
}
