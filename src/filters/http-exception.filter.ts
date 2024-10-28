import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { BAD_REQUEST } from 'src/errors/error.constants';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    if (exception instanceof HttpException) {
      if (status === 400) {
        return response.status(status).json({
          message: BAD_REQUEST,
          error: 'Bad Request',
          statusCode: 400,
        });
      }
      return response.status(status).json(exception.getResponse());
    }

    response.status(status).json({
      statusCode: status,
      message: 'We got an error in processing this request',
      error: 'Internal server error',
    });
  }
}
