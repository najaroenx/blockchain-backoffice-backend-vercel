export const createBufferFromHex = (hex: unknown): Buffer => {
  if (typeof hex !== 'string') {
    throw new TypeError('Hex value must be a string');
  }

  const normalizedHex = hex.startsWith('0x') ? hex.slice(2) : hex;

  if (
    normalizedHex.length === 0 ||
    normalizedHex.length % 2 !== 0 ||
    !/^[0-9a-fA-F]+$/.test(normalizedHex)
  ) {
    throw new TypeError('Invalid hex string');
  }

  return Buffer.from(normalizedHex, 'hex');
};
export const convertBufferToAddress = (buffer: Buffer): string => {
  return '0x' + buffer.toString('hex');
};
