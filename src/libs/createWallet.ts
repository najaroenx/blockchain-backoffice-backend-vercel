import { Wallet } from 'ethers';
import { deriveChildWallet } from './derive-wallet';

export interface CreateWalletResult {
  walletAddress: string;
  seedPhrase: string;
  chainCode: string;
  derivationIndex: number;
}

/**
 * Create a new HD wallet with seed phrase
 * Returns the wallet address at derivation index 0 along with
 * the seed phrase and chain code for secure storage
 *
 * @param index - The derivation index (default: 0)
 * @returns CreateWalletResult with walletAddress, seedPhrase, chainCode, derivationIndex
 */
export const createWallet = (index: number = 0): CreateWalletResult => {
  const wallet = Wallet.createRandom();
  const seedPhrase = wallet.mnemonic?.phrase || '';

  // Derive the child wallet at the specified index to get the actual address
  const derived = deriveChildWallet(seedPhrase, index);

  return {
    walletAddress: derived.address,
    seedPhrase,
    chainCode: derived.chainCode,
    derivationIndex: index,
  };
};
