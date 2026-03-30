import { createBufferFromHex } from '../src/libs/createBufferFromHex';

describe('createBufferFromHex', () => {
  it('creates a buffer from a 0x-prefixed hex string', () => {
    const result = createBufferFromHex('0x1234abcd');

    expect(result).toEqual(Buffer.from('1234abcd', 'hex'));
  });

  it('creates a buffer from a plain hex string', () => {
    const result = createBufferFromHex('1234abcd');

    expect(result).toEqual(Buffer.from('1234abcd', 'hex'));
  });

  it('rejects non-string input', () => {
    expect(() => createBufferFromHex(1234 as any)).toThrow(
      'Hex value must be a string',
    );
  });

  it('rejects odd-length hex strings', () => {
    expect(() => createBufferFromHex('0x123')).toThrow('Invalid hex string');
  });

  it('rejects non-hex characters', () => {
    expect(() => createBufferFromHex('0x12zz')).toThrow('Invalid hex string');
  });
});