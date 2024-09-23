export const convertBufferToAddress = (hash: Buffer) => {
  const buffer = Buffer.from(hash);
  const hexString = '0x' + buffer.toString('hex');

  return hexString;
};
