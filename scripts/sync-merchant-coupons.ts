import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const configService = app.get(ConfigService);
  
  const rpcUrl = configService.get<string>('INFURA_AMOY_URL') || configService.get<string>('RPC_URL') || 'https://dlp-rpc2-testnet.adldigitalservice.com';
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  
  const adminPK = configService.get<string>('MARKETPLACE_PRIVATE_KEY') || configService.get<string>('ADMIN_PRIVATE_KEY');
  if (!adminPK) {
     console.error("No private key found in env to perform transfer.");
     process.exit(1);
  }
  const adminWallet = new ethers.Wallet(adminPK, provider);
  const adminAddress = adminWallet.address;
  console.log(`Admin/Marketplace Wallet: ${adminAddress}`);

  const contractAddress = configService.get<string>('COUPON_ADDRESS') || '0xe0238f20c8370ba2a8c6668eff35d603e3497e8c';
  const contractAbi = [
    'function balanceOf(address account, uint256 id) view returns (uint256)',
    'function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)'
  ];
  
  const contract = new ethers.Contract(contractAddress, contractAbi, adminWallet);

  const merchantWalletAddress = "0x86a1f2cdaa641f5c74ab0dfffd8e0daf504dce3e";
  const tokenId = 30;
  const missingAmount = 21;

  try {
     const currentBal = await contract.balanceOf(adminAddress, tokenId);
     console.log(`Current Balance of ID ${tokenId} in Admin: ${currentBal.toString()}`);
     
     if (currentBal >= missingAmount) {
         console.log(`Transferring ${missingAmount} tokens to Merchant (${merchantWalletAddress})...`);
         
         const tx = await contract.safeTransferFrom(
            adminAddress, 
            merchantWalletAddress, 
            tokenId, 
            missingAmount, 
            "0x"
         );
         
         console.log(`✅ Transaction sent! Hash: ${tx.hash}`);
         console.log("Waiting for confirmation...");
         
         const receipt = await tx.wait();
         console.log(`🎉 Transferred confirmed in block ${receipt.blockNumber}`);
         
         const newBal = await contract.balanceOf(merchantWalletAddress, tokenId);
         console.log(`Merchant new On-Chain balance: ${newBal.toString()} tokens`);
     } else {
         console.log(`Not enough tokens in Admin wallet to cover ${missingAmount}.`);
         const mpBal = await contract.balanceOf("0x0dd7fbcfdc56dc9bfe8d8820262497c0208734b3", tokenId);
         console.log(`Balance in Marketplace contract wallet (if different): ${mpBal.toString()}`);
     }
  } catch (err) {
     console.error("Error during transfer:", err.message);
  }

  await app.close();
}

main();
