import { configSchema } from '../src/configSchema';

const validConfig = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/merchant',
  PRIVATE_KEY: 'abc123',
  RPC_URL: 'https://rpc.example.com',
  POINT_FACTORY_ADDRESS: '0x123456',
  MARKETPLACE_ADDRESS: '0x123456',
  THB_ADDRESS: '0x123456',
  COUPON_ADDRESS: '0x123456',
  VAULT_ADDRESS: '0x123456',
  JWT_SECRET: 'mysecret',
  SALT: '10',
};

describe('configSchema', () => {
  it('should be defined', () => {
    expect(configSchema).toBeDefined();
  });

  it('validates a complete configuration without errors', () => {
    const { error } = configSchema.validate(validConfig);
    expect(error).toBeUndefined();
  });

  it.each([
    'DATABASE_URL',
    'PRIVATE_KEY',
    'RPC_URL',
    'POINT_FACTORY_ADDRESS',
    'MARKETPLACE_ADDRESS',
    'THB_ADDRESS',
    'COUPON_ADDRESS',
    'VAULT_ADDRESS',
    'JWT_SECRET',
    'SALT',
  ])('fails at boot when required field %s is missing', (field) => {
    const { [field]: _omitted, ...incomplete } = validConfig as Record<
      string,
      string
    >;

    const { error } = configSchema.validate(incomplete);
    expect(error?.message).toContain(field);
  });

  it('applies defaults for optional fields', () => {
    const { error, value } = configSchema.validate(validConfig);

    expect(error).toBeUndefined();
    expect(value.PORT).toBe(4000);
    expect(value.CORS_ORIGINS).toBe('');
    expect(value.ENABLE_AUTH).toBe(false);
  });

  it('rejects a non-numeric PORT', () => {
    const { error } = configSchema.validate({
      ...validConfig,
      PORT: 'not-a-port',
    });
    expect(error?.message).toContain('PORT');
  });
});
