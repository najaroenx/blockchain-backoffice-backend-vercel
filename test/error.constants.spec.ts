import * as constants from '../src/errors/error.constants';

describe('Error Constants', () => {
  it('should be defined', () => {
    expect(constants).toBeDefined();
  });

  it('should contain correct constant values', () => {
    expect(constants.NO_TOKEN_PROVIDED).toBe('400001: No token provided');
    expect(constants.USER_NOT_FOUND).toBe('404001: User not found');
    expect(constants.INVALID_CREDENTIALS).toBe('401001: Invalid credentials');
    expect(constants.MERCHANT_NOT_FOUND).toBe('404002: Merchant not found');
    expect(constants.POINT_NOT_FOUND).toBe('404003: Point not found');
    expect(constants.SESSION_NOT_FOUND).toBe('404004: Session not found');
    expect(constants.API_KEY_NOT_FOUND).toBe('404005: API key not found');
    expect(constants.CUSTOMER_NOT_FOUND).toBe('404006: Customer not found');
    expect(constants.EMAIL_USER_CONFLICT).toBe(
      '409001: User with this email already exists',
    );
    expect(constants.BAD_REQUEST).toBe('400000: Bad Request');
    expect(constants.INTERNAL_SERVER_ERROR).toBe(
      '500000: Internal server error',
    );
    expect(constants.RPC_SERVER_ERROR).toBe('500001: RPC server error');
  });

  it('should have 12 constants exported', () => {
    expect(Object.keys(constants).length).toBe(12);
  });
});
