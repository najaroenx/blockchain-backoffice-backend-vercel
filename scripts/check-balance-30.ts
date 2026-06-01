import { ethers } from "ethers";

async function main() {
  const rpcUrl = "https://dlp-rpc2-testnet.adldigitalservice.com";
  const contractAddress = "0xe0238f20c8370ba2a8c6668eff35d603e3497e8c"; 
  const merchantWallet = "0x86a1f2cdaa641f5c74ab0dfffd8e0daf504dce3e";
  const tokenId = 30;

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const abi = ["function balanceOf(address account, uint256 id) view returns (uint256)"];
  const contract = new ethers.Contract(contractAddress, abi, provider);

  const balance = await contract.balanceOf(merchantWallet, tokenId);
  console.log(`On-Chain Balance: ${balance.toString()} tokens`);
}
main().catch(console.error);
