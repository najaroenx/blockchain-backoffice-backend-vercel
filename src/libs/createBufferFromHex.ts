export const createBufferFromHex = (hex: string): Buffer => {
  return Buffer.from(hex.startsWith('0x') ? hex.slice(2) : hex, 'hex');
};
