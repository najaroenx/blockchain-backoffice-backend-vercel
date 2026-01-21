import { createWallet } from '../src/libs/createWallet';
import { HDNodeWallet } from 'ethers';

jest.mock('ethers', () => ({
  HDNodeWallet: {
    createRandom: jest.fn(),
  },
}));

describe('createWallet', () => {
  const mockHDNode = {
    mnemonic: { phrase: 'test seed phrase words here for testing purposes only' },
    chainCode: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    address: '0x1234567890abcdef1234567890abcdef12345678',
    derivePath: jest.fn().mockReturnThis(),
  };

  beforeEach(() => {
    (HDNodeWallet.createRandom as jest.Mock).mockReturnValue(mockHDNode);
  });

  it('should return walletAddress, seedPhrase, chainCode, and derivationIndex', () => {
    const result = createWallet();
    expect(result).toHaveProperty('walletAddress');
    expect(result).toHaveProperty('seedPhrase');
    expect(result).toHaveProperty('chainCode');
    expect(result).toHaveProperty('derivationIndex');
  });

  it('should return correct mocked values', () => {
    const result = createWallet();
    expect(result.walletAddress).toBe(
      '0x1234567890abcdef1234567890abcdef12345678',
    );
    expect(result.seedPhrase).toBe(
      'test seed phrase words here for testing purposes only',
    );
    expect(result.chainCode).toBe(
      '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    );
    expect(result.derivationIndex).toBe(0);
  });

  it('walletAddress should start with 0x and derivationIndex should be 0', () => {
    const result = createWallet();
    expect(result.walletAddress.startsWith('0x')).toBe(true);
    expect(result.derivationIndex).toBe(0);
  });
});
