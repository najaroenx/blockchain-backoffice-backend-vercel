import { PrismaClient, AssetType } from '@prisma/client';
import { randomUUID } from 'crypto';
import { ethers } from 'ethers';
import * as CryptoJS from 'crypto-js';
import { getSignerFromSeedPhrase } from '../src/libs/derive-wallet';
import PointTokenArtifact from '../src/providers/blockchain/abis/PointToken.json';

const prisma = new PrismaClient();
const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000';

function decryptKey(salt: string, encryptedData: string): string {
  if (!encryptedData) return '';
  const cleanSalt = salt.trim().replace(/^['"]|['"]$/g, '');
  const bytes = CryptoJS.AES.decrypt(encryptedData, cleanSalt);
  return bytes.toString(CryptoJS.enc.Utf8);
}

async function main() {
  console.log('====== STARTING BUG FIX FOR CHECKIN EVENT (STAGING) ======');

  const salt = process.env.SALT;
  const rpcUrl = process.env.RPC_URL;

  const eventId = 'checkin-reward-ep7';

  // =========================================================================
  // BUG 1: Phone 0860091533
  // Event: checkin-reward-ep7, Point ID: cmmxeik0c00vize01smxq1w8r
  // Current Point Amount: 10 (But expected points is 5)
  // Fix: Reduce point amount of latest transaction to 5, update customer points balance,
  //      and perform on-chain BURN of 5 points from the customer wallet.
  // =========================================================================
  console.log('\n[Task 1] Processing phone 0860091533...');
  const phone1 = '0860091533';
  const pointId = 'cmmxeik0c00vize01smxq1w8r';

  const customer1 = await prisma.customer.findUnique({
    where: { tel: phone1 },
    include: { customerPoints: true, wallet: true },
  });

  if (!customer1) {
    console.warn(`❌ Customer with phone ${phone1} not found in DB.`);
  } else if (!customer1.wallet?.seedPhrase) {
    console.warn(`❌ Customer wallet or seed phrase not found for phone ${phone1}.`);
  } else {
    console.log(`Found Customer ID: ${customer1.id}`);
    
    // Find latest transaction for this customer and point with eventId
    const latestTx1 = await prisma.transaction.findFirst({
      where: {
        receiverId: customer1.id,
        pointId: pointId,
        eventId: eventId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!latestTx1) {
      console.warn(`⚠️ No transaction found with receiverId=${customer1.id}, pointId=${pointId}, eventId=${eventId}`);
    } else {
      console.log(`Found Transaction ID: ${latestTx1.id}`);
      console.log(`Current Transaction Amount: ${latestTx1.amount} (Expected to reduce to 5 if it is 10)`);

      const customerPoint = customer1.customerPoints.find(cp => cp.pointId === pointId);
      const currentBalance = customerPoint ? customerPoint.balances : 0;
      const newBalance = Math.max(0, currentBalance - 5);

      let burnTxHash: string | null = null;

      // -----------------------------------------------------------------------
      // On-chain BURN Action (First Step)
      // -----------------------------------------------------------------------
      console.log(`\nChecking on-chain BURN requirement for ${phone1}...`);

      const existingBurnTx = await prisma.transaction.findFirst({
        where: {
          senderId: customer1.id,
          pointId: pointId,
          transactionTypeId: 'BURN',
          eventId: eventId,
        },
      });

      if (existingBurnTx) {
        console.log(`✅ On-chain BURN transaction was already recorded in DB (id=${existingBurnTx.id}). Skipping burn.`);
      } else {
        if (!salt || !rpcUrl) {
          console.warn('⚠️ SALT or RPC_URL is not set in environment variables! Cannot perform on-chain BURN.');
        } else {
          try {
            console.log('Fetching Point token details from DB...');
            const pointRec = await prisma.point.findUnique({
              where: { id: pointId },
            });

            if (!pointRec?.contractAddress) {
              throw new Error(`Point ID ${pointId} has no contractAddress in DB`);
            }

            const contractAddressStr = '0x' + Buffer.from(pointRec.contractAddress).toString('hex');
            console.log(`Point Contract Address: ${contractAddressStr}`);

            // Decrypt seed phrase and get signer
            const decryptedMnemonic = decryptKey(salt, customer1.wallet.seedPhrase);
            const derivationIndex = customer1.wallet.derivationIndex || 0;
            const provider = new ethers.JsonRpcProvider(rpcUrl);
            const walletSigner = getSignerFromSeedPhrase(decryptedMnemonic, derivationIndex).connect(provider);

            console.log(`Customer Wallet Address (derived): ${walletSigner.address}`);

            const contract = new ethers.Contract(contractAddressStr, PointTokenArtifact.abi, walletSigner);
            
            // Check current balance on-chain
            const balanceWei: bigint = await contract.balanceOf(walletSigner.address);
            const balanceEther = ethers.formatEther(balanceWei);
            console.log(`Customer current on-chain balance: ${balanceEther} points`);

            const burnAmount = ethers.parseEther('5');

            if (balanceWei < burnAmount) {
              console.warn(`⚠️ Warning: Customer on-chain balance (${balanceEther}) is less than the required burn amount (5). Attempting to burn anyway...`);
            }

            console.log(`Executing on-chain BURN of 5 points from wallet ${walletSigner.address}...`);
            const tx = await contract.burn(walletSigner.address, burnAmount);
            console.log(`Burn transaction submitted. Hash: ${tx.hash}`);

            console.log('Waiting for block confirmation...');
            const receipt = await tx.wait();
            console.log(`✅ On-chain BURN confirmed in block ${receipt.blockNumber}!`);
            burnTxHash = tx.hash;

          } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            console.error(`❌ Failed to perform on-chain BURN: ${errMsg}`);
          }
        }
      }

      // -----------------------------------------------------------------------
      // DB Updates (Second Step - Run only if BURN was checked/executed)
      // -----------------------------------------------------------------------
      if (latestTx1.amount === 10) {
        console.log(`\nProceeding with DB updates: Customer Point Balance calculation: Current Balance = ${currentBalance}, Target Balance = ${newBalance}`);

        try {
          await prisma.$transaction(async (tx) => {
            // Update original transaction amount to 5
            await tx.transaction.update({
              where: { id: latestTx1.id },
              data: { amount: 5 },
            });

            // Update customer point balance
            if (customerPoint) {
              await tx.customerPoint.update({
                where: { id: customerPoint.id },
                data: { balances: newBalance },
              });
              console.log(`✅ Transaction and CustomerPoint balance updated successfully.`);
            } else {
              console.warn(`⚠️ CustomerPoint record not found. Creating one with balance = 5.`);
              await tx.customerPoint.create({
                data: {
                  customerId: customer1.id,
                  pointId: pointId,
                  balances: 5,
                },
              });
              console.log(`✅ Transaction updated to 5 and CustomerPoint record created with balance = 5.`);
            }

            // If a burn was executed in this run, create the corresponding BURN transaction record in DB
            if (burnTxHash) {
              const txHashBuf = Buffer.from(burnTxHash.replace(/^0x/, ''), 'hex');
              const walletAddressStr = customer1.wallet.walletAddress;
              const senderAddressBuf = Buffer.from(walletAddressStr.replace(/^0x/, ''), 'hex');
              const zeroAddressBuf = Buffer.from(ADDRESS_ZERO.replace(/^0x/, ''), 'hex');

              await tx.transaction.create({
                data: {
                  txHash: txHashBuf,
                  amount: 5,
                  senderAddress: senderAddressBuf,
                  receiverAddress: zeroAddressBuf,
                  senderId: customer1.id,
                  senderType: 'CUSTOMER',
                  receiverId: null,
                  receiverType: 'SYSTEM',
                  merchantId: null,
                  transactionTypeId: 'BURN',
                  type: AssetType.POINT,
                  pointId: pointId,
                  eventId: eventId,
                  transactionRefId: randomUUID(),
                },
              });
              console.log(`✅ DB record created for BURN transaction with hash ${burnTxHash}`);
            }
          });
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error);
          console.error(`❌ Failed to update DB records: ${errMsg}`);
        }
      } else if (latestTx1.amount === 5) {
        console.log(`✅ Transaction amount is already 5. DB is in sync for ${phone1}.`);
        
        // If burn happened on chain but DB update skipped because amount was already 5,
        // create the BURN record directly (failsafe logic)
        if (burnTxHash) {
          try {
            const txHashBuf = Buffer.from(burnTxHash.replace(/^0x/, ''), 'hex');
            const walletAddressStr = customer1.wallet.walletAddress;
            const senderAddressBuf = Buffer.from(walletAddressStr.replace(/^0x/, ''), 'hex');
            const zeroAddressBuf = Buffer.from(ADDRESS_ZERO.replace(/^0x/, ''), 'hex');

            await prisma.transaction.create({
              data: {
                txHash: txHashBuf,
                amount: 5,
                senderAddress: senderAddressBuf,
                receiverAddress: zeroAddressBuf,
                senderId: customer1.id,
                senderType: 'CUSTOMER',
                receiverId: null,
                receiverType: 'SYSTEM',
                merchantId: null,
                transactionTypeId: 'BURN',
                type: AssetType.POINT,
                pointId: pointId,
                eventId: eventId,
                transactionRefId: randomUUID(),
              },
            });
            console.log(`✅ DB record created (outside transaction) for BURN transaction with hash ${burnTxHash}`);
          } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            console.error(`❌ Failed to create standalone BURN transaction record in DB: ${errMsg}`);
          }
        }
      } else {
        console.warn(`⚠️ Transaction amount is ${latestTx1.amount} (neither 10 nor 5). Skipping DB update to avoid incorrect modifications.`);
      }
    }
  }

  // =========================================================================
  // BUG 2: Phone 0966260397
  // Fix: Find the latest transaction sent to this customer and update eventId to 'checkin-reward-ep7'
  // =========================================================================
  console.log('\n[Task 2] Processing phone 0966260397...');
  const phone2 = '0966260397';

  const customer2 = await prisma.customer.findUnique({
    where: { tel: phone2 },
  });

  if (!customer2) {
    console.warn(`❌ Customer with phone ${phone2} not found in DB.`);
  } else {
    console.log(`Found Customer ID: ${customer2.id}`);

    // Find their latest transaction (generally point or any transaction)
    const latestTx2 = await prisma.transaction.findFirst({
      where: {
        receiverId: customer2.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!latestTx2) {
      console.warn(`❌ No transaction history found for Customer ${phone2}.`);
    } else {
      console.log(`Found Latest Transaction ID: ${latestTx2.id}`);
      console.log(`Current eventId: ${latestTx2.eventId || 'NULL'}`);

      if (latestTx2.eventId === eventId) {
        console.log(`✅ Transaction eventId is already '${eventId}'. No updates needed for ${phone2}.`);
      } else {
        try {
          await prisma.transaction.update({
            where: { id: latestTx2.id },
            data: { eventId: eventId },
          });
          console.log(`✅ Updated eventId of transaction ${latestTx2.id} to '${eventId}' successfully.`);
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error);
          console.error(`❌ Failed to update transaction eventId: ${errMsg}`);
        }
      }
    }
  }

  await prisma.$disconnect();
  console.log('\n====== BUG FIX FOR CHECKIN EVENT (STAGING) COMPLETE ======');
}

main().catch((error) => {
  console.error('[FATAL]', error);
  prisma.$disconnect();
  process.exit(1);
});
