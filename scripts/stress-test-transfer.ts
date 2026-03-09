/**
 * Stress test: transfer points using 50 random wallets, 10 concurrent calls each.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/stress-test-transfer.ts
 *
 * Env vars (reads from dev.env):
 *   PRIVATE_KEY   – admin key that funds + mints
 *   RPC_URL       – JSON-RPC endpoint
 *   POINT_FACTORY_ADDRESS (not used directly, but kept for reference)
 *
 * Requires a deployed point token – set POINT_ADDRESS below or via env.
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: 'dev.env' });

import { JsonRpcProvider, Wallet, Contract, ethers } from 'ethers';
import * as PointTokenArtifact from '../src/providers/blockchain/abis/NewPointToken.json';

// ─── Config ────────────────────────────────────────────────────────────────
const RPC_URL = process.env.RPC_URL;
const ADMIN_PRIVATE_KEY = process.env.PRIVATE_KEY;
// Set the point token address you want to test with
const POINT_ADDRESS = process.env.POINT_ADDRESS || process.env.THB_ADDRESS;

const WALLET_COUNT = 200;
const CALLS_PER_WALLET = 10;
const TRANSFER_AMOUNT = '0.001'; // small amount per transfer

if (!RPC_URL || !ADMIN_PRIVATE_KEY || !POINT_ADDRESS) {
  console.error(
    'Missing env: RPC_URL, PRIVATE_KEY, and POINT_ADDRESS (or THB_ADDRESS) are required.',
  );
  process.exit(1);
}

// ─── Nonce manager (same logic as the service fix) ─────────────────────────
const nonceMap = new Map<string, number>();
const nonceMutex = new Map<string, Promise<void>>();

async function acquireLock(address: string): Promise<() => void> {
  const key = address.toLowerCase();
  while (nonceMutex.has(key)) {
    await nonceMutex.get(key);
  }
  let release: () => void;
  const p = new Promise<void>((r) => (release = r));
  nonceMutex.set(key, p);
  return () => {
    nonceMutex.delete(key);
    release();
  };
}

async function getNextNonce(
  provider: JsonRpcProvider,
  address: string,
): Promise<number> {
  const key = address.toLowerCase();
  const cached = nonceMap.get(key);
  if (cached !== undefined) {
    const next = cached + 1;
    nonceMap.set(key, next);
    return next;
  }
  const n = await provider.getTransactionCount(address, 'pending');
  nonceMap.set(key, n);
  return n;
}

function resetNonce(address: string) {
  nonceMap.delete(address.toLowerCase());
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  const provider = new JsonRpcProvider(RPC_URL);
  const admin = new Wallet(ADMIN_PRIVATE_KEY, provider);

  console.log(`Admin address : ${admin.address}`);
  console.log(`RPC           : ${RPC_URL}`);
  console.log(`Point token   : ${POINT_ADDRESS}`);
  console.log(`Wallets       : ${WALLET_COUNT}`);
  console.log(`Calls/wallet  : ${CALLS_PER_WALLET}`);
  console.log(`Total txs     : ${WALLET_COUNT * CALLS_PER_WALLET}`);
  console.log('');

  // 1. Generate 50 random wallets
  console.log('=== Generating wallets ===');
  const wallets: Array<Wallet | ReturnType<typeof Wallet.createRandom>> = [];
  for (let i = 0; i < WALLET_COUNT; i++) {
    const w = Wallet.createRandom().connect(provider);
    wallets.push(w);
  }
  console.log(`Created ${wallets.length} wallets`);

  // 2. Fund each wallet with native gas from admin
  console.log('\n=== Funding wallets with gas ===');
  const gasAmount = ethers.parseEther('0.01'); // enough for 10 transfers
  for (let i = 0; i < wallets.length; i++) {
    const release = await acquireLock(admin.address);
    try {
      const nonce = await getNextNonce(provider, admin.address);
      const tx = await admin.sendTransaction({
        to: wallets[i].address,
        value: gasAmount,
        nonce,
      });
      if (i % 10 === 0) {
        // Wait every 10th to avoid mempool flooding, let others fly
        await tx.wait();
        console.log(`  Funded ${i + 1}/${wallets.length} (confirmed)`);
      } else {
        console.log(`  Sent gas to wallet ${i + 1}/${wallets.length}`);
      }
    } catch (err: any) {
      console.error(`  Failed to fund wallet ${i}: ${err.message}`);
      resetNonce(admin.address);
    } finally {
      release();
    }
  }
  // Wait for the last batch
  console.log('  Waiting for funding txs to confirm...');
  await sleep(5000);

  // 3. Mint point tokens to each wallet
  console.log('\n=== Minting point tokens to wallets ===');
  const mintAmount = ethers.parseEther('1'); // 1 token, enough for 10 x 0.001
  const adminContract = new Contract(
    POINT_ADDRESS,
    PointTokenArtifact.abi,
    admin,
  );

  for (let i = 0; i < wallets.length; i++) {
    const release = await acquireLock(admin.address);
    try {
      const nonce = await getNextNonce(provider, admin.address);
      const tx = await adminContract['mint'](wallets[i].address, mintAmount, {
        nonce,
        gasLimit: 500_000,
      });
      if (i % 10 === 0) {
        await tx.wait();
        console.log(`  Minted to ${i + 1}/${wallets.length} (confirmed)`);
      } else {
        console.log(`  Mint tx sent for wallet ${i + 1}/${wallets.length}`);
      }
    } catch (err: any) {
      console.error(`  Failed to mint to wallet ${i}: ${err.message}`);
      resetNonce(admin.address);
    } finally {
      release();
    }
  }
  console.log('  Waiting for mint txs to confirm...');
  await sleep(5000);

  // 4. Stress test: 50 wallets x 10 concurrent transfers each
  console.log('\n=== Starting stress test ===');
  console.log(
    `Each wallet sends ${CALLS_PER_WALLET} transfers of ${TRANSFER_AMOUNT} simultaneously`,
  );

  const amountWei = ethers.parseEther(TRANSFER_AMOUNT);
  // Pick a single recipient for simplicity (admin address)
  const recipient = admin.address;

  const stats = { success: 0, fail: 0, knownTx: 0 };
  const startTime = Date.now();

  // Launch all 50 wallets in parallel; each wallet does 10 concurrent calls
  const walletPromises = wallets.map(async (wallet, walletIdx) => {
    const contract = new Contract(
      POINT_ADDRESS,
      PointTokenArtifact.abi,
      wallet,
    );
    const cw = contract.connect(wallet) as any;

    const callPromises = Array.from(
      { length: CALLS_PER_WALLET },
      async (_, callIdx) => {
        const label = `W${walletIdx}-C${callIdx}`;
        const release = await acquireLock(wallet.address);
        try {
          const nonce = await getNextNonce(provider, wallet.address);
          const tx = await cw['transfer'](recipient, amountWei, {
            nonce,
            gasLimit: 200_000,
          });
          await tx.wait();
          stats.success++;
          console.log(`  [${label}] OK tx=${tx.hash.slice(0, 16)}...`);
        } catch (err: any) {
          const msg = err?.message?.toLowerCase?.() ?? '';
          if (
            msg.includes('known transaction') ||
            msg.includes('nonce too low')
          ) {
            stats.knownTx++;
            console.error(`  [${label}] KNOWN TX / NONCE CONFLICT`);
          } else {
            stats.fail++;
            console.error(`  [${label}] FAIL: ${err.message?.slice(0, 80)}`);
          }
          resetNonce(wallet.address);
        } finally {
          release();
        }
      },
    );

    await Promise.all(callPromises);
  });

  await Promise.all(walletPromises);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n=== Results ===');
  console.log(`Total calls   : ${WALLET_COUNT * CALLS_PER_WALLET}`);
  console.log(`Success       : ${stats.success}`);
  console.log(`Known tx errs : ${stats.knownTx}`);
  console.log(`Other fails   : ${stats.fail}`);
  console.log(`Time          : ${elapsed}s`);
  console.log(
    `Nonce fix OK  : ${stats.knownTx === 0 ? 'YES ✓' : 'NO ✗ — nonce conflicts detected'}`,
  );
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
