import { InternalServerErrorException } from '@nestjs/common';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';

type LoggerLike = {
  error(message: any, ...optionalParams: any[]): any;
};

type ExceptionConstructor = new (...args: any[]) => Error;

export function logAndRethrowOrInternalError(
  logger: LoggerLike,
  error: any,
  passThroughExceptions: ExceptionConstructor[],
  internalErrorMessage: string = INTERNAL_SERVER_ERROR,
): never {
  logger.error(`Error message : ${error.message}, \n Error detail : ${error}`);

  if (
    passThroughExceptions.some(
      (ExceptionType) => error instanceof ExceptionType,
    )
  ) {
    throw error;
  }

  throw new InternalServerErrorException(internalErrorMessage);
}
