import { PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';
require('dotenv').config({ path: 'dev.env' });

const prisma = new PrismaClient();

// Admin callable burn + mint (requires PRIVATE_KEY to be the contract owner/admin)
const COUPON_ABI = [
  'function burn(address from, uint256 typeId, uint256 amount) external',
  'function mint(address to, uint256 typeId, uint256 amount) external',
  'function balanceOf(address account, uint256 id) view returns (uint256)',
];

const fixDataConfig = [
  { phone: '0852382761', wrongTokenId: 30 },
  { phone: '0971944518', wrongTokenId: 30 },
  { phone: '0933260703', wrongTokenId: 30 },
  { phone: '0899236096', wrongTokenId: 32 },
  { phone: '0863669959', wrongTokenId: 32 },
  { phone: '0895004537', wrongTokenId: 32 },
];

const MARKETER_WALLET = '0x86a1f2cdaa641f5c74ab0dfffd8e0daf504dce3e';

async function main() {
  const rpcUrl = process.env.RPC_URL;
  const privateKey = process.env.PRIVATE_KEY;
  const contractAddress = process.env.COUPON_ADDRESS;

  if (!rpcUrl || !privateKey || !contractAddress) {
    console.error('❌ Missing env vars: RPC_URL, PRIVATE_KEY, COUPON_ADDRESS');
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  // Security: admin private key used only for authorized burn/mint operations on own contract
  const adminWallet = new ethers.Wallet(privateKey, provider);
  const contract = new ethers.Contract(contractAddress, COUPON_ABI, adminWallet);

  console.log(`\n=== 🔥 STARTING PHASE 0: BURN WRONG TOKENS ON-CHAIN ===`);
  console.log(`Admin address: ${adminWallet.address}`);
  console.log(`Contract: ${contractAddress}\n`);

  for (const item of fixDataConfig) {
    console.log(`\n▶ Processing Phone: ${item.phone} (Token ${item.wrongTokenId})`);

    const customer = await prisma.customer.findUnique({
      where: { tel: item.phone },
      include: { wallet: true },
    });

    if (!customer?.wallet?.walletAddress) {
      console.log(`  ❌ Skipped: customer หรือ wallet ไม่พบ`);
      continue;
    }

    const customerWallet = customer.wallet.walletAddress;

    // Check balance before
    const balanceBefore = await contract.balanceOf(customerWallet, item.wrongTokenId);
    console.log(`  Balance ก่อน: ${balanceBefore.toString()}`);

    if (Number(balanceBefore) === 0) {
      console.log(`  > ข้าม: ไม่มี token ${item.wrongTokenId} ใน wallet ลูกค้าแล้ว`);
      continue;
    }

    try {
      // Step 1: Burn wrong token from customer wallet
      console.log(`  🔥 Burning ${balanceBefore} token(s) from ${customerWallet}...`);
      const burnTx = await contract.burn(customerWallet, item.wrongTokenId, balanceBefore);
      console.log(`  Burn tx: ${burnTx.hash}`);
      await burnTx.wait();
      console.log(`  ✅ Burn confirmed`);

      // Step 2: Mint back to marketer wallet
      console.log(`  🪙 Minting ${balanceBefore} token(s) back to marketer ${MARKETER_WALLET}...`);
      const mintTx = await contract.mint(MARKETER_WALLET, item.wrongTokenId, balanceBefore);
      console.log(`  Mint tx: ${mintTx.hash}`);
      await mintTx.wait();
      console.log(`  ✅ Mint confirmed`);

      // Verify
      const balanceAfter = await contract.balanceOf(customerWallet, item.wrongTokenId);
      console.log(`  Balance หลัง: ${balanceAfter.toString()} ✓`);
    } catch (err: any) {
      console.error(`  ❌ Error: ${err.message}`);
    }
  }

  console.log(`\n=== 🎉 PHASE 0 DONE ===`);
  await prisma.$disconnect();
}

main();
