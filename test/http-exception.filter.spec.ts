import { HttpExceptionFilter } from '../src/filters/http-exception.filter';
import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { BAD_REQUEST } from 'src/errors/error.constants';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let mockResponse: any;
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(), // allow chaining .json()
      json: jest.fn(),
    };
    mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
      }),
    } as unknown as ArgumentsHost;
  });

  it('should handle HttpException with status 400', () => {
    const exception = new HttpException('Bad Request', 400);

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({
      message: BAD_REQUEST,
      error: 'Bad Request',
      statusCode: 400,
    });
  });

  it('should handle other HttpException (e.g. 404)', () => {
    const exception = new HttpException('Not Found', 404);

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(404);
    expect(mockResponse.json).toHaveBeenCalledWith(exception.getResponse());
  });

  it('should handle unknown (non-HttpException)', () => {
    const exception: any = new Error('Unexpected Error');

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: 500,
      message: 'We got an error in processing this request',
      error: 'Internal server error',
    });
  });
});
