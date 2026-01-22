import { HDNodeWallet, Wallet } from 'ethers';

/**
 * Default BIP44 derivation path for Ethereum
 * m/44'/60'/0'/0/{index}
 * - 44' = BIP44 purpose
 * - 60' = Ethereum coin type
 * - 0' = account
 * - 0 = external chain
 * - {index} = address index
 */
const BASE_PATH = "m/44'/60'/0'/0";

export interface DerivedWallet {
  address: string;
  privateKey: string;
  publicKey: string;
  chainCode: string;
  path: string;
  index: number;
}

/**
 * Derive a child wallet from a seed phrase at a specific index
 * Uses BIP44 derivation path: m/44'/60'/0'/0/{index}
 *
 * @param seedPhrase - The mnemonic seed phrase (12 or 24 words)
 * @param index - The derivation index (default: 0)
 * @returns DerivedWallet with address, privateKey, publicKey, chainCode, path, index
 */
export const deriveChildWallet = (
  seedPhrase: string,
  index: number = 0,
): DerivedWallet => {
  const path = `${BASE_PATH}/${index}`;
  const hdNode = HDNodeWallet.fromPhrase(seedPhrase, undefined, path);

  return {
    address: hdNode.address,
    privateKey: hdNode.privateKey,
    publicKey: hdNode.publicKey,
    chainCode: hdNode.chainCode,
    path,
    index,
  };
};

/**
 * Derive multiple child wallets from a seed phrase
 *
 * @param seedPhrase - The mnemonic seed phrase
 * @param startIndex - Starting derivation index (default: 0)
 * @param count - Number of wallets to derive (default: 1)
 * @returns Array of DerivedWallet
 */
export const deriveMultipleWallets = (
  seedPhrase: string,
  startIndex: number = 0,
  count: number = 1,
): DerivedWallet[] => {
  const wallets: DerivedWallet[] = [];
  for (let i = 0; i < count; i++) {
    wallets.push(deriveChildWallet(seedPhrase, startIndex + i));
  }
  return wallets;
};

/**
 * Get the master HD node from a seed phrase
 * Useful for getting the master chainCode
 *
 * @param seedPhrase - The mnemonic seed phrase
 * @returns HDNodeWallet at the base path (m/44'/60'/0'/0)
 */
export const getMasterHDNode = (seedPhrase: string): HDNodeWallet => {
  return HDNodeWallet.fromPhrase(seedPhrase, undefined, BASE_PATH);
};

/**
 * Create a Wallet instance from seed phrase for signing transactions
 * This is a convenience function for backward compatibility
 *
 * @param seedPhrase - The mnemonic seed phrase
 * @param index - The derivation index (default: 0)
 * @returns ethers Wallet instance ready for signing
 */
export const getSignerFromSeedPhrase = (
  seedPhrase: string,
  index: number = 0,
): Wallet => {
  const derived = deriveChildWallet(seedPhrase, index);
  return new Wallet(derived.privateKey);
};
