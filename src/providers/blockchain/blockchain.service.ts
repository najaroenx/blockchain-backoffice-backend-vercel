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
    console.log(
      'Creating new point token on blockchain... by ',
      this.pointFactoryAddress,
    );
    console.log(
      'Creating new point token on blockchain... by ',
      this.privateKey,
    );

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

  /**
   * Buy voucher from marketplace (ERC-1155)
   * @param tokenId - The ERC-1155 token ID to buy
   * @param buyerAddress - Address of the buyer
   * @param priceInPoints - Price in points (THB token)
   * @param amount - Number of vouchers to buy (default 1 for ERC-1155)
   * @returns Transaction receipt with tokenId
   */
  async buyVoucherFromMarketplace(
    tokenId: string,
    buyerAddress: string,
    priceInPoints: number,
    amount: number = 1,
  ) {
    try {
      console.log(
        `[Blockchain] Buying ${amount}x voucher from marketplace. TokenId: ${tokenId}, Buyer: ${buyerAddress}, Price: ${priceInPoints}`,
      );

      // TODO: Implement real smart contract integration
      // For now, return mock response
      const mockReceipt = {
        hash: `0x${Math.random().toString(16).substring(2, 66)}`,
        blockNumber: Math.floor(Math.random() * 1000000),
        status: 1, // success
        transactionIndex: 0,
        gasUsed: BigInt(150000), // Higher gas for marketplace transaction
        effectiveGasPrice: BigInt(1000000000),
        tokenId, // Return tokenId for reference
        amount, // Return amount purchased
      };

      console.log(
        `[Blockchain] Voucher purchased from marketplace successfully (MOCK). Tx: ${mockReceipt.hash}, TokenId: ${tokenId}, Amount: ${amount}`,
      );

      return {
        hash: mockReceipt.hash,
        blockNumber: mockReceipt.blockNumber,
        status: mockReceipt.status,
        tokenId: mockReceipt.tokenId,
        amount: mockReceipt.amount,
      };

      /* Real implementation (uncomment when contracts are ready):
      
      const marketplaceAddress = this.configService.get<string>('MARKETPLACE_CONTRACT_ADDRESS');
      const thbTokenAddress = this.configService.get<string>('THB_TOKEN_ADDRESS');
      
      if (!marketplaceAddress || !thbTokenAddress) {
        throw new Error('MARKETPLACE_CONTRACT_ADDRESS or THB_TOKEN_ADDRESS not configured');
      }

      const signer = new Wallet(this.privateKey, this.provider);

      // Marketplace ABI
      const marketplaceABI = [
        'function buyVoucher(uint256 tokenId) external',
        'function getListing(uint256 tokenId) external view returns (address seller, uint256 price, bool active, uint256 listedAt)',
      ];

      // THB Token ABI (ERC20)
      const thbTokenABI = [
        'function approve(address spender, uint256 amount) external returns (bool)',
        'function allowance(address owner, address spender) external view returns (uint256)',
        'function balanceOf(address account) external view returns (uint256)',
      ];

      const marketplaceContract = new Contract(marketplaceAddress, marketplaceABI, signer);
      const thbContract = new Contract(thbTokenAddress, thbTokenABI, signer);

      // Step 1: Get listing details to verify price
      const listing = await marketplaceContract.getListing(tokenId);
      
      if (!listing.active) {
        throw new Error('Voucher is not listed for sale');
      }

      // Step 2: Check buyer's THB balance
      const balance = await thbContract.balanceOf(buyerAddress);
      if (balance < listing.price) {
        throw new Error('Insufficient THB token balance');
      }

      // Step 3: Approve THB token spending (if needed)
      const currentAllowance = await thbContract.allowance(buyerAddress, marketplaceAddress);
      
      if (currentAllowance < listing.price) {
        console.log('[Blockchain] Approving THB token spending...');
        const approveTx = await thbContract.approve(marketplaceAddress, listing.price);
        await approveTx.wait();
        console.log('[Blockchain] THB token approved');
      }

      // Step 4: Buy voucher from marketplace
      console.log('[Blockchain] Calling buyVoucher on marketplace...');
      const tx = await marketplaceContract.buyVoucher(tokenId);
      const receipt = await tx.wait();

      console.log('[Blockchain] Voucher purchased successfully');

      return {
        hash: receipt.hash,
        blockNumber: receipt.blockNumber,
        status: receipt.status,
      };
      */
    } catch (error) {
      console.error(
        `[Blockchain] Failed to buy voucher from marketplace: ${error.message}`,
      );
      throw new InternalServerErrorException(
        `Failed to buy voucher from marketplace: ${error.message}`,
      );
    }
  }

  /**
   * Get ERC-1155 balance for an address
   * @param tokenId - The ERC-1155 token ID
   * @param address - Owner address
   * @returns Token balance
   */
  async getVoucherBalance(tokenId: string, address: string): Promise<number> {
    try {
      console.log(
        `[Blockchain] Getting voucher balance for tokenId: ${tokenId}, address: ${address}`,
      );

      // TODO: Implement real ERC-1155 balanceOf call
      // For now, return mock balance
      const mockBalance = 0; // Mock: no balance in development

      console.log(
        `[Blockchain] Balance (MOCK): ${mockBalance} for tokenId ${tokenId}`,
      );

      return mockBalance;

      /* Real implementation (uncomment when contract is ready):
      const voucherNFTAddress = this.configService.get<string>('VOUCHER_NFT_CONTRACT_ADDRESS');
      
      if (!voucherNFTAddress) {
        throw new Error('VOUCHER_NFT_CONTRACT_ADDRESS not configured');
      }

      // ERC-1155 ABI
      const erc1155ABI = [
        'function balanceOf(address account, uint256 id) external view returns (uint256)',
      ];

      const nftContract = new Contract(voucherNFTAddress, erc1155ABI, this.provider);
      const balance = await nftContract.balanceOf(address, tokenId);

      console.log(`[Blockchain] Balance of tokenId ${tokenId} for ${address}: ${balance.toString()}`);
      return Number(balance);
      */
    } catch (error) {
      console.error(
        `[Blockchain] Failed to get voucher balance: ${error.message}`,
      );
      throw new InternalServerErrorException(
        `Failed to get voucher balance from blockchain: ${error.message}`,
      );
    }
  }

  /**
   * Verify if address owns the voucher (balance > 0)
   * @param tokenId - The ERC-1155 token ID
   * @param address - Address to verify
   * @returns true if balance > 0
   */
  async verifyVoucherOwnership(
    tokenId: string,
    address: string,
  ): Promise<boolean> {
    try {
      const balance = await this.getVoucherBalance(tokenId, address);
      return balance > 0;
    } catch (error) {
      console.error(
        `[Blockchain] Ownership verification failed: ${error.message}`,
      );
      return false;
    }
  }

  /**
   * Redeem voucher NFT on blockchain (Burn 1 unit of ERC-1155)
   * @param tokenId - The NFT token ID to redeem
   * @param ownerAddress - Address of the owner
   * @returns Transaction receipt
   */
  async redeemVoucher(tokenId: string, ownerAddress: string) {
    try {
      console.log(
        `[Blockchain] Redeeming voucher tokenId: ${tokenId}, owner: ${ownerAddress}`,
      );

      // TODO: Implement real smart contract integration
      // For now, return mock response
      const mockReceipt = {
        hash: `0x${Math.random().toString(16).substring(2, 66)}`,
        blockNumber: Math.floor(Math.random() * 1000000),
        status: 1, // success
        transactionIndex: 0,
        gasUsed: BigInt(21000),
        effectiveGasPrice: BigInt(1000000000),
      };

      console.log(
        `[Blockchain] Voucher redeemed successfully (MOCK). Tx: ${mockReceipt.hash}`,
      );

      return {
        hash: mockReceipt.hash,
        blockNumber: mockReceipt.blockNumber,
        status: mockReceipt.status,
      };

      /* Real implementation (uncomment when contract is ready):
      const voucherContractAddress =
        this.configService.get<string>('VOUCHER_CONTRACT_ADDRESS');

      if (!voucherContractAddress) {
        throw new Error('VOUCHER_CONTRACT_ADDRESS not configured');
      }

      const signer = new Wallet(this.privateKey, this.provider);

      const voucherABI = [
        'function redeem(uint256 tokenId) external returns (bool)',
        'function getVoucherData(uint256 tokenId) external view returns (string redeemCode, bool isRedeemed)',
        'function ownerOf(uint256 tokenId) external view returns (address)',
      ];

      const contract = new Contract(
        voucherContractAddress,
        voucherABI,
        signer,
      );

      const tx = await contract.redeem(tokenId);
      const receipt = await tx.wait();

      return {
        hash: receipt.hash,
        blockNumber: receipt.blockNumber,
        status: receipt.status,
      };
      */
    } catch (error) {
      console.error(`[Blockchain] Failed to redeem voucher: ${error.message}`);
      throw new InternalServerErrorException(
        `Failed to redeem voucher on blockchain: ${error.message}`,
      );
    }
  }

  /**
   * Get voucher data from blockchain
   * @param tokenId - The NFT token ID
   * @returns Voucher data (redeemCode, isRedeemed)
   */
  async getVoucherData(tokenId: string) {
    try {
      const voucherContractAddress = this.configService.get<string>(
        'VOUCHER_CONTRACT_ADDRESS',
      );

      if (!voucherContractAddress) {
        throw new Error('VOUCHER_CONTRACT_ADDRESS not configured');
      }

      const voucherABI = [
        'function getVoucherData(uint256 tokenId) external view returns (string redeemCode, bool isRedeemed)',
      ];

      const contract = new Contract(
        voucherContractAddress,
        voucherABI,
        this.provider,
      );

      const [redeemCode, isRedeemed] = await contract.getVoucherData(tokenId);

      return {
        tokenId,
        redeemCode,
        isRedeemed,
      };
    } catch (error) {
      console.error(
        `[Blockchain] Failed to get voucher data: ${error.message}`,
      );
      throw new InternalServerErrorException(
        `Failed to get voucher data from blockchain: ${error.message}`,
      );
    }
  }

  /**
   * Mint voucher NFT on blockchain
   * @param toAddress - Recipient address
   * @param redeemCode - Unique redeem code
   * @returns Transaction receipt with tokenId
   */
  async mintVoucher(toAddress: string, redeemCode: string) {
    try {
      console.log(
        `[Blockchain] Minting voucher to: ${toAddress}, code: ${redeemCode}`,
      );

      const voucherContractAddress = this.configService.get<string>(
        'VOUCHER_CONTRACT_ADDRESS',
      );

      if (!voucherContractAddress) {
        throw new Error('VOUCHER_CONTRACT_ADDRESS not configured');
      }

      const signer = new Wallet(this.privateKey, this.provider);

      const voucherABI = [
        'function mint(address to, string memory redeemCode) external returns (uint256)',
        'event VoucherMinted(uint256 indexed tokenId, address indexed to, string redeemCode)',
      ];

      const contract = new Contract(voucherContractAddress, voucherABI, signer);

      const tx = await contract.mint(toAddress, redeemCode);
      const receipt = await tx.wait();

      // Extract tokenId from VoucherMinted event
      const event = receipt.logs.find((log: any) => {
        try {
          const parsedLog = contract.interface.parseLog(log);
          return parsedLog?.name === 'VoucherMinted';
        } catch {
          return false;
        }
      });

      let tokenId = null;
      if (event) {
        const parsedLog = contract.interface.parseLog(event);
        tokenId = parsedLog?.args?.tokenId?.toString();
      }

      console.log(
        `[Blockchain] Voucher minted successfully. TokenId: ${tokenId}, Tx: ${receipt.hash}`,
      );

      return {
        tokenId,
        hash: receipt.hash,
        blockNumber: receipt.blockNumber,
      };
    } catch (error) {
      console.error(`[Blockchain] Failed to mint voucher: ${error.message}`);
      throw new InternalServerErrorException(
        `Failed to mint voucher on blockchain: ${error.message}`,
      );
    }
  }

  /**
   * Batch mint vouchers on blockchain
   * @param toAddress - Recipient address
   * @param redeemCodes - Array of unique redeem codes
   * @returns Transaction receipt
   */
  async batchMintVouchers(toAddress: string, redeemCodes: string[]) {
    try {
      console.log(
        `[Blockchain] Batch minting ${redeemCodes.length} vouchers to: ${toAddress}`,
      );

      const voucherContractAddress = this.configService.get<string>(
        'VOUCHER_CONTRACT_ADDRESS',
      );

      if (!voucherContractAddress) {
        throw new Error('VOUCHER_CONTRACT_ADDRESS not configured');
      }

      const signer = new Wallet(this.privateKey, this.provider);

      const voucherABI = [
        'function batchMint(address to, string[] memory redeemCodes) external',
      ];

      const contract = new Contract(voucherContractAddress, voucherABI, signer);

      const tx = await contract.batchMint(toAddress, redeemCodes);
      const receipt = await tx.wait();

      console.log(
        `[Blockchain] Batch mint completed. Tx: ${receipt.hash}, Minted: ${redeemCodes.length} vouchers`,
      );

      return {
        hash: receipt.hash,
        blockNumber: receipt.blockNumber,
        count: redeemCodes.length,
      };
    } catch (error) {
      console.error(
        `[Blockchain] Failed to batch mint vouchers: ${error.message}`,
      );
      throw new InternalServerErrorException(
        `Failed to batch mint vouchers on blockchain: ${error.message}`,
      );
    }
  }
}
