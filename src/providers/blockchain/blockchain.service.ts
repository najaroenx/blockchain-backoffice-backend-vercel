/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { createPoint } from './types';
import * as PointFactoryArtifact from './abis/NewPointTokenFactory.json';
import * as PointTokenArtifact from './abis/NewPointToken.json';
import * as MarketplaceArtifact from './abis/Marketplace.json';
import * as THBArtifact from './abis/THB.json';
import * as CouponArtifact from './abis/Coupon.json';

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

  constructor(private configService: ConfigService) {
    this.pointFactoryAddress = this.configService.get<string>(
      'POINT_FACTORY_ADDRESS',
    );
    this.privateKey = this.configService.get<string>('PRIVATE_KEY');
    this.provider = new JsonRpcProvider(
      this.configService.get<string>('RPC_URL'),
    );
    this.marketplaceAddress = this.configService.get<string>(
      'Marketplace_ADDRESS',
    );
    this.thbAddress = this.configService.get<string>('THB_ADDRESS');
    this.couponAddress = this.configService.get<string>('Coupon_ADDRESS');
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
    let finalExpiryTimestamp: number;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const effectiveStartDate = startDate || currentTimestamp;

    if (endDate) {
      // กรณีที่ 1: กำหนดวันเอง
      finalExpiryTimestamp = endDate;

      // Validate: endDate ต้องมากกว่า startDate
      if (startDate && endDate <= startDate) {
        throw new Error('endDate must be greater than startDate');
      }

      // Validate: endDate ต้องอยู่ในอนาคต
      if (endDate <= currentTimestamp) {
        throw new Error('endDate must be in the future');
      }

      console.log('[BlockchainService] Using custom date range');
      if (startDate) {
        console.log('[BlockchainService] Start date:', startDate);
      }
      console.log('[BlockchainService] End date:', endDate);
    } else if (expiryMonths) {
      // กรณีที่ 2: เลือกระยะเวลา
      const validMonths = [3, 6, 9, 12, 24];
      if (!validMonths.includes(expiryMonths)) {
        throw new Error(
          `Invalid expiryMonths. Must be one of: ${validMonths.join(', ')}`,
        );
      }

      // คำนวณ timestamp จากจำนวนเดือน (1 เดือน = ~30.44 วัน)
      const secondsPerMonth = 30.44 * 24 * 60 * 60; // ~2,629,743 seconds
      finalExpiryTimestamp =
        effectiveStartDate + Math.floor(expiryMonths * secondsPerMonth);

      console.log('[BlockchainService] Using predefined duration');
      console.log('[BlockchainService] Expiry months:', expiryMonths, 'months');
      if (startDate) {
        console.log('[BlockchainService] Start date:', startDate);
      }
      console.log(
        '[BlockchainService] Calculated end date:',
        finalExpiryTimestamp,
      );
    } else {
      // กรณีที่ 3: ไม่มีทั้งสอง
      throw new Error('Either endDate or expiryMonths must be provided');
    }

    // คำนวณ epochDuration ที่เหมาะสมตามระยะเวลา
    const remainingTime = finalExpiryTimestamp - currentTimestamp;
    const daysRemaining = remainingTime / 86400;

    let epochDuration: number;
    if (daysRemaining <= 1) {
      // <= 1 วัน: ใช้ 1 ชั่วโมง (3600 seconds)
      epochDuration = 3600;
    } else if (daysRemaining <= 7) {
      // 1-7 วัน: ใช้ 12 ชั่วโมง (43200 seconds)
      epochDuration = 43200;
    } else if (daysRemaining <= 30) {
      // 7-30 วัน: ใช้ 1 วัน (86400 seconds)
      epochDuration = 86400;
    } else if (daysRemaining <= 90) {
      // 1-3 เดือน: ใช้ 3 วัน (259200 seconds)
      epochDuration = 259200;
    } else {
      // > 3 เดือน: ใช้ 7 วัน (604800 seconds)
      epochDuration = 604800;
    }

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
  }): Promise<string> {
    try {
      const contract = new Contract(
        pointAddress,
        PointTokenArtifact.abi,
        this.provider,
      );
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
        throw new Error('Coupon_ADDRESS not configured');
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
  async redeemVoucher(typeId: string, amount: number, ownerAddress: string) {
    try {
      console.log(
        `[Blockchain] Redeeming coupon typeId: ${typeId}, amount: ${amount}, owner: ${ownerAddress}`,
      );

      if (!this.couponAddress) {
        throw new Error('Coupon_ADDRESS not configured');
      }

      const signer = new Wallet(this.privateKey, this.provider);
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
        throw new Error('Coupon_ADDRESS not configured');
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
        throw new Error('Coupon_ADDRESS not configured');
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
        throw new Error('Coupon_ADDRESS not configured');
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
   * Get all active marketplace listings
   * @returns Array of active listings
   */
  async getAllActiveMarketplaceListings() {
    try {
      console.log('[Blockchain] Fetching all active listings...');

      const marketplaceContract = new Contract(
        this.marketplaceAddress,
        MarketplaceArtifact.abi,
        this.provider,
      );

      const listingIds = await marketplaceContract.getActiveListings();

      const listings = await Promise.all(
        listingIds.map(async (id: bigint) => {
          const listing = await marketplaceContract.getListing(id);
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
        }),
      );

      console.log('[Blockchain] Found', listings.length, 'active listings');

      return listings;
    } catch (error) {
      console.error(`[Blockchain] Failed to get listings: ${error.message}`);
      throw new InternalServerErrorException(
        `Failed to get listings: ${error.message}`,
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
    pricePerUnitTHB: string,
    sellerPrivateKey?: string,
  ): Promise<{ listingId: string; hash: string; blockNumber: number }> {
    try {
      console.log('[Blockchain] Listing coupon on marketplace...');
      console.log('[Blockchain] - TypeId:', typeId);
      console.log('[Blockchain] - Amount:', amount);
      console.log('[Blockchain] - Price per unit:', pricePerUnitTHB, 'THB');

      const signer = sellerPrivateKey
        ? new Wallet(sellerPrivateKey, this.provider)
        : new Wallet(this.privateKey, this.provider);

      // 1. Approve marketplace to transfer coupons
      const couponContract = new Contract(
        this.couponAddress,
        CouponArtifact.abi,
        signer,
      );

      console.log('[Blockchain] Approving marketplace for coupon transfer...');
      const approveTx = await couponContract.setApprovalForAll(
        this.marketplaceAddress,
        true,
        { gasLimit: 15000000 },
      );
      await approveTx.wait();

      // 2. Create listing on marketplace
      const marketplaceContract = new Contract(
        this.marketplaceAddress,
        MarketplaceArtifact.abi,
        signer,
      );

      const pricePerUnit = ethers.parseEther(pricePerUnitTHB);

      console.log('[Blockchain] Creating listing on marketplace...');
      const tx = await marketplaceContract.listCoupon(
        typeId,
        amount,
        pricePerUnit,
        this.thbAddress,
        { gasLimit: 15000000 },
      );

      const receipt = await tx.wait();

      // Parse ListingCreated event
      const event = receipt.logs.find(
        (log: any) => log.fragment?.name === 'ListingCreated',
      );

      const listingId = event?.args[0]?.toString() || '0';

      console.log('[Blockchain] Listing created successfully');
      console.log('[Blockchain] - Listing ID:', listingId);
      console.log('[Blockchain] - Tx Hash:', receipt.hash);

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

      const signer = new Wallet(buyerPrivateKey, this.provider);

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

      const totalPrice = listing.pricePerUnit * BigInt(amount);

      console.log(
        '[Blockchain] Total price:',
        ethers.formatEther(totalPrice),
        'THB',
      );

      // 2. Check THB balance
      const thbContract = new Contract(
        this.thbAddress,
        THBArtifact.abi,
        signer,
      );

      const balance = await thbContract.balanceOf(signer.address);

      if (balance < totalPrice) {
        throw new Error(
          `Insufficient THB balance. Required: ${ethers.formatEther(totalPrice)}, Available: ${ethers.formatEther(balance)}`,
        );
      }

      console.log('[Blockchain] Balance check passed');

      // 3. Approve THB spending
      console.log('[Blockchain] Approving THB for marketplace...');
      const approveTx = await thbContract.approve(
        this.marketplaceAddress,
        totalPrice,
        { gasLimit: 15000000 },
      );
      await approveTx.wait();

      // 4. Buy coupon
      console.log('[Blockchain] Executing buy transaction...');
      const tx = await marketplaceContract.buyCoupon(listingId, amount, {
        gasLimit: 15000000,
      });

      const receipt = await tx.wait();

      console.log('[Blockchain] Coupon purchased successfully');
      console.log('[Blockchain] - Tx Hash:', receipt.hash);
      console.log('[Blockchain] - Block:', receipt.blockNumber);

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
}
