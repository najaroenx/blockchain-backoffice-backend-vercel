export type transaction = {
  amount: number;
  to: string;
  pointAddress: string;
};

export type transactionC2C = {
  amount: number;
  to: string;
  pointAddress: string;
  senderPrivateKey: string;
};
