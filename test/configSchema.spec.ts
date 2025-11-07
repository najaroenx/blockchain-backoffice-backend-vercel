import { configSchema } from '../src/configSchema';

describe('configSchema', () => {
  it('should be defined', () => {
    expect(configSchema).toBeDefined();
  });

  it('should validate a valid configuration object without errors', () => {
    const validConfig = {
      POINT_FACTORY_ADDRESS: '0x123456',
      PRIVATE_KEY: 'abc123',
      RPC_URL: 'https://rpc.example.com',
      JWT_SECRET: 'mysecret',
      SALT: '10',
    };

    const { error } = configSchema.validate(validConfig);
    expect(error).toBeUndefined();
  });

  it('should NOT fail when fields are missing (because all are optional)', () => {
    const { error } = configSchema.validate({});
    expect(error).toBeUndefined();
  });
});
