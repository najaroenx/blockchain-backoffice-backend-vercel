export const convertBufferToAddress = (hash: Buffer | Uint8Array) => {
  const buffer = Buffer.from(hash);
  const hexString = '0x' + buffer.toString('hex');

  return hexString;
};
