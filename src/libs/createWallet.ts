import { Wallet } from 'ethers';

export const createWallet = () => {
  const wallet = Wallet.createRandom();
  return {
    walletAddress: wallet.address,
    privateKey: wallet.privateKey,
  };
};
