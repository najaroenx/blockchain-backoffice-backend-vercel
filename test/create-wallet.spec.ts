import { createWallet } from '../src/libs/createWallet';

jest.mock('ethers', () => ({
  Wallet: {
    createRandom: jest.fn(),
  },
}));

jest.mock('../src/libs/derive-wallet', () => ({
  deriveChildWallet: jest.fn().mockReturnValue({
    address: '0x1234567890abcdef1234567890abcdef12345678',
    chainCode:
      '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    privateKey: '0xprivatekey',
  }),
}));

describe('createWallet', () => {
  const { Wallet } = require('ethers');

  const mockWallet = {
    mnemonic: {
      phrase: 'test seed phrase words here for testing purposes only',
    },
  };

  beforeEach(() => {
    Wallet.createRandom.mockReturnValue(mockWallet);
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
