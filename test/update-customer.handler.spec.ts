jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));
import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { UpdateCustomer } from 'src/modules/internal/customer/handlers/updateCustomer.handler';
import { CustomerDBService } from 'src/modules/internal/customer/services/customer-db.service';

describe('UpdateCustomer', () => {
  let handler: UpdateCustomer;
  let db: jest.Mocked<CustomerDBService>;

  const mockCustomer = {
    id: 'customer-1',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    tel: '0812345678',
  };

  beforeEach(() => {
    db = { updateCustomer: jest.fn() } as any;
    handler = new UpdateCustomer(db);
    jest.clearAllMocks();
  });

  it('should update and return customer', async () => {
    db.updateCustomer.mockResolvedValue(mockCustomer as any);

    const result = await handler.execute('customer-1', { firstName: 'Jane' });

    expect(db.updateCustomer).toHaveBeenCalledWith('customer-1', {
      firstName: 'Jane',
    });
    expect(result).toEqual(mockCustomer);
  });

  it('should throw NotFoundException on Prisma P2025', async () => {
    const prismaError = new Error('Record not found');
    (prismaError as any).code = 'P2025';
    Object.setPrototypeOf(prismaError, {
      constructor: { name: 'PrismaClientKnownRequestError' },
    });
    // Simulate Prisma error - the handler checks for PrismaClientKnownRequestError
    const { Prisma } = jest.requireActual('@prisma/client');
    const p2025 = new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: '5.0.0',
    });
    db.updateCustomer.mockRejectedValue(p2025);

    await expect(
      handler.execute('nonexistent', { firstName: 'Jane' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw InternalServerErrorException on unexpected error', async () => {
    db.updateCustomer.mockRejectedValue(new Error('DB failed'));

    await expect(
      handler.execute('customer-1', { firstName: 'Jane' }),
    ).rejects.toThrow(InternalServerErrorException);
  });
});
