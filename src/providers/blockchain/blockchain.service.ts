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
import { randomUUID } from 'crypto';

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
    ownerAddress,
  }: createPoint) {
    console.log(
      '[BlockchainService] Creating new point token on blockchain...',
    );
    console.log(
      '[BlockchainService] Factory address:',
      this.pointFactoryAddress,
    );
    console.log('[BlockchainService] Owner (merchant) address:', ownerAddress);
    console.log('[BlockchainService] Initial supply:', initialSupply);

    const signer = new Wallet(this.privateKey, this.provider);

    const contract = new Contract(
      this.pointFactoryAddress,
      PointFactoryABI,
      signer,
    );

    const contractWithSigner = contract.connect(signer) as any;

    const blockTime = await this.resolveBlockTime();

    const initialSupplyWeiFormat = ethers.parseEther(initialSupply.toString());

    // Preview the contract address that will be created
    const result = await contract['createNewPointContract'].staticCallResult(
      initialSupplyWeiFormat,
      ownerAddress,
      name,
      symbol,
      // decimal,
      blockTime,
      frameSize,
    );

    const pointAddress = result[0];
    console.log(
      '[BlockchainService] New point token address preview:',
      pointAddress,
    );

    // Create the point contract with merchant as owner
    console.log(
      '[BlockchainService] Minting initial supply to merchant wallet...',
    );
    const tx = await contractWithSigner['createNewPointContract'](
      initialSupplyWeiFormat,
      ownerAddress,
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
    senderPrivateKey,
  }: transaction & { senderPrivateKey?: string }): Promise<{ txId: string }> {
    try {
      const privateKeyToUse = senderPrivateKey || this.privateKey;
      console.log('[BlockchainService] Starting transaction');
      console.log(
        '[BlockchainService] Using private key type:',
        senderPrivateKey ? 'merchant' : 'admin',
      );
      console.log('[BlockchainService] Point address:', pointAddress);
      console.log('[BlockchainService] Recipient address:', to);
      console.log('[BlockchainService] Amount:', amount);

      const signer = new Wallet(privateKeyToUse, this.provider);
      console.log('[BlockchainService] Signer address:', signer.address);

      const contract = new Contract(pointAddress, PointERC20ABI, signer);

      // Check sender balance before transfer
      console.log('[BlockchainService] Checking sender balance...');
      const balance = await contract['balanceOf'](signer.address);
      const balanceFormatted = ethers.formatEther(balance);
      console.log(
        '[BlockchainService] Sender balance:',
        balanceFormatted,
        'points',
      );

      const contractWithSigner = contract.connect(signer) as any;

      const amountWeiFormat = ethers.parseEther(amount.toString());
      console.log(
        '[BlockchainService] Amount in Wei format:',
        amountWeiFormat.toString(),
      );
      console.log('[BlockchainService] Amount to transfer:', amount, 'points');

      // Validate balance
      if (balance < amountWeiFormat) {
        console.error(
          '[BlockchainService] Insufficient balance! Required:',
          amount,
          'Available:',
          balanceFormatted,
        );
        throw new Error(
          `Insufficient balance. Required: ${amount}, Available: ${balanceFormatted}`,
        );
      }

      console.log('[BlockchainService] Calling contract transfer method...');
      const tx = await contractWithSigner['transfer'](to, amountWeiFormat);
      console.log('[BlockchainService] Transaction hash:', tx.hash);

      console.log(
        '[BlockchainService] Waiting for transaction confirmation...',
      );
      await tx.wait();
      console.log('[BlockchainService] Transaction confirmed');

      return {
        txId: tx.hash,
      };
    } catch (error) {
      console.error('[BlockchainService] Transaction failed:');
      console.error('[BlockchainService] Error message:', error.message);
      console.error('[BlockchainService] Error code:', error.code);
      console.error(
        '[BlockchainService] Error details:',
        JSON.stringify(error, null, 2),
      );
      console.error('[BlockchainService] Point address:', pointAddress);
      console.error('[BlockchainService] Recipient:', to);
      console.error('[BlockchainService] Amount:', amount);
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

      // THB Token burn(address from, uint256 amount)
      const tx = await contractWithSigner['burn'](
        signer.address,
        amountWeiFormat,
      );

      await tx.wait();

      return {
        txId: tx.hash,
      };
    } catch (error) {
      throw new InternalServerErrorException(RPC_SERVER_ERROR);
    }
  }

  async getBalance({
    walletAddress,
    pointAddress,
  }: {
    walletAddress: string;
    pointAddress: string;
  }): Promise<string> {
    try {
      const contract = new Contract(pointAddress, PointERC20ABI, this.provider);
      const balance = await contract['balanceOf'](walletAddress);
      // Convert from Wei to Ether format
      return ethers.formatEther(balance);
    } catch (error) {
      console.error('[BlockchainService] Get balance failed:', error.message);
      throw new InternalServerErrorException('Failed to get balance');
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
    treasuryAddress?: string,
  ) {
    try {
      console.log(
        `[Blockchain] Buying ${amount}x voucher from marketplace. TokenId: ${tokenId}, Buyer: ${buyerAddress}, Price: ${priceInPoints}, Treasury: ${treasuryAddress || 'N/A'}`,
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
   * Redeem coupon on blockchain (ERC-1155)
   * @param typeId - The coupon type ID to redeem
   * @param amount - Amount to redeem (typically 1)
   * @param ownerAddress - Address of the coupon owner
   * @returns Transaction receipt
   */
  async redeemVoucher(typeId: string, amount: number, ownerAddress: string) {
    try {
      console.log(
        `[Blockchain] Redeeming coupon typeId: ${typeId}, amount: ${amount}, owner: ${ownerAddress}`,
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
        `[Blockchain] Coupon redeemed successfully (MOCK). Tx: ${mockReceipt.hash}`,
      );

      return {
        hash: mockReceipt.hash,
        blockNumber: mockReceipt.blockNumber,
        status: mockReceipt.status,
      };

      /* Real implementation (uncomment when contract is ready):
      const couponContractAddress =
        this.configService.get<string>('COUPON_NFT_CONTRACT_ADDRESS');

      if (!couponContractAddress) {
        throw new Error('COUPON_NFT_CONTRACT_ADDRESS not configured');
      }

      const signer = new Wallet(this.privateKey, this.provider);

      const couponABI = [
        'function redeem(uint256 typeId, uint256 amount) external',
        'function redeemFrom(address from, uint256 typeId, uint256 amount) external',
      ];

      const contract = new Contract(
        couponContractAddress,
        couponABI,
        signer,
      );

      // Use redeem (burns from caller) or redeemFrom (burns from specified address)
      const tx = await contract.redeem(typeId, amount);
      const receipt = await tx.wait();

      return {
        hash: receipt.hash,
        blockNumber: receipt.blockNumber,
        status: receipt.status,
      };
      */
    } catch (error) {
      console.error(`[Blockchain] Failed to redeem coupon: ${error.message}`);
      throw new InternalServerErrorException(
        `Failed to redeem coupon on blockchain: ${error.message}`,
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

  /**
   * Create coupon type on ERC-1155 Coupon NFT contract
   * @param name - Coupon name
   * @param startDate - Start date (Unix timestamp in seconds)
   * @param expireDate - Expiry date (Unix timestamp in seconds)
   * @returns typeId from smart contract
   */
  async createCouponType(
    name: string,
    startDate: number,
    expireDate: number,
  ): Promise<{ typeId: string; hash: string; blockNumber: number }> {
    // MOCK IMPLEMENTATION - Returns UUID as typeId
    console.log(
      `[Blockchain] (MOCK) Creating coupon type: ${name}, start: ${startDate}, expire: ${expireDate}`,
    );

    const mockTypeId = randomUUID();
    const mockHash = `0x${Math.random().toString(16).substring(2)}${Math.random().toString(16).substring(2)}`;
    const mockBlockNumber = Math.floor(Math.random() * 1000000);

    console.log(
      `[Blockchain] (MOCK) Coupon type created successfully. TypeId: ${mockTypeId}, Tx: ${mockHash}`,
    );

    return {
      typeId: mockTypeId,
      hash: mockHash,
      blockNumber: mockBlockNumber,
    };

    /* REAL IMPLEMENTATION - Uncomment when smart contract is ready
    try {
      console.log(
        `[Blockchain] Creating coupon type: ${name}, start: ${startDate}, expire: ${expireDate}`,
      );

      const couponContractAddress = this.configService.get<string>(
        'COUPON_NFT_CONTRACT_ADDRESS',
      );

      if (!couponContractAddress) {
        throw new Error('COUPON_NFT_CONTRACT_ADDRESS not configured');
      }

      const signer = new Wallet(this.privateKey, this.provider);

      const couponABI = [
        'function createCouponType(string memory name, uint256 startDate, uint256 expireDate) external returns (uint256)',
        'event CouponTypeCreated(uint256 indexed typeId, string name, uint256 startDate, uint256 expireDate)',
      ];

      const contract = new Contract(couponContractAddress, couponABI, signer);

      const tx = await contract.createCouponType(name, startDate, expireDate);
      const receipt = await tx.wait();

      // Extract typeId from CouponTypeCreated event
      const event = receipt.logs.find((log: any) => {
        try {
          const parsedLog = contract.interface.parseLog(log);
          return parsedLog?.name === 'CouponTypeCreated';
        } catch {
          return false;
        }
      });

      let typeId = null;
      if (event) {
        const parsedLog = contract.interface.parseLog(event);
        typeId = parsedLog?.args?.typeId?.toString();
      }

      console.log(
        `[Blockchain] Coupon type created successfully. TypeId: ${typeId}, Tx: ${receipt.hash}`,
      );

      return {
        typeId,
        hash: receipt.hash,
        blockNumber: receipt.blockNumber,
      };
    } catch (error) {
      console.error(
        `[Blockchain] Failed to create coupon type: ${error.message}`,
      );
      throw new InternalServerErrorException(
        `Failed to create coupon type on blockchain: ${error.message}`,
      );
    }
    */
  }

  /**
   * Mint coupon NFTs (ERC-1155)
   * @param toAddress - Recipient address
   * @param typeId - Coupon type ID
   * @param amount - Amount to mint
   * @returns Transaction receipt
   */
  async mintCoupon(
    toAddress: string,
    typeId: string,
    amount: number,
  ): Promise<{ hash: string; blockNumber: number }> {
    try {
      console.log(
        `[Blockchain] Minting coupon (MOCK) - to: ${toAddress}, typeId: ${typeId}, amount: ${amount}`,
      );

      // TODO: Replace with real smart contract integration
      // Mock response matching the interface
      const mockReceipt = {
        hash: `0x${Math.random().toString(16).substring(2, 66)}`,
        blockNumber: Math.floor(Math.random() * 1000000),
      };

      console.log(
        `[Blockchain] Coupon minted successfully (MOCK). Tx: ${mockReceipt.hash}`,
      );

      return mockReceipt;

      /* Real implementation (uncomment when contract is ready):
      const couponContractAddress = this.configService.get<string>(
        'COUPON_NFT_CONTRACT_ADDRESS',
      );

      if (!couponContractAddress) {
        throw new Error('COUPON_NFT_CONTRACT_ADDRESS not configured');
      }

      const signer = new Wallet(this.privateKey, this.provider);

      const couponABI = [
        'function mint(address to, uint256 typeId, uint256 amount) external',
      ];

      const contract = new Contract(couponContractAddress, couponABI, signer);

      const tx = await contract.mint(toAddress, typeId, amount);
      const receipt = await tx.wait();

      return {
        hash: receipt.hash,
        blockNumber: receipt.blockNumber,
      };
      */
    } catch (error) {
      console.error(`[Blockchain] Failed to mint coupon: ${error.message}`);
      throw new InternalServerErrorException(
        `Failed to mint coupon on blockchain: ${error.message}`,
      );
    }
  }

  /**
   * Batch mint coupons (ERC-1155)
   * @param recipients - Array of recipient addresses
   * @param typeIds - Array of coupon type IDs
   * @param amounts - Array of amounts to mint
   * @returns Transaction receipt
   */
  async batchMintCoupons(
    recipients: string[],
    typeIds: string[],
    amounts: number[],
  ): Promise<{ hash: string; blockNumber: number }> {
    try {
      console.log(
        `[Blockchain] Batch minting coupons (MOCK) - recipients: ${recipients.length}, typeIds: ${typeIds.length}, amounts: ${amounts.length}`,
      );

      if (
        recipients.length !== typeIds.length ||
        recipients.length !== amounts.length
      ) {
        throw new Error(
          'Recipients, typeIds, and amounts arrays must have the same length',
        );
      }

      // TODO: Replace with real smart contract integration
      // Mock response matching the interface
      const mockReceipt = {
        hash: `0x${Math.random().toString(16).substring(2, 66)}`,
        blockNumber: Math.floor(Math.random() * 1000000),
      };

      console.log(
        `[Blockchain] Batch mint successful (MOCK). Tx: ${mockReceipt.hash}, Minted ${recipients.length} coupons`,
      );

      return mockReceipt;

      /* Real implementation (uncomment when contract is ready):
      const couponContractAddress = this.configService.get<string>(
        'COUPON_NFT_CONTRACT_ADDRESS',
      );

      if (!couponContractAddress) {
        throw new Error('COUPON_NFT_CONTRACT_ADDRESS not configured');
      }

      const signer = new Wallet(this.privateKey, this.provider);

      const couponABI = [
        'function batchMint(address[] calldata recipients, uint256[] calldata typeIds, uint256[] calldata amounts) external',
      ];

      const contract = new Contract(couponContractAddress, couponABI, signer);

      const tx = await contract.batchMint(recipients, typeIds, amounts);
      const receipt = await tx.wait();

      return {
        hash: receipt.hash,
        blockNumber: receipt.blockNumber,
      };
      */
    } catch (error) {
      console.error(
        `[Blockchain] Failed to batch mint coupons: ${error.message}`,
      );
      throw new InternalServerErrorException(
        `Failed to batch mint coupons on blockchain: ${error.message}`,
      );
    }
  }

  /**
   * List coupon on marketplace
   * @param typeId - Coupon type ID
   * @param amount - Amount to list
   * @param pricePerUnit - Price per unit in payment token
   * @param paymentToken - Payment token address (e.g., THB token)
   * @returns listingId from marketplace
   */
  async listCoupon(
    typeId: string,
    amount: number,
    pricePerUnit: number,
    paymentToken: string,
  ): Promise<{ listingId: string; hash: string; blockNumber: number }> {
    try {
      console.log(
        `[Blockchain] Listing coupon (MOCK) - typeId: ${typeId}, amount: ${amount}, price: ${pricePerUnit}`,
      );

      // TODO: Replace with real smart contract integration
      // Mock response matching the interface: returns uint256 listingId
      const mockListingId = Math.floor(Math.random() * 1000000).toString();
      const mockReceipt = {
        listingId: mockListingId,
        hash: `0x${Math.random().toString(16).substring(2, 66)}`,
        blockNumber: Math.floor(Math.random() * 1000000),
      };

      console.log(
        `[Blockchain] Coupon listed successfully (MOCK). ListingId: ${mockListingId}, Tx: ${mockReceipt.hash}`,
      );

      return mockReceipt;

      /* Real implementation (uncomment when contract is ready):
      const marketplaceAddress = this.configService.get<string>(
        'MARKETPLACE_CONTRACT_ADDRESS',
      );

      if (!marketplaceAddress) {
        throw new Error('MARKETPLACE_CONTRACT_ADDRESS not configured');
      }

      const signer = new Wallet(this.privateKey, this.provider);

      const marketplaceABI = [
        'function listCoupon(uint256 typeId, uint256 amount, uint256 pricePerUnit, address paymentToken) external returns (uint256)',
        'event CouponListed(uint256 indexed listingId, address indexed seller, uint256 typeId, uint256 amount, uint256 pricePerUnit)',
      ];

      const contract = new Contract(marketplaceAddress, marketplaceABI, signer);

      const tx = await contract.listCoupon(
        typeId,
        amount,
        pricePerUnit,
        paymentToken,
      );
      const receipt = await tx.wait();

      // Extract listingId from CouponListed event
      const event = receipt.logs.find((log: any) => {
        try {
          const parsedLog = contract.interface.parseLog(log);
          return parsedLog?.name === 'CouponListed';
        } catch {
          return false;
        }
      });

      let listingId = null;
      if (event) {
        const parsedLog = contract.interface.parseLog(event);
        listingId = parsedLog?.args?.listingId?.toString();
      }

      return {
        listingId,
        hash: receipt.hash,
        blockNumber: receipt.blockNumber,
      };
      */
    } catch (error) {
      console.error(`[Blockchain] Failed to list coupon: ${error.message}`);
      throw new InternalServerErrorException(
        `Failed to list coupon on marketplace: ${error.message}`,
      );
    }
  }

  /**
   * Buy coupon from marketplace using listingId
   * @param listingId - Listing ID from marketplace
   * @param amount - Amount to buy
   * @param buyerPrivateKey - Buyer's private key for signing
   * @param treasuryAddress - Treasury address to receive points (optional)
   * @returns Transaction receipt
   */
  async buyCoupon(
    listingId: string,
    amount: number,
    treasuryAddress?: string,
  ): Promise<{ hash: string; blockNumber: number }> {
    try {
      console.log(
        `[Blockchain] Buying coupon (MOCK) - listingId: ${listingId}, amount: ${amount}, treasury: ${treasuryAddress || 'N/A'}`,
      );

      // TODO: Replace with real smart contract integration
      // Mock response matching the interface
      const mockReceipt = {
        hash: `0x${Math.random().toString(16).substring(2, 66)}`,
        blockNumber: Math.floor(Math.random() * 1000000),
      };

      console.log(
        `[Blockchain] Coupon purchased successfully (MOCK). Tx: ${mockReceipt.hash}`,
      );

      return mockReceipt;

      /* Real implementation (uncomment when contract is ready):
      const marketplaceAddress = this.configService.get<string>(
        'MARKETPLACE_CONTRACT_ADDRESS',
      );
      const thbTokenAddress =
        this.configService.get<string>('THB_TOKEN_ADDRESS');

      if (!marketplaceAddress) {
        throw new Error('MARKETPLACE_CONTRACT_ADDRESS not configured');
      }

      const signer = new Wallet(buyerPrivateKey, this.provider);

      const marketplaceABI = [
        'function buyCoupon(uint256 listingId, uint256 amount) external',
        'function buyCouponWithToken(uint256 listingId, uint256 amount) external',
      ];

      const contract = new Contract(marketplaceAddress, marketplaceABI, signer);

      // If treasury address is provided, transfer points there first
      if (treasuryAddress && thbTokenAddress) {
        console.log(
          `[Blockchain] Points will be transferred to treasury: ${treasuryAddress}`,
        );
        // Treasury transfer will be handled by the smart contract
      }

      // Use buyCouponWithToken which handles ERC-20 payment
      const tx = await contract.buyCouponWithToken(listingId, amount);
      const receipt = await tx.wait();

      return {
        hash: receipt.hash,
        blockNumber: receipt.blockNumber,
      };
      */
    } catch (error) {
      console.error(`[Blockchain] Failed to buy coupon: ${error.message}`);
      throw new InternalServerErrorException(
        `Failed to buy coupon from marketplace: ${error.message}`,
      );
    }
  }
}
