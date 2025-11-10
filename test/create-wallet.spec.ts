import { createWallet } from '../src/libs/createWallet';
import { Wallet } from 'ethers';

jest.mock('ethers', () => ({ Wallet: { createRandom: jest.fn() } }));

describe('createWallet', () => {
  beforeEach(() => {
    (Wallet.createRandom as jest.Mock).mockReturnValue({
      address: '0x1234567890abcdef1234567890abcdef12345678',
      privateKey:
        '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef',
    });
  });

  it('should return walletAddress and privateKey', () => {
    const result = createWallet();
    expect(result).toHaveProperty('walletAddress');
    expect(result).toHaveProperty('privateKey');
  });

  it('should return correct mocked values', () => {
    const result = createWallet();
    expect(result.walletAddress).toBe(
      '0x1234567890abcdef1234567890abcdef12345678',
    );
    expect(result.privateKey).toBe(
      '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef',
    );
  });

  it('walletAddress and privateKey should start with 0x', () => {
    const result = createWallet();
    expect(result.walletAddress.startsWith('0x')).toBe(true);
    expect(result.privateKey.startsWith('0x')).toBe(true);
  });
});
