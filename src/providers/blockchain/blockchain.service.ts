/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { createPoint } from './types';
import * as PointFactoryArtifact from './abis/NewPointTokenFactory.json';
import * as PointTokenArtifact from './abis/NewPointToken.json';
import * as MarketplaceArtifact from './abis/Marketplace.json';
import * as THBArtifact from './abis/THB.json';
import * as CouponArtifact from './abis/Coupon.json';
import * as VaultArtifact from './abis/Vault.json';

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

  private marketplaceAddress: string;

  private thbAddress: string;

  private couponAddress: string;

  private vaultAddress: string;

  // In-memory cache for active marketplace listings (reduces N+1 RPC calls)
  private listingsCache: {
    data: Array<{
      listingId: string;
      seller: string;
      typeId: string;
      amount: string;
      pricePerUnit: string;
      paymentToken: string;
      isActive: boolean;
      listedAt: number;
    }>;
    timestamp: number;
  } | null = null;
  private readonly LISTINGS_CACHE_TTL_MS = 30_000; // 30 seconds

  constructor(private configService: ConfigService) {
    this.pointFactoryAddress = this.configService.get<string>(
      'POINT_FACTORY_ADDRESS',
    );
    this.privateKey = this.configService.get<string>('PRIVATE_KEY');
    this.provider = new JsonRpcProvider(
      this.configService.get<string>('RPC_URL'),
    );
    this.marketplaceAddress = this.configService.get<string>(
      'MARKETPLACE_ADDRESS',
    );
    this.thbAddress = this.configService.get<string>('THB_ADDRESS');
    this.couponAddress = this.configService.get<string>('COUPON_ADDRESS');
    this.vaultAddress = this.configService.get<string>('VAULT_ADDRESS');
  }

  async createNewPointToken({
    initialSupply,
    name,
    symbol,
    decimal,
    startDate,
    endDate,
    expiryMonths,
    ownerAddress,
  }: createPoint) {
    console.log('[BlockchainService] ========================================');
    console.log(
      '[BlockchainService] Creating new point token on blockchain...',
    );
    console.log('[BlockchainService] INPUT PARAMETERS:');
    console.log('[BlockchainService] - name:', name);
    console.log('[BlockchainService] - symbol:', symbol);
    console.log('[BlockchainService] - initialSupply:', initialSupply);
    console.log('[BlockchainService] - decimal:', decimal);
    console.log('[BlockchainService] - startDate:', startDate);
    console.log('[BlockchainService] - endDate:', endDate);
    console.log('[BlockchainService] - expiryMonths:', expiryMonths);
    console.log('[BlockchainService] - ownerAddress:', ownerAddress);
    console.log(
      '[BlockchainService] Factory address:',
      this.pointFactoryAddress,
    );

    const signer = new Wallet(this.privateKey, this.provider);

    const contract = new Contract(
      this.pointFactoryAddress,
      PointFactoryArtifact.abi,
      signer,
    );

    const contractWithSigner = contract.connect(signer) as any;

    // คำนวณ finalExpiryTimestamp ตามลำดับความสำคัญ:
    // 1. ถ้ามี endDate ใช้ endDate (กำหนดวันเอง)
    // 2. ถ้าไม่มี endDate แต่มี expiryMonths ใช้ expiryMonths (เลือกระยะเวลา)
    // 3. ถ้าไม่มีทั้งสอง error
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const effectiveStartDate = startDate || currentTimestamp;

    const finalExpiryTimestamp = this.calculateExpiryTimestamp(
      currentTimestamp,
      effectiveStartDate,
      startDate,
      endDate,
      expiryMonths,
    );

    // คำนวณ epochDuration ที่เหมาะสมตามระยะเวลา
    const remainingTime = finalExpiryTimestamp - currentTimestamp;
    const daysRemaining = remainingTime / 86400;
    const epochDuration = this.calculateEpochDuration(daysRemaining);

    // คำนวณ windowSize จาก epochDuration
    const windowSize = Math.ceil(remainingTime / epochDuration);

    // Validate contract parameter limits
    // uint40 max = 1,099,511,627,775 (more than enough for epoch duration)
    // uint8 max = 255
    if (windowSize > 255) {
      throw new Error(
        `Window size ${windowSize} exceeds uint8 maximum (255). Please use shorter epoch duration or expiry period.`,
      );
    }

    console.log('[BlockchainService] CALCULATED VALUES:');
    console.log('[BlockchainService] - Current timestamp:', currentTimestamp);
    console.log(
      '[BlockchainService] - Effective start date:',
      effectiveStartDate,
    );
    console.log(
      '[BlockchainService] - Final expiry timestamp:',
      finalExpiryTimestamp,
    );
    console.log(
      '[BlockchainService] - Remaining time:',
      remainingTime,
      'seconds (~',
      Math.floor(daysRemaining),
      'days)',
    );
    console.log(
      '[BlockchainService] - Epoch duration:',
      epochDuration,
      'seconds (~',
      Math.floor(epochDuration / 3600),
      'hours)',
    );
    console.log('[BlockchainService] - Window size:', windowSize, 'epochs');

    const initialSupplyWeiFormat = ethers.parseEther(initialSupply.toString());

    // Convert to BigInt for uint40 and uint8
    const epochDurationBigInt = BigInt(epochDuration);
    const windowSizeBigInt = BigInt(windowSize);

    console.log('[BlockchainService] CONTRACT CALL PARAMETERS:');
    console.log('[BlockchainService] - name:', name);
    console.log('[BlockchainService] - symbol:', symbol);
    console.log(
      '[BlockchainService] - epochDuration (BigInt):',
      epochDurationBigInt.toString(),
    );
    console.log(
      '[BlockchainService] - windowSize (BigInt):',
      windowSizeBigInt.toString(),
    );
    console.log(
      '[BlockchainService] - initialSupply (Wei):',
      initialSupplyWeiFormat.toString(),
    );

    // Preview the contract address that will be created
    const result = await contract['deployPointToken'].staticCallResult(
      name,
      symbol,
      epochDurationBigInt,
      windowSizeBigInt,
      initialSupplyWeiFormat,
      ownerAddress,
    );

    const pointAddress = result[0];
    console.log(
      '[BlockchainService] New point token address preview:',
      pointAddress,
    );

    // Deploy the point contract with initial supply
    console.log(
      '[BlockchainService] Deploying point token contract with initial supply...',
    );
    const tx = await contractWithSigner['deployPointToken'](
      name,
      symbol,
      epochDurationBigInt,
      windowSizeBigInt,
      initialSupplyWeiFormat,
      ownerAddress,
      {
        gasLimit: 15000000, // 15M gas limit
      },
    );

    await tx.wait();

    console.log(
      '[BlockchainService] Point token deployed successfully at:',
      pointAddress,
    );
    console.log(
      '[BlockchainService] Initial supply',
      initialSupply,
      'automatically minted to:',
      ownerAddress,
    );

    const pointBuffer = createBufferFromHex(pointAddress);

    // Return deployment details including calculated values
    return {
      contractAddress: pointBuffer,
      startDate: effectiveStartDate,
      endDate: finalExpiryTimestamp,
      epochDuration: epochDuration,
    };
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

  /** Calculate the final expiry timestamp from endDate or expiryMonths */
  private calculateExpiryTimestamp(
    currentTimestamp: number,
    effectiveStartDate: number,
    startDate: number | undefined,
    endDate: number | undefined,
    expiryMonths: number | undefined,
  ): number {
    if (endDate) {
      return this.validateAndUseEndDate(currentTimestamp, startDate, endDate);
    }
    if (expiryMonths) {
      return this.calculateFromExpiryMonths(
        effectiveStartDate,
        startDate,
        expiryMonths,
      );
    }
    throw new Error('Either endDate or expiryMonths must be provided');
  }

  private validateAndUseEndDate(
    currentTimestamp: number,
    startDate: number | undefined,
    endDate: number,
  ): number {
    if (startDate && endDate <= startDate) {
      throw new Error('endDate must be greater than startDate');
    }
    if (endDate <= currentTimestamp) {
      throw new Error('endDate must be in the future');
    }
    console.log('[BlockchainService] Using custom date range');
    if (startDate) {
      console.log('[BlockchainService] Start date:', startDate);
    }
    console.log('[BlockchainService] End date:', endDate);
    return endDate;
  }

  private calculateFromExpiryMonths(
    effectiveStartDate: number,
    startDate: number | undefined,
    expiryMonths: number,
  ): number {
    const validMonths = [3, 6, 9, 12, 24];
    if (!validMonths.includes(expiryMonths)) {
      throw new Error(
        `Invalid expiryMonths. Must be one of: ${validMonths.join(', ')}`,
      );
    }
    const secondsPerMonth = 30.44 * 24 * 60 * 60;
    const result =
      effectiveStartDate + Math.floor(expiryMonths * secondsPerMonth);

    console.log('[BlockchainService] Using predefined duration');
    console.log('[BlockchainService] Expiry months:', expiryMonths, 'months');
    if (startDate) {
      console.log('[BlockchainService] Start date:', startDate);
    }
    console.log('[BlockchainService] Calculated end date:', result);
    return result;
  }

  /** Select appropriate epoch duration based on remaining days */
  private calculateEpochDuration(daysRemaining: number): number {
    if (daysRemaining <= 1) return 3600; // 1 hour
    if (daysRemaining <= 7) return 43200; // 12 hours
    if (daysRemaining <= 30) return 86400; // 1 day
    if (daysRemaining <= 90) return 259200; // 3 days
    return 604800; // 7 days
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

      const contract = new Contract(
        pointAddress,
        PointTokenArtifact.abi,
        signer,
      );

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
      console.error('[BlockchainService] Error reason:', error.reason);
      console.error('[BlockchainService] Error info:', error.info);
      console.error('[BlockchainService] Error data:', error.data);
      console.error('[BlockchainService] Error stack:', error.stack);
      console.error(
        '[BlockchainService] Error shortMessage:',
        error.shortMessage,
      );
      console.error('[BlockchainService] Point address:', pointAddress);
      console.error('[BlockchainService] Recipient:', to);
      console.error('[BlockchainService] Amount:', amount);

      // Re-throw with more specific error message if available
      if (error.reason) {
        throw new InternalServerErrorException(
          `Blockchain error: ${error.reason}`,
        );
      }
      if (error.shortMessage) {
        throw new InternalServerErrorException(
          `Blockchain error: ${error.shortMessage}`,
        );
      }
      throw new InternalServerErrorException(
        `${RPC_SERVER_ERROR}: ${error.message}`,
      );
    }
  }

  async mint({
    amount,
    to,
    pointAddress,
  }: transaction): Promise<{ txId: string }> {
    try {
      const signer = new Wallet(this.privateKey, this.provider);

      const contract = new Contract(
        pointAddress,
        PointTokenArtifact.abi,
        signer,
      );

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
      const contract = new Contract(
        pointAddress,
        PointTokenArtifact.abi,
        signer,
      );
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
  }): Promise<{ balance: string; balanceWei: string }> {
    try {
      const contract = new Contract(
        pointAddress,
        PointTokenArtifact.abi,
        this.provider,
      );
      const balance = await contract['balanceOf'](walletAddress);
      // Convert from Wei to Ether format
      return {
        balance: ethers.formatEther(balance),
        balanceWei: balance.toString(),
      };
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

      const contract = new Contract(
        pointAddress,
        PointTokenArtifact.abi,
        signer,
      );

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
   * @deprecated This method is deprecated. Use buyCoupon() with proper listingId instead.
   * Buy voucher from marketplace (ERC-1155) - DEPRECATED
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
    console.error(
      `[Blockchain] DEPRECATED: buyVoucherFromMarketplace called. This method requires proper listingId setup.`,
    );
    console.error(
      `TokenId: ${tokenId}, Buyer: ${buyerAddress}, Price: ${priceInPoints}, Amount: ${amount}`,
    );

    throw new InternalServerErrorException(
      'This voucher code is not properly configured for marketplace. ' +
        'Please ensure voucherGroupId (listingId) is set. ' +
        'Contact administrator to migrate to new marketplace system.',
    );
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

      if (!this.couponAddress) {
        throw new Error('COUPON_ADDRESS not configured');
      }

      const contract = new Contract(
        this.couponAddress,
        CouponArtifact.abi,
        this.provider,
      );

      const balance = await contract.balanceOf(address, tokenId);
      const balanceNumber = Number(balance);

      console.log(
        `[Blockchain] Balance: ${balanceNumber} for tokenId ${tokenId}`,
      );

      return balanceNumber;

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
  async redeemVoucher(
    typeId: string,
    amount: number,
    ownerAddress: string,
    ownerPrivateKey?: string,
  ) {
    try {
      console.log(
        `[Blockchain] Redeeming coupon typeId: ${typeId}, amount: ${amount}, owner: ${ownerAddress}`,
      );

      if (!this.couponAddress) {
        throw new Error('COUPON_ADDRESS not configured');
      }

      const signer = new Wallet(
        ownerPrivateKey || this.privateKey,
        this.provider,
      );
      const contract = new Contract(
        this.couponAddress,
        CouponArtifact.abi,
        signer,
      );

      // Use redeem (burns from caller) or redeemFrom (burns from specified address)
      const tx = await contract.redeem(typeId, amount, {
        gasLimit: 15000000,
      });
      const receipt = await tx.wait();

      console.log(
        `[Blockchain] Coupon redeemed successfully. Tx: ${receipt.hash}`,
      );

      return {
        hash: receipt.hash,
        blockNumber: receipt.blockNumber,
        status: receipt.status,
      };
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
    try {
      console.log(
        `[Blockchain] Creating coupon type: ${name}, start: ${startDate}, expire: ${expireDate}`,
      );

      if (!this.couponAddress) {
        throw new Error('COUPON_ADDRESS not configured');
      }

      const signer = new Wallet(this.privateKey, this.provider);
      const contract = new Contract(
        this.couponAddress,
        CouponArtifact.abi,
        signer,
      );

      const tx = await contract.createCouponType(name, startDate, expireDate, {
        gasLimit: 15000000,
      });
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
      if (!event) {
        throw new Error('CouponTypeCreated event not found');
      }

      const parsedLog = contract.interface.parseLog(event);
      typeId = parsedLog?.args?.typeId?.toString();

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
        `[Blockchain] Minting coupon - to: ${toAddress}, typeId: ${typeId}, amount: ${amount}`,
      );

      if (!this.couponAddress) {
        throw new Error('COUPON_ADDRESS not configured');
      }

      const signer = new Wallet(this.privateKey, this.provider);
      const contract = new Contract(
        this.couponAddress,
        CouponArtifact.abi,
        signer,
      );

      const tx = await contract.mint(toAddress, typeId, amount, {
        gasLimit: 15000000,
      });
      const receipt = await tx.wait();

      console.log(
        `[Blockchain] Coupon minted successfully. Tx: ${receipt.hash}`,
      );

      return {
        hash: receipt.hash,
        blockNumber: receipt.blockNumber,
      };
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
        `[Blockchain] Batch minting coupons - recipients: ${recipients.length}, typeIds: ${typeIds.length}, amounts: ${amounts.length}`,
      );

      if (
        recipients.length !== typeIds.length ||
        recipients.length !== amounts.length
      ) {
        throw new Error(
          'Recipients, typeIds, and amounts arrays must have the same length',
        );
      }

      if (!this.couponAddress) {
        throw new Error('COUPON_ADDRESS not configured');
      }

      const signer = new Wallet(this.privateKey, this.provider);
      const contract = new Contract(
        this.couponAddress,
        CouponArtifact.abi,
        signer,
      );

      const tx = await contract.batchMint(recipients, typeIds, amounts, {
        gasLimit: 15000000,
      });
      const receipt = await tx.wait();

      console.log(
        `[Blockchain] Batch mint successful. Tx: ${receipt.hash}, Minted ${recipients.length} coupons`,
      );

      return {
        hash: receipt.hash,
        blockNumber: receipt.blockNumber,
      };
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
   * Get marketplace listing details
   * @param listingId - Listing ID
   * @returns Listing details
   */
  async getMarketplaceListing(listingId: string) {
    try {
      console.log('[Blockchain] Fetching listing:', listingId);

      if (!this.marketplaceAddress) {
        throw new Error('MARKETPLACE_ADDRESS not configured');
      }

      const marketplaceContract = new Contract(
        this.marketplaceAddress,
        MarketplaceArtifact.abi,
        this.provider,
      );

      const listing = await marketplaceContract.getListing(listingId);

      return {
        seller: listing.seller,
        typeId: listing.typeId.toString(),
        amount: listing.amount.toString(),
        pricePerUnit: ethers.formatEther(listing.pricePerUnit),
        paymentToken: listing.paymentToken,
        isActive: listing.active,
        listedAt: Number(listing.listedAt),
      };
    } catch (error) {
      console.error(`[Blockchain] Failed to get listing: ${error.message}`);
      throw new InternalServerErrorException(
        `Failed to get listing: ${error.message}`,
      );
    }
  }

  /**
   * Invalidate the in-memory listings cache.
   * Called after write operations (list, delist, buy) that change marketplace state.
   */
  invalidateListingsCache() {
    if (this.listingsCache) {
      console.log('[Blockchain] Listings cache invalidated');
    }
    this.listingsCache = null;
  }

  /**
   * Get all active marketplace listings.
   * Uses 2 parallel RPC calls (getActiveListings + getAllActiveListings) instead of N+1.
   * Results are cached in-memory for 30s and auto-invalidated on write operations.
   * @returns Array of active listings
   */
  async getAllActiveMarketplaceListings() {
    try {
      // Return cached data if still valid
      if (
        this.listingsCache &&
        Date.now() - this.listingsCache.timestamp < this.LISTINGS_CACHE_TTL_MS
      ) {
        console.log(
          '[Blockchain] Returning cached listings (%d items, age: %ds)',
          this.listingsCache.data.length,
          Math.round((Date.now() - this.listingsCache.timestamp) / 1000),
        );
        return this.listingsCache.data;
      }

      console.log('[Blockchain] Fetching all active listings (cache miss)...');

      if (!this.marketplaceAddress) {
        throw new Error('MARKETPLACE_ADDRESS not configured');
      }

      const marketplaceContract = new Contract(
        this.marketplaceAddress,
        MarketplaceArtifact.abi,
        this.provider,
      );

      // 2 parallel RPC calls instead of N+1 individual getListing() calls
      const [listingIds, listingStructs] = await Promise.all([
        marketplaceContract.getActiveListings(),
        marketplaceContract.getAllActiveListings(),
      ]);

      console.log(
        '[Blockchain] getActiveListings() returned:',
        listingIds.length,
        'IDs',
      );

      // Zip listing IDs with struct data (same order from contract)
      const listings = listingIds.map((id: bigint, index: number) => {
        const listing = listingStructs[index];
        return {
          listingId: id.toString(),
          seller: listing.seller,
          typeId: listing.typeId.toString(),
          amount: listing.amount.toString(),
          pricePerUnit: ethers.formatEther(listing.pricePerUnit),
          paymentToken: listing.paymentToken,
          isActive: listing.active,
          listedAt: Number(listing.listedAt),
        };
      });

      console.log('[Blockchain] Found', listings.length, 'active listings');

      // Update cache
      this.listingsCache = { data: listings, timestamp: Date.now() };

      return listings;
    } catch (error) {
      console.error(`[Blockchain] Failed to get listings: ${error.message}`);
      throw new InternalServerErrorException(
        `Failed to get listings: ${error.message}`,
      );
    }
  }

  /**
   * Delist a coupon from marketplace (cancel listing)
   * @param listingId - The listing ID to delist
   * @param sellerPrivateKey - The seller's private key to sign the transaction
   * @returns Transaction hash and block number
   */
  async delistCoupon(
    listingId: string,
    sellerPrivateKey: string,
  ): Promise<{ hash: string; blockNumber: number }> {
    try {
      console.log(`[Blockchain] Delisting coupon for listing ${listingId}...`);

      if (!this.marketplaceAddress) {
        throw new Error('MARKETPLACE_ADDRESS not configured');
      }

      const signer = new Wallet(sellerPrivateKey, this.provider);
      const marketplaceContract = new Contract(
        this.marketplaceAddress,
        MarketplaceArtifact.abi,
        signer,
      );

      const tx = await marketplaceContract.delistCoupon(listingId, {
        gasLimit: 15000000,
      });
      const receipt = await tx.wait();

      console.log(
        `[Blockchain] Coupon delisted. ListingId: ${listingId}, Tx: ${receipt.hash}`,
      );

      // Invalidate listings cache after delist
      this.invalidateListingsCache();

      return {
        hash: receipt.hash,
        blockNumber: receipt.blockNumber,
      };
    } catch (error) {
      console.error(`[Blockchain] Failed to delist coupon: ${error.message}`);
      throw new InternalServerErrorException(
        `Failed to delist coupon: ${error.message}`,
      );
    }
  }

  /**
   * Get user THB balance
   * @param userAddress - User wallet address
   * @returns THB balance
   */
  async getUserTHBBalance(userAddress: string) {
    try {
      console.log('[Blockchain] Checking THB balance for:', userAddress);

      const thbContract = new Contract(
        this.thbAddress,
        THBArtifact.abi,
        this.provider,
      );

      const balance = await thbContract.balanceOf(userAddress);

      return {
        address: userAddress,
        balance: ethers.formatEther(balance),
        balanceWei: balance.toString(),
      };
    } catch (error) {
      console.error(`[Blockchain] Failed to get THB balance: ${error.message}`);
      throw new InternalServerErrorException(
        `Failed to get THB balance: ${error.message}`,
      );
    }
  }

  /**
   * Mint THB token to target address
   */
  async mintTHB(
    toAddress: string,
    amountWei: bigint,
  ): Promise<{ hash: string; blockNumber: number }> {
    try {
      console.log('[Blockchain] Minting THB...');
      if (!this.thbAddress) {
        throw new Error('THB_ADDRESS not configured');
      }

      const signer = new Wallet(this.privateKey, this.provider);
      const contract = new Contract(this.thbAddress, THBArtifact.abi, signer);

      const tx = await contract.mint(toAddress, amountWei, {
        gasLimit: 15000000,
      });
      const receipt = await tx.wait();

      console.log(
        `[Blockchain] THB minted. To: ${toAddress}, Amount: ${amountWei.toString()}, Tx: ${receipt.hash}`,
      );

      return {
        hash: receipt.hash,
        blockNumber: receipt.blockNumber,
      };
    } catch (error) {
      console.error(`[Blockchain] Failed to mint THB: ${error.message}`);
      throw new InternalServerErrorException(
        `Failed to mint THB: ${error.message}`,
      );
    }
  }

  /**
   * Approve THB spending
   */
  async approveTHB(
    spenderAddress: string,
    amountWei: bigint,
    ownerPrivateKey?: string,
  ): Promise<{ hash: string; blockNumber: number }> {
    try {
      console.log(
        `[Blockchain] Approving THB for ${spenderAddress}. Amount: ${amountWei.toString()}`,
      );
      if (!this.thbAddress) {
        throw new Error('THB_ADDRESS not configured');
      }

      const signer = new Wallet(
        ownerPrivateKey || this.privateKey,
        this.provider,
      );
      const contract = new Contract(this.thbAddress, THBArtifact.abi, signer);

      const tx = await contract.approve(spenderAddress, amountWei, {
        gasLimit: 15000000,
      });
      const receipt = await tx.wait();

      console.log(`[Blockchain] THB approval tx: ${receipt.hash}`);

      return {
        hash: receipt.hash,
        blockNumber: receipt.blockNumber,
      };
    } catch (error) {
      console.error(`[Blockchain] Failed to approve THB: ${error.message}`);
      throw new InternalServerErrorException(
        `Failed to approve THB: ${error.message}`,
      );
    }
  }

  private getVaultContract(signerOrProvider?: any) {
    if (!this.vaultAddress) {
      throw new Error('VAULT_ADDRESS not configured');
    }

    console.log(
      `[Blockchain] Using vault contract at ${this.vaultAddress} with ${signerOrProvider ? 'signer/provider' : 'default provider'}`,
    );

    return new Contract(
      this.vaultAddress,
      VaultArtifact.abi,
      signerOrProvider || this.provider,
    );
  }

  /**
   * Lock funds for a coupon type in the vault
   */
  async lockFundsForCouponType(
    tokenId: string,
    sellerAddress: string,
    pricePerUnitTHB: number,
    totalIssued: number,
    buyerPrivateKey?: string,
  ): Promise<{
    hash: string;
    blockNumber: number;
    amountWei: bigint;
    buyerAddress: string;
    sellerAddress: string;
  }> {
    try {
      console.log('[Blockchain] Locking funds in vault...');
      if (!tokenId) {
        throw new Error('tokenId is required to lock funds');
      }
      if (!sellerAddress) {
        throw new Error('sellerAddress is required to lock funds');
      }
      if (pricePerUnitTHB <= 0) {
        throw new Error('pricePerUnitTHB must be greater than 0');
      }
      if (totalIssued <= 0) {
        throw new Error('totalIssued must be greater than 0');
      }
      if (!this.vaultAddress) {
        throw new Error('VAULT_ADDRESS not configured');
      }

      const buyerSigner = new Wallet(
        buyerPrivateKey || this.privateKey,
        this.provider,
      );

      // Calculate total amount = price * totalIssued (in Wei)
      const unitPriceWei = ethers.parseEther(pricePerUnitTHB.toString());
      const totalAmountWei = unitPriceWei * BigInt(totalIssued);

      // Mint THB to buyer signer, approve vault, then lock
      await this.mintTHB(buyerSigner.address, totalAmountWei);
      await this.approveTHB(this.vaultAddress, totalAmountWei, buyerPrivateKey);

      const vaultContract = this.getVaultContract(buyerSigner);
      const tx = await vaultContract.lockFunds(
        tokenId,
        sellerAddress,
        buyerSigner.address,
        totalAmountWei,
        BigInt(totalIssued),
        { gasLimit: 15000000 },
      );
      const receipt = await tx.wait();

      console.log(
        `[Blockchain] Funds locked. Tx: ${receipt.hash}, Amount: ${totalAmountWei.toString()}`,
      );

      return {
        hash: receipt.hash,
        blockNumber: receipt.blockNumber,
        amountWei: totalAmountWei,
        buyerAddress: buyerSigner.address,
        sellerAddress,
      };
    } catch (error) {
      console.error(`[Blockchain] Failed to lock funds: ${error.message}`);
      throw new InternalServerErrorException(
        `Failed to lock funds in vault: ${error.message}`,
      );
    }
  }

  /**
   * Check if vault has active escrow for tokenId
   */
  async hasActiveVaultEscrow(tokenId: string): Promise<boolean> {
    try {
      if (!this.vaultAddress) {
        console.warn(
          '[Blockchain] VAULT_ADDRESS not configured. Skipping vault escrow check.',
        );
        return false;
      }

      const vaultContract = this.getVaultContract(this.provider);
      const result = await vaultContract.hasActiveEscrow(tokenId);
      return Boolean(result);
    } catch (error) {
      console.error(
        `[Blockchain] Failed to check vault escrow: ${error.message}`,
      );
      throw new InternalServerErrorException(
        `Failed to check vault escrow: ${error.message}`,
      );
    }
  }

  /**
   * Release vault funds for redeemed coupons
   */
  async releaseVaultFundsPartial(
    tokenId: string,
    couponsToRedeem: number,
  ): Promise<{ hash: string; blockNumber: number }> {
    try {
      console.log(
        `[Blockchain] Releasing vault funds - tokenId: ${tokenId}, coupons: ${couponsToRedeem}`,
      );

      const signer = new Wallet(this.privateKey, this.provider);
      const vaultContract = this.getVaultContract(signer);
      const tx = await vaultContract.releaseFundsPartial(
        tokenId,
        BigInt(couponsToRedeem),
        { gasLimit: 15000000 },
      );
      const receipt = await tx.wait();

      console.log(
        `[Blockchain] Vault funds released. Tx: ${receipt.hash}, Coupons: ${couponsToRedeem}`,
      );

      return {
        hash: receipt.hash,
        blockNumber: receipt.blockNumber,
      };
    } catch (error) {
      console.error(
        `[Blockchain] Failed to release vault funds: ${error.message}`,
      );
      throw new InternalServerErrorException(
        `Failed to release vault funds: ${error.message}`,
      );
    }
  }

  /**
   * Lock escrow by performing a marketplace THB purchase (Vault expects calls from marketplace)
   */
  async lockEscrowThroughMarketplace(
    listingId: string,
    amount: number,
    buyerPrivateKey?: string,
  ): Promise<{ hash: string; blockNumber: number }> {
    try {
      console.log(
        `[Blockchain] Locking escrow via marketplace purchase. Listing: ${listingId}, Amount: ${amount}`,
      );

      if (!this.marketplaceAddress) {
        throw new Error('MARKETPLACE_ADDRESS not configured');
      }
      if (!this.vaultAddress) {
        throw new Error('VAULT_ADDRESS not configured');
      }
      if (!this.thbAddress) {
        throw new Error('THB_ADDRESS not configured');
      }

      const signer = new Wallet(
        buyerPrivateKey || this.privateKey,
        this.provider,
      );

      const marketplaceContract = new Contract(
        this.marketplaceAddress,
        MarketplaceArtifact.abi,
        signer,
      );

      const thbContract = new Contract(
        this.thbAddress,
        THBArtifact.abi,
        signer,
      );

      const listing = await marketplaceContract.getListing(listingId);
      if (!listing.active) {
        throw new Error('Listing is not active');
      }
      if (
        listing.paymentToken.toLowerCase() !== this.thbAddress.toLowerCase()
      ) {
        throw new Error('Listing payment token is not THB');
      }
      if (listing.amount < BigInt(amount)) {
        throw new Error('Not enough amount in listing to lock escrow');
      }

      const totalPrice = listing.pricePerUnit * BigInt(amount);

      // Ensure buyer has enough THB (mint shortfall)
      const balance = await thbContract.balanceOf(signer.address);
      if (balance < totalPrice) {
        const shortfall = totalPrice - balance;
        console.log(
          `[Blockchain] Minting THB to cover shortfall: ${shortfall.toString()}`,
        );
        await this.mintTHB(signer.address, shortfall);
      }

      // Approve vault for total price
      await this.approveTHB(this.vaultAddress, totalPrice, buyerPrivateKey);

      // Buy to create escrow
      const tx = await marketplaceContract.buyCoupon(listingId, amount, {
        gasLimit: 15000000,
      });
      const receipt = await tx.wait();

      console.log(
        `[Blockchain] Escrow locked via marketplace purchase. Tx: ${receipt.hash}`,
      );

      return {
        hash: receipt.hash,
        blockNumber: receipt.blockNumber,
      };
    } catch (error) {
      console.error(
        `[Blockchain] Failed to lock escrow via marketplace: ${error.message}`,
      );
      throw new InternalServerErrorException(
        `Failed to lock escrow via marketplace: ${error.message}`,
      );
    }
  }

  /**
   * Get user coupon balance
   * @param userAddress - User wallet address
   * @param typeId - Coupon type ID
   * @returns Coupon balance
   */
  async getUserCouponBalance(userAddress: string, typeId: number) {
    try {
      console.log('[Blockchain] Checking coupon balance...');
      console.log('[Blockchain] - Address:', userAddress);
      console.log('[Blockchain] - Type ID:', typeId);

      const couponContract = new Contract(
        this.couponAddress,
        CouponArtifact.abi,
        this.provider,
      );

      const balance = await couponContract.balanceOf(userAddress, typeId);

      return {
        address: userAddress,
        typeId: typeId.toString(),
        balance: balance.toString(),
      };
    } catch (error) {
      console.error(
        `[Blockchain] Failed to get coupon balance: ${error.message}`,
      );
      throw new InternalServerErrorException(
        `Failed to get coupon balance: ${error.message}`,
      );
    }
  }

  /**
   * Get user coupon balances in batch (single RPC call)
   * Uses ERC-1155 balanceOfBatch to check multiple tokenIds at once
   * @param userAddress - User wallet address
   * @param typeIds - Array of coupon type IDs
   * @returns Map of tokenId string -> balance number
   */
  async getUserCouponBalanceBatch(
    userAddress: string,
    typeIds: number[],
  ): Promise<Map<string, number>> {
    try {
      console.log('[Blockchain] Checking coupon balances in batch...');
      console.log('[Blockchain] - Address:', userAddress);
      console.log('[Blockchain] - Type IDs count:', typeIds.length);

      const couponContract = new Contract(
        this.couponAddress,
        CouponArtifact.abi,
        this.provider,
      );

      // balanceOfBatch requires parallel arrays of addresses and ids
      const addresses = typeIds.map(() => userAddress);
      const balances: bigint[] = await couponContract.balanceOfBatch(
        addresses,
        typeIds,
      );

      const result = new Map<string, number>();
      for (let i = 0; i < typeIds.length; i++) {
        result.set(typeIds[i].toString(), Number(balances[i]));
      }

      return result;
    } catch (error) {
      console.error(
        `[Blockchain] Failed to get coupon balances in batch: ${error.message}`,
      );
      throw new InternalServerErrorException(
        `Failed to get coupon balances in batch: ${error.message}`,
      );
    }
  }

  /**
   * List coupon on marketplace
   * @param typeId - Coupon type ID
   * @param amount - Amount to list
   * @param pricePerUnit - Price per unit in payment token
   * @param sellerPrivateKey - Seller's private key for signing
   * @param paymentTokenAddress - Payment token address (Point Token for customer purchases)
   * @returns listingId from marketplace
   */
  async listCoupon(
    typeId: string,
    amount: number,
    pricePerUnit: string,
    sellerPrivateKey?: string,
    paymentTokenAddress?: string,
  ): Promise<{ listingId: string; hash: string; blockNumber: number }> {
    try {
      const paymentToken = paymentTokenAddress || this.thbAddress;

      console.log('[Blockchain] Listing coupon on marketplace...');
      console.log('[Blockchain] - TypeId:', typeId);
      console.log('[Blockchain] - Amount:', amount);
      console.log('[Blockchain] - Price per unit:', pricePerUnit);
      console.log('[Blockchain] - Payment token:', paymentToken);

      if (!this.marketplaceAddress) {
        throw new Error('MARKETPLACE_ADDRESS not configured');
      }

      const signer = sellerPrivateKey
        ? new Wallet(sellerPrivateKey, this.provider)
        : new Wallet(this.privateKey, this.provider);

      // 1. Approve marketplace to transfer coupons
      await this.ensureMarketplaceApproval(signer);

      // 2. Create listing on marketplace
      const marketplaceContract = new Contract(
        this.marketplaceAddress,
        MarketplaceArtifact.abi,
        signer,
      );

      const pricePerUnitWei = ethers.parseEther(pricePerUnit);

      console.log('[Blockchain] Creating listing on marketplace...');
      const tx = await marketplaceContract.listCoupon(
        typeId,
        amount,
        pricePerUnitWei,
        paymentToken,
        { gasLimit: 15000000 },
      );

      const receipt = await tx.wait();

      console.log(`[Blockchain] Transaction status: ${receipt.status}`);
      console.log(`[Blockchain] Total logs: ${receipt.logs.length}`);

      // Parse CouponListed event with multiple fallback methods
      const listingId = await this.extractListingIdFromReceipt(
        receipt,
        marketplaceContract,
      );

      console.log('[Blockchain] Listing created successfully');
      console.log('[Blockchain] - Listing ID:', listingId);
      console.log('[Blockchain] - Tx Hash:', receipt.hash);

      // Invalidate listings cache after new listing
      this.invalidateListingsCache();

      return {
        listingId,
        hash: receipt.hash,
        blockNumber: receipt.blockNumber,
      };
    } catch (error) {
      console.error(`[Blockchain] Failed to list coupon: ${error.message}`);
      throw new InternalServerErrorException(
        `Failed to list coupon: ${error.message}`,
      );
    }
  }

  /** Ensure the seller's coupons are approved for marketplace transfer */
  private async ensureMarketplaceApproval(signer: any) {
    const couponContract = new Contract(
      this.couponAddress,
      CouponArtifact.abi,
      signer,
    );

    console.log('[Blockchain] Checking current approval status...');
    const sellerAddress = signer.address;
    const isCurrentlyApproved = await couponContract.isApprovedForAll(
      sellerAddress,
      this.marketplaceAddress,
    );
    console.log('[Blockchain] - Seller address:', sellerAddress);
    console.log('[Blockchain] - Currently approved:', isCurrentlyApproved);

    if (isCurrentlyApproved) {
      console.log('[Blockchain] Marketplace already approved ✓');
      return;
    }

    console.log('[Blockchain] Approving marketplace for coupon transfer...');
    const approveTx = await couponContract.setApprovalForAll(
      this.marketplaceAddress,
      true,
      { gasLimit: 15000000 },
    );
    const approveReceipt = await approveTx.wait();
    console.log('[Blockchain] - Approval tx:', approveReceipt.hash);
  }

  /** Extract listingId from receipt using multiple fallback strategies */
  private async extractListingIdFromReceipt(
    receipt: any,
    marketplaceContract: any,
  ): Promise<string> {
    const listingId =
      this.extractListingIdFromTopics(receipt) ||
      this.extractListingIdFromParsedLogs(receipt, marketplaceContract) ||
      (await this.extractListingIdFromActiveListings(marketplaceContract));

    if (!listingId || listingId === '0') {
      console.error('[Blockchain] ERROR: Unable to determine listing ID!');
      console.error(
        '[Blockchain] Receipt logs:',
        JSON.stringify(
          receipt.logs.map((log: any) => ({
            address: log.address,
            topics: log.topics,
            data: log.data,
          })),
          null,
          2,
        ),
      );
      throw new Error(
        'Failed to create listing: Unable to extract listing ID from transaction receipt. The transaction may have reverted.',
      );
    }

    return listingId;
  }

  /** Method 1: Direct topic extraction (fastest) */
  private extractListingIdFromTopics(receipt: any): string | null {
    try {
      const COUPON_LISTED_SIGNATURE =
        '0xe694c172c6060c783e16922da96667b80fac2b705fc5972a8712212db8fe0b70';

      for (const log of receipt.logs) {
        if (
          log.address.toLowerCase() === this.marketplaceAddress.toLowerCase() &&
          log.topics[0] === COUPON_LISTED_SIGNATURE
        ) {
          const id = BigInt(log.topics[1]).toString();
          console.log(
            `[Blockchain] Found CouponListed event via direct topic extraction. ListingId: ${id}`,
          );
          return id;
        }
      }
    } catch (error) {
      console.error(
        `[Blockchain] Error extracting listingId from topics: ${error.message}`,
      );
    }
    return null;
  }

  /** Method 2: Parse using contract interface (ethers v6) */
  private extractListingIdFromParsedLogs(
    receipt: any,
    marketplaceContract: any,
  ): string | null {
    try {
      for (const log of receipt.logs) {
        try {
          const parsedLog = marketplaceContract.interface.parseLog({
            topics: log.topics,
            data: log.data,
          });
          if (parsedLog?.name === 'CouponListed') {
            const id = parsedLog.args.listingId?.toString();
            console.log(
              `[Blockchain] Found CouponListed event via parseLog. ListingId: ${id}`,
            );
            return id;
          }
        } catch {
          // Skip logs that don't match this event
        }
      }
    } catch (error) {
      console.error(
        `[Blockchain] Error parsing logs with interface: ${error.message}`,
      );
    }
    return null;
  }

  /** Method 3: Fallback - get latest listing ID from active listings */
  private async extractListingIdFromActiveListings(
    marketplaceContract: any,
  ): Promise<string | null> {
    console.log(
      '[Blockchain] Event parsing failed. Fetching latest listing ID from getActiveListings()...',
    );
    try {
      const activeListings = await marketplaceContract.getActiveListings();
      if (activeListings.length > 0) {
        const id = activeListings[activeListings.length - 1].toString();
        console.log(
          `[Blockchain] Retrieved latest listing ID from getActiveListings: ${id}`,
        );
        return id;
      }
    } catch (error) {
      console.error(
        `[Blockchain] Failed to get active listings: ${error.message}`,
      );
    }
    return null;
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
    buyerPrivateKey: string,
    treasuryAddress?: string,
  ): Promise<{ hash: string; blockNumber: number }> {
    try {
      console.log('[Blockchain] Buying coupon from marketplace...');
      console.log('[Blockchain] - Listing ID:', listingId);
      console.log('[Blockchain] - Amount:', amount);
      console.log('[Blockchain] - Treasury:', treasuryAddress || 'N/A');

      if (!this.marketplaceAddress) {
        throw new Error('MARKETPLACE_ADDRESS not configured');
      }
      if (!this.vaultAddress) {
        throw new Error('VAULT_ADDRESS not configured');
      }

      const signer = new Wallet(buyerPrivateKey, this.provider);
      const buyerAddress = signer.address;

      // 1. Get listing details
      const marketplaceContract = new Contract(
        this.marketplaceAddress,
        MarketplaceArtifact.abi,
        signer,
      );

      console.log('[Blockchain] Fetching listing details...');
      const listing = await marketplaceContract.getListing(listingId);

      if (!listing.active) {
        throw new Error('Listing is not active');
      }

      // Check listing quantity
      console.log('[Blockchain] Listing details:');
      console.log('[Blockchain] - Type ID:', listing.typeId.toString());
      console.log('[Blockchain] - Seller:', listing.seller);
      console.log(
        '[Blockchain] - Price per unit:',
        ethers.formatEther(listing.pricePerUnit),
      );
      console.log(
        '[Blockchain] - Amount available:',
        listing.amount.toString(),
      );
      console.log('[Blockchain] - Amount requesting:', amount);
      console.log('[Blockchain] - Active:', listing.active);

      if (Number(listing.amount) < amount) {
        throw new Error(
          `Insufficient listing quantity. Available: ${listing.amount.toString()}, Requested: ${amount}`,
        );
      }

      const totalPrice = listing.pricePerUnit * BigInt(amount);
      const paymentTokenAddress = listing.paymentToken;

      console.log(
        '[Blockchain] Total price:',
        ethers.formatEther(totalPrice),
        'tokens',
      );
      console.log('[Blockchain] Payment token:', paymentTokenAddress);

      // 2. Check payment token balance (dynamic: THB or Point)
      const paymentTokenContract = new Contract(
        paymentTokenAddress,
        THBArtifact.abi, // Generic ERC-20 ABI works for both THB and Point tokens
        signer,
      );

      const balance = await paymentTokenContract.balanceOf(signer.address);

      if (balance < totalPrice) {
        throw new Error(
          `Insufficient payment token balance. Required: ${ethers.formatEther(totalPrice)}, Available: ${ethers.formatEther(balance)}`,
        );
      }

      console.log('[Blockchain] Balance check passed');

      // 2.5. Check buyer whitelist status
      console.log('[Blockchain] Checking buyer whitelist status...');
      const isWhitelisted = await marketplaceContract.whitelist(buyerAddress);
      console.log('[Blockchain] - Buyer whitelisted:', isWhitelisted);

      if (!isWhitelisted) {
        throw new Error(
          `Buyer ${buyerAddress} is not whitelisted on marketplace`,
        );
      }

      // 2.6. Check listing seller
      console.log('[Blockchain] Checking listing seller...');
      console.log('[Blockchain] - Listing seller:', listing.seller);
      console.log('[Blockchain] - Buyer address:', buyerAddress);

      if (listing.seller.toLowerCase() === buyerAddress.toLowerCase()) {
        throw new Error('Buyer cannot purchase their own listing');
      }

      // 2.7. Check marketplace's NFT balance (NFTs are held in escrow by marketplace)
      console.log('[Blockchain] Checking marketplace NFT balance...');
      const couponContract = new Contract(
        this.couponAddress,
        CouponArtifact.abi,
        this.provider,
      );

      const marketplaceBalance = await couponContract.balanceOf(
        this.marketplaceAddress,
        listing.typeId,
      );
      console.log(
        '[Blockchain] - Marketplace NFT balance:',
        marketplaceBalance.toString(),
      );
      console.log('[Blockchain] - Amount requesting:', amount);

      if (marketplaceBalance < amount) {
        throw new Error(
          `Marketplace has insufficient NFT balance. Required: ${amount}, Available: ${marketplaceBalance.toString()}`,
        );
      }

      // 3. Approve payment token spending
      // THB: approve vault (escrow), Point: approve marketplace (direct payment)
      const isTHBPayment =
        paymentTokenAddress.toLowerCase() === this.thbAddress.toLowerCase();
      const approveTarget = isTHBPayment
        ? this.vaultAddress
        : this.marketplaceAddress;
      const approveTargetName = isTHBPayment ? 'vault' : 'marketplace';

      console.log(
        `[Blockchain] Approving payment token for ${approveTargetName}...`,
      );
      console.log('[Blockchain] - Payment token:', paymentTokenAddress);
      console.log('[Blockchain] - Approve target:', approveTarget);
      console.log('[Blockchain] - Amount to approve:', totalPrice.toString());

      const approveTx = await paymentTokenContract.approve(
        approveTarget,
        totalPrice,
        {
          gasLimit: 15000000,
        },
      );
      const approveReceipt = await approveTx.wait();
      console.log('[Blockchain] - Approve tx:', approveReceipt.hash);

      // 3.5. Verify allowance
      console.log('[Blockchain] Verifying allowance...');
      const allowance = await paymentTokenContract.allowance(
        buyerAddress,
        approveTarget,
      );
      console.log('[Blockchain] - Current allowance:', allowance.toString());
      console.log('[Blockchain] - Required amount:', totalPrice.toString());

      if (allowance < totalPrice) {
        throw new Error(
          `Insufficient allowance for ${approveTargetName}. Required: ${totalPrice.toString()}, Got: ${allowance.toString()}`,
        );
      }

      // 4. Buy coupon
      console.log('[Blockchain] Executing buy transaction...');
      console.log(
        '[Blockchain] - Marketplace contract:',
        this.marketplaceAddress,
      );
      console.log('[Blockchain] - Listing ID:', listingId);
      console.log('[Blockchain] - Amount:', amount);
      console.log('[Blockchain] - Buyer:', buyerAddress);

      const tx = await marketplaceContract.buyCoupon(listingId, amount, {
        gasLimit: 15000000,
      });

      const receipt = await tx.wait();

      console.log('[Blockchain] Coupon purchased successfully');
      console.log('[Blockchain] - Tx Hash:', receipt.hash);
      console.log('[Blockchain] - Block:', receipt.blockNumber);

      // Invalidate listings cache after purchase
      this.invalidateListingsCache();

      return {
        hash: receipt.hash,
        blockNumber: receipt.blockNumber,
      };
    } catch (error) {
      console.error(`[Blockchain] Failed to buy coupon: ${error.message}`);
      throw new InternalServerErrorException(
        `Failed to buy coupon: ${error.message}`,
      );
    }
  }

  /**
   * เพิ่ม address เข้า marketplace whitelist
   * @param address - Address ที่ต้องการ whitelist
   * @returns Transaction receipt
   */
  async addToMarketplaceWhitelist(
    address: string,
  ): Promise<{ hash: string; blockNumber: number }> {
    try {
      console.log(`[Blockchain] Adding ${address} to marketplace whitelist...`);

      if (!this.marketplaceAddress) {
        throw new Error('MARKETPLACE_ADDRESS not configured');
      }

      const signer = new Wallet(this.privateKey, this.provider);
      const marketplaceContract = new Contract(
        this.marketplaceAddress,
        MarketplaceArtifact.abi,
        signer,
      );

      const tx = await marketplaceContract.addToWhitelist(address, {
        gasLimit: 15000000,
      });
      const receipt = await tx.wait();

      console.log(
        `[Blockchain] Address ${address} whitelisted. Tx: ${receipt.hash}`,
      );

      return {
        hash: receipt.hash,
        blockNumber: receipt.blockNumber,
      };
    } catch (error) {
      console.error(
        `[Blockchain] Failed to whitelist address: ${error.message}`,
      );
      throw new InternalServerErrorException(
        `Failed to whitelist address: ${error.message}`,
      );
    }
  }

  /**
   * ตรวจสอบว่า address ถูก whitelist หรือยัง
   * @param address - Address ที่ต้องการตรวจสอบ
   * @returns Boolean บอกสถานะ whitelist
   */
  async isWhitelisted(address: string): Promise<boolean> {
    try {
      console.log(`[Blockchain] Checking whitelist status for ${address}...`);

      if (!this.marketplaceAddress) {
        throw new Error('MARKETPLACE_ADDRESS not configured');
      }

      const marketplaceContract = new Contract(
        this.marketplaceAddress,
        MarketplaceArtifact.abi,
        this.provider,
      );

      const isWhitelisted = await marketplaceContract.whitelist(address);

      console.log(
        `[Blockchain] Address ${address} whitelist status: ${isWhitelisted}`,
      );

      return isWhitelisted;
    } catch (error) {
      console.error(
        `[Blockchain] Failed to check whitelist status: ${error.message}`,
      );
      throw new InternalServerErrorException(
        `Failed to check whitelist status: ${error.message}`,
      );
    }
  }

  /**
   * เพิ่มหลาย addresses เข้า whitelist พร้อมกัน
   * @param addresses - Array ของ addresses ที่ต้องการ whitelist
   * @returns Transaction receipt
   */
  async batchAddToMarketplaceWhitelist(
    addresses: string[],
  ): Promise<{ hash: string; blockNumber: number }> {
    try {
      console.log(
        `[Blockchain] Batch adding ${addresses.length} addresses to marketplace whitelist...`,
      );

      if (!this.marketplaceAddress) {
        throw new Error('MARKETPLACE_ADDRESS not configured');
      }

      const signer = new Wallet(this.privateKey, this.provider);
      const marketplaceContract = new Contract(
        this.marketplaceAddress,
        MarketplaceArtifact.abi,
        signer,
      );

      const tx = await marketplaceContract.batchAddToWhitelist(addresses, {
        gasLimit: 15000000,
      });
      const receipt = await tx.wait();

      console.log(
        `[Blockchain] Batch whitelisted ${addresses.length} addresses. Tx: ${receipt.hash}`,
      );

      return {
        hash: receipt.hash,
        blockNumber: receipt.blockNumber,
      };
    } catch (error) {
      console.error(
        `[Blockchain] Failed to batch whitelist addresses: ${error.message}`,
      );
      throw new InternalServerErrorException(
        `Failed to batch whitelist addresses: ${error.message}`,
      );
    }
  }
}
