import { PrismaClient } from '@prisma/client';
import {
  merchantSeeds,
  voucherSeeds,
  pointSeeds,
  apiKeySeeds,
  customerSeeds,
  transactionSeeds,
} from './data/backoffice.mock';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

const isHex = (value: string) => /^0x[0-9a-fA-F]+$/.test(value);

const bufferFromHex = (value: string) =>
  Buffer.from(value.startsWith('0x') ? value.slice(2) : value, 'hex');

const toBuffer = (value: string, length: number) => {
  if (isHex(value) && value.length % 2 === 0) {
    try {
      const buf = bufferFromHex(value);
      if (buf.length === length || length === 0) return buf;
      if (buf.length > length) return buf.subarray(buf.length - length);
      if (buf.length < length) {
        const padded = Buffer.alloc(length);
        buf.copy(padded, length - buf.length);
        return padded;
      }
    } catch {
      // fall through to hash-based derivation
    }
  }

  const hashed = createHash('sha256').update(value).digest();
  return hashed.subarray(0, length || hashed.length);
};

const toAddressBuffer = (value: string) => toBuffer(value, 20);
const toHashBuffer = (value: string) => toBuffer(value, 32);

async function seedTransactionTypes() {
  const types = [
    { id: 'redeem', name: 'Redeem', description: 'Redeem' },
    { id: 'transfer', name: 'Transfer', description: 'Transfer' },
    { id: 'earn', name: 'Earn', description: 'Earn' },
  ];

  for (const type of types) {
    await prisma.transactionType.upsert({
      where: { id: type.id },
      update: {
        name: type.name,
        description: type.description,
      },
      create: type,
    });
  }
}

async function seedMerchants() {
  for (const merchant of merchantSeeds) {
    await prisma.merchant.upsert({
      where: { id: merchant.id },
      update: {
        name: merchant.name,
        description: merchant.description,
        imageUrl: merchant.imageUrl,
        points: merchant.points,
        location: merchant.location,
        website: merchant.website,
        voucherIds: merchant.voucherIds,
        tel: merchant.tel,
      },
      create: {
        id: merchant.id,
        name: merchant.name,
        description: merchant.description,
        imageUrl: merchant.imageUrl,
        points: merchant.points,
        location: merchant.location,
        website: merchant.website,
        voucherIds: merchant.voucherIds,
        tel: merchant.tel,
      },
    });
  }
}

async function seedVouchers() {
  for (const voucher of voucherSeeds) {
    const redeemCode = voucher.redeemCode ?? `REDEEM-${voucher.id}`;
    await prisma.voucher.upsert({
      where: { id: voucher.id },
      update: {
        name: voucher.name,
        description: voucher.description,
        status: voucher.status,
        merchantName: voucher.merchantName,
        merchantId: voucher.merchantId,
        valueType: voucher.valueType,
        value: voucher.value,
        currency: voucher.currency,
        pointsCost: voucher.pointsCost,
        startDate: new Date(voucher.startDate),
        endDate: new Date(voucher.endDate),
        totalIssued: voucher.totalIssued,
        totalRedeemed: voucher.totalRedeemed,
        imageUrl: voucher.imageUrl,
        limitPerMember: voucher.limitPerMember,
      },
      create: {
        id: voucher.id,
        name: voucher.name,
        description: voucher.description,
        status: voucher.status,
        merchantName: voucher.merchantName,
        merchantId: voucher.merchantId,
        valueType: voucher.valueType,
        value: voucher.value,
        currency: voucher.currency,
        pointsCost: voucher.pointsCost,
        startDate: new Date(voucher.startDate),
        endDate: new Date(voucher.endDate),
        totalIssued: voucher.totalIssued,
        totalRedeemed: voucher.totalRedeemed,
        imageUrl: voucher.imageUrl,
        limitPerMember: voucher.limitPerMember,
      },
    });
  }
}

