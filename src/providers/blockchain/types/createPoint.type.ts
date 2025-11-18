export type createPoint = {
  initialSupply: number;
  name: string;
  symbol: string;
  decimal: number;
  frameSize: number;
  ownerAddress: string; // Merchant wallet address to receive initial supply
};
