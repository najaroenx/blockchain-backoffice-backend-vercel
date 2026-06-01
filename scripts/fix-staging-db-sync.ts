import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

const fixData = [
  { phone: '0811743336', tokenId: '30', txHash: '870a06e4e97bd70adb32ced7d4d7cf8132b0ae9ab23ee7313b054f8d70c6548e' },
  { phone: '0852382761', tokenId: '30', txHash: 'b4e982e98c4d07cc434b706dfe91afd6c343bc12b4a6eaf17d2e21870c4bcec8' },
  { phone: '0933260703', tokenId: '30', txHash: 'dc77ad78aaac04d14d81a0680ebc94702d7f21d85f392f3fcd481a3981802112' },
  { phone: '0971944518', tokenId: '30', txHash: 'ee62e0a2ac0159081947b51b1f360f415a07acfe2da8ecb6fee03e28cfd1841e' },
  { phone: '0863669959', tokenId: '32', txHash: 'a533e87b5717250a1136d0566435308ac409e51cb4cf7ce1b04d171b8e59e1a5' },
  { phone: '0895004537', tokenId: '32', txHash: 'a5c0c5aeb2578eb825bc9753f4fe47e7857befe5b15b72e8e960751a2540480d' },
  { phone: '0899236096', tokenId: '32', txHash: '6fe72a4d6d2c0effa7c678cc75cc5edbe3e083b9e2a396bdda1fc2884df1208f' }
];

// Recreate enums that might be in project constants
const TransactionTypeId_TRANSFER = 'cmldnt29x000j2r01pwwff578'; // Typical TRANSFER type id, but we'll query it if possible or use pure string if it fails.
// Wait, to be perfectly safe, let's just query the TransactionType by name 'TRANSFER' if exists.

async function main() {
  console.log('--- STARTING STAGING DB SYNC ---');
  const merchantId = 'cmmxc3v760003ze01xotjyeot';
  
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    include: { wallet: true }
  });

  if (!merchant || !merchant.wallet) {
    console.error('Merchant or wallet not found!'); return;
  }

  // Find the exact TransactionTypeId for 'TRANSFER' just to be 100% safe
  const txType = await prisma.transactionType.findFirst({ where: { name: 'TRANSFER' } });
  const txTypeId = txType ? txType.id : 'cmldnt29x000j2r01pwwff578';

  const senderAddressBuffer = Buffer.from(merchant.wallet.walletAddress.replace(/^0x/, ''), 'hex');

  for (const data of fixData) {
    console.log(`\nProcessing Customer: ${data.phone} for Token: ${data.tokenId}`);
    
    const customer = await prisma.customer.findUnique({
      where: { tel: data.phone },
      include: { wallet: true }
    });

    if (!customer || !customer.wallet) {
      console.log(`❌ Customer or wallet not found for phone ${data.phone}`);
      continue;
    }

    const receiverAddressBuffer = Buffer.from(customer.wallet.walletAddress.replace(/^0x/, ''), 'hex');
    const txHashBuffer = Buffer.from(data.txHash.replace(/^0x/, ''), 'hex');

    const existingTx = await prisma.transaction.findFirst({
        where: {
            receiverId: customer.id,
            txHash: txHashBuffer
        }
    });

    if (existingTx) {
        console.log(`✅ Customer ${data.phone} already has transaction synced.`);
        continue;
    }

    const voucherCode = await prisma.voucherCode.findFirst({
        where: {
            currentOwnerId: merchant.id,
            currentOwnerType: 'MERCHANT',
            isUsed: false,
            voucher: { tokenId: data.tokenId }
        }
    });

    if (!voucherCode) {
        console.log(`❌ No available voucher code found for Token ID ${data.tokenId} owned by merchant.`);
        continue;
    }

    await prisma.$transaction(async (tx) => {
        await tx.voucherCode.update({
            where: { id: voucherCode.id },
            data: {
                currentOwnerId: customer.id,
                currentOwnerType: 'CUSTOMER',
                voucherGroupId: null
            }
        });

        await tx.transaction.create({
            data: {
                txHash: txHashBuffer,
                amount: 1,
                senderAddress: senderAddressBuffer,
                receiverAddress: receiverAddressBuffer,
                merchantId: merchant.id,
                voucherCodeId: voucherCode.id,
                senderId: merchant.id,
                receiverId: customer.id,
                senderType: 'MERCHANT',
                receiverType: 'CUSTOMER',
                transactionTypeId: txTypeId,
                type: 'VOUCHER',
                transactionRefId: randomUUID(),
            }
        });
    });

    console.log(`✅ Synced! Assigned VoucherCode[${voucherCode.code}] to Customer ${data.phone}`);
  }

  await prisma.$disconnect();
  console.log('\n--- FINISHED ---');
}

main().catch(console.error);
