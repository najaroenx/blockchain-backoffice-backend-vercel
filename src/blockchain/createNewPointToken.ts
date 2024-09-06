import * as PointFactoryABI from './abis/PointFactoryABI.json';
import { Contract, JsonRpcProvider, Wallet } from 'ethers';

type createPoint = {
  initialSupply: number;
  name: string;
  symbol: string;
  decimal: number;
  frameSize: number;
  slotSize: number;
};

export const createNewPointToken = async ({
  initialSupply,
  name,
  symbol,
  decimal,
  frameSize,
  slotSize,
}: createPoint) => {
  const POINT_FACTORY_ADDRESS = process.env.POINT_FACTORY_ADDRESS!;
  const PRIVATE_KEY = process.env.PRIVATE_KEY!;
  const RPC_URL = process.env.RPC_URL!;

  const provider = new JsonRpcProvider(RPC_URL);
  const signer = new Wallet(PRIVATE_KEY, provider);

  const contract = new Contract(POINT_FACTORY_ADDRESS, PointFactoryABI, signer);

  const contractWithSigner = contract.connect(signer) as any;

  const result = await contract['createNewPointContract'].staticCallResult(
    initialSupply,
    signer.address,
    name,
    symbol,
    decimal,
    15, // TODO: remove fix block time
    frameSize,
    slotSize,
  );

  const pointAddress = result[0];

  const tx = await contractWithSigner['createNewPointContract'](
    initialSupply,
    signer.address,
    name,
    symbol,
    decimal,
    15, // TODO: remove fix block time
    frameSize,
    slotSize,
  );

  await tx.wait();

  return pointAddress;
};