async function seedPoints() {
  for (const point of pointSeeds) {
    await prisma.point.upsert({
      where: { id: point.id },
      update: {
        name: point.name,
        symbol: point.symbol,
        contractAddress: toAddressBuffer(point.contractAddress),
        initialSupply: point.initialSupply,
        decimal: point.decimal,
        frameSize: point.frameSize,
        slotSize: point.slotSize,
        merchantId: point.merchantId,
      },
      create: {
        id: point.id,
        name: point.name,
        symbol: point.symbol,
        contractAddress: toAddressBuffer(point.contractAddress),
        initialSupply: point.initialSupply,
        decimal: point.decimal,
        frameSize: point.frameSize,
        slotSize: point.slotSize,
        merchantId: point.merchantId,
      },
    });
  }
}

async function seedApiKeys() {
  for (const apiKey of apiKeySeeds) {
    await prisma.apiKey.upsert({
      where: { id: apiKey.id },
      update: {
        name: apiKey.name,
        description: apiKey.description,
        apiKey: apiKey.apiKey,
        merchantId: apiKey.merchantId,
      },
      create: {
        id: apiKey.id,
        name: apiKey.name,
        description: apiKey.description,
        apiKey: apiKey.apiKey,
        merchantId: apiKey.merchantId,
      },
    });
  }
}

async function seedCustomers() {
  for (const customer of customerSeeds) {
    await prisma.customer.upsert({
      where: { id: customer.id },
      update: {
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        walletAddress: toAddressBuffer(customer.walletAddress),
        privateKey: `priv-key-${customer.id}`,
      },
      create: {
        id: customer.id,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        walletAddress: toAddressBuffer(customer.walletAddress),
        privateKey: `priv-key-${customer.id}`,
        tel: customer.tel,
      },
    });

    await prisma.customerMerChant.upsert({
      where: { id: `${customer.id}-${customer.merchantId}` },
      update: {
        customerId: customer.id,
        merchantId: customer.merchantId,
      },
      create: {
        id: `${customer.id}-${customer.merchantId}`,
        customerId: customer.id,
        merchantId: customer.merchantId,
      },
    });

    for (const customerPoint of customer.customerPoints) {
      await prisma.customerPoint.upsert({
        where: { id: `${customer.id}-${customerPoint.pointId}` },
        update: {
          customerId: customer.id,
          pointId: customerPoint.pointId,
          balances: customerPoint.balances,
        },
        create: {
          id: `${customer.id}-${customerPoint.pointId}`,
          customerId: customer.id,
          pointId: customerPoint.pointId,
          balances: customerPoint.balances,
        },
      });
    }
  }
}

async function seedTransactions() {
  for (const txn of transactionSeeds) {
    await prisma.transaction.upsert({
      where: { id: txn.id },
      update: {
        txHash: toHashBuffer(txn.txHash),
        senderAddress: toAddressBuffer(txn.senderAddress),
        receiverAddress: toAddressBuffer(txn.receiverAddress),
        amount: txn.amount,
        merchantId: txn.merchantId,
        pointId: txn.pointId,
        transactionTypeId: txn.transactionTypeId,
        senderId: txn.senderCustomerId,
        receiverId: txn.receiverCustomerId,
        createdAt: new Date(txn.createdAt),
      },
      create: {
        id: txn.id,
        txHash: toHashBuffer(txn.txHash),
        senderAddress: toAddressBuffer(txn.senderAddress),
        receiverAddress: toAddressBuffer(txn.receiverAddress),
        amount: txn.amount,
        merchantId: txn.merchantId,
        pointId: txn.pointId,
        transactionTypeId: txn.transactionTypeId,
        senderId: txn.senderCustomerId,
        receiverId: txn.receiverCustomerId,
        createdAt: new Date(txn.createdAt),
      },
    });
  }
}

async function main() {
  await seedMerchants();
  await seedVouchers();
  await seedPoints();
  await seedApiKeys();
  await seedCustomers();
  await seedTransactionTypes();
  await seedTransactions();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
