/**
 * @deprecated This script is no longer needed.
 * The system now uses HD wallet with seedPhrase instead of privateKey.
 * Seed phrases are encrypted at wallet creation time in createCustomer and createMerchant handlers.
 * 
 * This file is kept for historical reference only.
 */

console.log('⚠️  This script is deprecated. The system now uses HD wallet with seedPhrase.');
process.exit(0);

// All code below is kept for historical reference but will not execute
// The imports and code below have been disabled to prevent TypeScript compilation errors

/*
import { PrismaClient } from '@prisma/client';
import * as CryptoJS from 'crypto-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: './dev.env' });

const prisma = new PrismaClient();

function encryptKey(salt: string, privateKey: string): string {
  const encryptedPrivateKey = CryptoJS.AES.encrypt(privateKey, salt).toString();
  return encryptedPrivateKey;
}

function isEncrypted(privateKey: string): boolean {
  // Check if the private key is already encrypted (starts with U2FsdGVkX1)
  return privateKey.startsWith('U2FsdGVkX1');
}

async function encryptMerchantPrivateKeys() {
  try {
    const salt = process.env.SALT;

    if (!salt) {
      throw new Error('SALT environment variable is not defined');
    }

    console.log('🔍 Fetching all merchants with wallets...');

    // Fetch all merchants with their wallets
    const merchants = await prisma.merchant.findMany({
      include: {
        wallet: true,
      },
    });

    console.log(`📊 Found ${merchants.length} merchants`);

    let encryptedCount = 0;
    let alreadyEncryptedCount = 0;
    let noWalletCount = 0;

    for (const merchant of merchants) {
      if (!merchant.wallet) {
        console.log(
          `⚠️  Merchant ${merchant.id} (${merchant.name}) has no wallet`,
        );
        noWalletCount++;
        continue;
      }

      const { privateKey } = merchant.wallet;

      if (!privateKey) {
        console.log(
          `⚠️  Merchant ${merchant.id} (${merchant.name}) wallet has no private key`,
        );
        continue;
      }

      // Check if already encrypted
      if (isEncrypted(privateKey)) {
        console.log(
          `✅ Merchant ${merchant.id} (${merchant.name}) private key is already encrypted`,
        );
        alreadyEncryptedCount++;
        continue;
      }

      // Encrypt the private key
      console.log(
        `🔐 Encrypting private key for Merchant ${merchant.id} (${merchant.name})...`,
      );
      console.log(
        `   Original (first 20 chars): ${privateKey.substring(0, 20)}...`,
      );

      const encryptedPrivateKey = encryptKey(salt, privateKey);

      console.log(
        `   Encrypted (first 20 chars): ${encryptedPrivateKey.substring(0, 20)}...`,
      );

      // Update the wallet with encrypted private key
      await prisma.wallet.update({
        where: { id: merchant.wallet.id },
        data: { privateKey: encryptedPrivateKey },
      });

      console.log(`✅ Successfully encrypted and updated`);
      encryptedCount++;
    }

    console.log('\n📈 Summary:');
    console.log(`   Total merchants: ${merchants.length}`);
    console.log(`   Newly encrypted: ${encryptedCount}`);
    console.log(`   Already encrypted: ${alreadyEncryptedCount}`);
    console.log(`   No wallet: ${noWalletCount}`);
    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Error encrypting merchant private keys:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
encryptMerchantPrivateKeys()
  .then(() => {
    console.log('Script finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
*/
