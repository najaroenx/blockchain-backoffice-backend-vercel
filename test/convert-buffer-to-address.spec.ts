import { convertBufferToAddress } from '../src/libs/convertBufferToAddress';

describe('convertBufferToAddress', () => {
  it('should convert Buffer to hex string with 0x prefix', () => {
    const input = Buffer.from('1234abcd', 'hex');
    const result = convertBufferToAddress(input);

    expect(result).toBe('0x1234abcd');
  });

  it('should convert Uint8Array to hex string with 0x prefix', () => {
    const input = new Uint8Array([0x12, 0x34, 0xab, 0xcd]);
    const result = convertBufferToAddress(input);

    expect(result).toBe('0x1234abcd');
  });

  it('should return 0x when empty buffer is passed', () => {
    const input = Buffer.from([]);
    const result = convertBufferToAddress(input);

    expect(result).toBe('0x');
  });
});
