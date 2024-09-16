import { Injectable } from '@nestjs/common';
import { createPoint } from './types';
import * as PointFactoryABI from './abis/PointFactoryABI.json';
import * as PointERC20ABI from './abis/PointERC20ABI.json';

import { Contract, JsonRpcProvider, Wallet } from 'ethers';
import { ConfigService } from '@nestjs/config';
import { transaction } from './types/transaction.type';

@Injectable()
export class BlockchainService {
  private pointFactoryAddress: string;

  private privateKey: string;

  private rpc: string;

  constructor(private configService: ConfigService) {
    this.pointFactoryAddress = this.configService.get<string>(
      'POINT_FACTORY_ADDRESS',
    );
    this.privateKey = this.configService.get<string>('PRIVATE_KEY');
    this.rpc = this.configService.get<string>('RPC_URL');
  }

  async createNewPointToken({
    initialSupply,
    name,
    symbol,
    decimal,
    frameSize,
    slotSize,
  }: createPoint) {
    const provider = new JsonRpcProvider(this.rpc);
    const signer = new Wallet(this.privateKey, provider);

    const contract = new Contract(
      this.pointFactoryAddress,
      PointFactoryABI,
      signer,
    );

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
  }

  async transaction({
    amount,
    to,
    pointContractAddress,
  }: transaction): Promise<{ txId: string }> {
    const provider = new JsonRpcProvider(this.rpc);
    const signer = new Wallet(this.privateKey, provider);

    const contract = new Contract(pointContractAddress, PointERC20ABI, signer);

    const contractWithSigner = contract.connect(signer) as any;

    const tx = await contractWithSigner['transfer'](to, amount);

    await tx.wait();

    return {
      txId: tx.hash,
    };
  }
}
