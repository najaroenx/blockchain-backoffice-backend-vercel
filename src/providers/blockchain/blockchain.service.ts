/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { createPoint } from './types';
import * as PointFactoryABI from './abis/PointFactoryABI.json';
import * as PointERC20ABI from './abis/PointTokenABI.json';

import { Contract, JsonRpcProvider, Wallet, ethers } from 'ethers';
import { ConfigService } from '@nestjs/config';
import { transaction, transactionC2C } from './types/transaction.type';
import { createBufferFromHex } from 'src/libs/createBufferFromHex';
import { RPC_SERVER_ERROR } from 'src/errors/error.constants';

@Injectable()
export class BlockchainService {
  private pointFactoryAddress: string;

  private privateKey: string;

  public provider: JsonRpcProvider;

  private readonly DEFAULT_BLOCK_TIME = 12;

  constructor(private configService: ConfigService) {
    this.pointFactoryAddress = this.configService.get<string>(
      'POINT_FACTORY_ADDRESS',
    );
    this.privateKey = this.configService.get<string>('PRIVATE_KEY');
    this.provider = new JsonRpcProvider(
      this.configService.get<string>('RPC_URL'),
    );
  }

  async createNewPointToken({
    initialSupply,
    name,
    symbol,
    decimal,
    frameSize,
  }: createPoint) {
    console.log('Creating new point token on blockchain... by ',this.pointFactoryAddress);
    console.log('Creating new point token on blockchain... by ',this.privateKey);

    const signer = new Wallet(this.privateKey, this.provider);

    const contract = new Contract(
      this.pointFactoryAddress,
      PointFactoryABI,
      signer,
    );

    const contractWithSigner = contract.connect(signer) as any;

    const blockTime = await this.resolveBlockTime();

    const initialSupplyWeiFormat = ethers.parseEther(initialSupply.toString());
    const result = await contract['createNewPointContract'].staticCallResult(
      initialSupplyWeiFormat,
      signer.address,
      name,
      symbol,
      // decimal,
      blockTime,
      frameSize,
    );

    const pointAddress = result[0];
    console.log('New point token address preview:', pointAddress);
    const tx = await contractWithSigner['createNewPointContract'](
      initialSupplyWeiFormat,
      signer.address,
      name,
      symbol,
      // decimal,
      blockTime,
      frameSize,
    );

    await tx.wait();

    const pointBuffer = createBufferFromHex(pointAddress);

    return pointBuffer;
  }

  private async resolveBlockTime(): Promise<number> {
    try {
      const latestBlockNumber = await this.provider.getBlockNumber();
      if (latestBlockNumber === 0) {
        return this.DEFAULT_BLOCK_TIME;
      }

      const [latestBlock, previousBlock] = await Promise.all([
        this.provider.getBlock(latestBlockNumber),
        this.provider.getBlock(latestBlockNumber - 1),
      ]);

      if (!latestBlock || !previousBlock) {
        return this.DEFAULT_BLOCK_TIME;
      }

      const diffSeconds = latestBlock.timestamp - previousBlock.timestamp;
      if (!Number.isFinite(diffSeconds) || diffSeconds <= 0) {
        return this.DEFAULT_BLOCK_TIME;
      }

      const blockTimeSeconds = Math.round(diffSeconds);
      return Math.min(Math.max(blockTimeSeconds, 1), 65535);
    } catch {
      return this.DEFAULT_BLOCK_TIME;
    }
  }

  async transaction({
    amount,
    to,
    pointAddress,
  }: transaction): Promise<{ txId: string }> {
    try {
      const signer = new Wallet(this.privateKey, this.provider);

      const contract = new Contract(pointAddress, PointERC20ABI, signer);

      const contractWithSigner = contract.connect(signer) as any;

      const amountWeiFormat = ethers.parseEther(amount.toString());

      const tx = await contractWithSigner['transfer'](to, amountWeiFormat);

      await tx.wait();

      return {
        txId: tx.hash,
      };
    } catch (error) {
      throw new InternalServerErrorException(RPC_SERVER_ERROR);
    }
  }

  async mint({
    amount,
    to,
    pointAddress,
  }: transaction): Promise<{ txId: string }> {
    try {
      const signer = new Wallet(this.privateKey, this.provider);

      const contract = new Contract(pointAddress, PointERC20ABI, signer);

      const contractWithSigner = contract.connect(signer) as any;

      const amountWeiFormat = ethers.parseEther(amount.toString());

      const tx = await contractWithSigner['mint'](to, amountWeiFormat);

      await tx.wait();

      return {
        txId: tx.hash,
      };
    } catch (error) {
      throw new InternalServerErrorException(RPC_SERVER_ERROR);
    }
  }

  async burn({
    amount,
    pointAddress,
    senderPrivateKey,
  }: Omit<transactionC2C, 'to'>): Promise<{ txId: string }> {
    try {
      const signer = new Wallet(senderPrivateKey, this.provider);
      const contract = new Contract(pointAddress, PointERC20ABI, signer);
      const contractWithSigner = contract.connect(signer) as any;
      const amountWeiFormat = ethers.parseEther(amount.toString());

      const tx = await contractWithSigner['burn'](amountWeiFormat);

      await tx.wait();

      return {
        txId: tx.hash,
      };
    } catch (error) {
      throw new InternalServerErrorException(RPC_SERVER_ERROR);
    }
  }

  async transactionC2C({
    amount,
    to,
    senderPrivateKey,
    pointAddress,
  }: transactionC2C): Promise<{ txId: string }> {
    try {
      const signer = new Wallet(senderPrivateKey, this.provider);

      const contract = new Contract(pointAddress, PointERC20ABI, signer);

      const contractWithSigner = contract.connect(signer) as any;

      const amountWeiFormat = ethers.parseEther(amount.toString());

      const tx = await contractWithSigner['transfer'](to, amountWeiFormat);

      await tx.wait();

      return {
        txId: tx.hash,
      };
    } catch (error) {
      throw new InternalServerErrorException(RPC_SERVER_ERROR);
    }
  }
}
