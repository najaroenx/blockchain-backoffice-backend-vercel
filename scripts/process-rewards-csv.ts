import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

import * as path from 'path';

const prisma = new PrismaClient();

// ฟังก์ชันสำหรับแกะข้อมูล CSV ทีละบรรทัด (รองรับกรณีมีเครื่องหมายลูกน้ำ , ข้างในเครื่องหมายคำพูด "")
function parseCsvLine(text: string) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"' && text[i + 1] === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

async function main() {
  // รับ Path ไฟล์จาก Command Line (เช่น npx ts-node script.ts ./file.csv) 
  // หรือถ้าไม่ใส่มา จะหาไฟล์ชื่อ 'rewards.csv' ในโฟลเดอร์ root ของโปรเจกต์
  const filePath = process.argv[2] || path.join(__dirname, '../rewards.csv');

  if (!fs.existsSync(filePath)) {
    console.error(`❌ ไม่พบไฟล์ CSV ที่: ${filePath}`);
    console.log(`คำแนะนำ: กรุณาแนบไฟล์ rewards.csv ไว้ที่โฟลเดอร์โปรเจกต์ หรือรันแบบระบุ Path ไฟล์: npx ts-node scripts/process-rewards-csv.ts <path-to-csv>`);
    return;
  }

  const fileData = fs.readFileSync(filePath, 'utf-8');
  const lines = fileData.split('\n').filter((l) => l.trim().length > 0);

  const toDistribute = [];
  const notFoundCustomers = [];
  const notFoundMerchants = [];

  console.log(`เริ่มตรวจสอบข้อมูลจาก CSV จำนวน ${lines.length - 1} รายการ...`);

  // ข้าม Header แถวแรก
  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    if (row.length < 10) continue;

    const sequenceNo = row[0];
    const shopNameRaw = row[1];
    const voucherNameCSV = row[3];
    const status = row[8];
    const phone = row[9];

    // ข้ามคนที่ไม่มีเบอร์โทร หรือ สถานะไม่ใช่ "ยังไม่ได้แจก"
    if (status !== 'ยังไม่ได้แจก' || !phone) continue;

    // --- 1. ค้นหา Customer จากเบอร์โทรศัพท์ ---
    const customer = await prisma.customer.findUnique({ where: { tel: phone } });
    if (!customer) {
      notFoundCustomers.push({ sequenceNo, phone, shopNameRaw });
      continue;
    }

    // --- 2. ค้นหา Merchant จากชื่อร้าน ---
    // ใช้เทคนิคแบ่ง String ด้วยวงเล็บเพื่อหาเฉพาะชื่อหลัก (เช่น "TINY HOME ARI (ไทนี่ โฮม อารีย์)" -> หาคำว่า "TINY HOME ARI")
    const searchKeyword = shopNameRaw.split('(')[0].trim();
    const merchant = await prisma.merchant.findFirst({
      where: { name: { contains: searchKeyword } },
    });

    if (!merchant) {
      notFoundMerchants.push({ sequenceNo, shopNameRaw, searchKeyword });
      continue;
    }

    // --- 3. ค้นหาคูปองรหัสว่างของร้านค้านี้ (เพื่อเตรียมแจก) ---
    // หมายเหตุ: ตรงรหัสการหา VoucherCode อาจจะต้อง refine เงื่อนไขให้ตรงกับ "voucherNameCSV" มากขึ้น
    const availableCode = await prisma.voucherCode.findFirst({
      where: {
        currentOwnerId: merchant.id,
        currentOwnerType: 'MERCHANT',
        isUsed: false,
        // เพิ่มเงื่อนไขเพื่อหา Voucher Group ให้ถูกประเภท (ถ้าจำเป็น)
      },
      include: { voucher: true },
    });

    toDistribute.push({
      sequenceNo,
      phone,
      customerId: customer.id,
      shop: merchant.name,
      merchantId: merchant.id,
      reqVoucherDesc: voucherNameCSV,
      foundCodeMsg: availableCode ? `YES: ${availableCode.code}` : '❌ NO QUOTA',
      availableCodeId: availableCode?.id,
    });
  }

  // ============== สรุปผลรีวิว (DRY RUN) ==============
  console.log(`\n=== 🚨 สรุปผลการจับคู่ข้อมูล (DRY RUN) 🚨 ===`);
  
  if (notFoundCustomers.length > 0) {
    console.log(`\n❌ ไม่พบลูกค้าเบอร์นี้ในระบบ (${notFoundCustomers.length} รายการ):`);
    console.table(notFoundCustomers);
  }

  if (notFoundMerchants.length > 0) {
    console.log(`\n❌ ไม่พบร้านค้านี้ในระบบ (${notFoundMerchants.length} รายการ):`);
    console.table(notFoundMerchants);
  }

  console.log(`\n✅ ลิสต์คูปองที่จับคู่ข้อมูลพร้อมแจก (${toDistribute.length} รายการ):`);
  console.table(
    toDistribute.map((item) => ({
      No: item.sequenceNo,
      Phone: item.phone,
      Shop: item.shop,
      Request: item.reqVoucherDesc,
      HasCode: item.foundCodeMsg,
    }))
  );

  console.log(`\n[i] ยังไม่มีการอัปเดตข้อมูลลงฐานข้อมูลหรือ Blockchain (สำหรับรีวิวเท่านั้น)`);

  // ===================================
  // TODO: ส่วนของโค้ดโอนของจริง (รันหลังจากตกลงแล้ว)
  // ===================================
  /*
  // ตัวอย่างโค้ดที่จะถูกเพิ่มเข้าไปหากยืนยัน:
  for (const item of toDistribute) {
    if(!item.availableCodeId) continue;

    // 1. อัปเดต DB (เปลี่ยน currentOwnerId เป็น customerId และตั้ง voucherGroupId: null)
    await prisma.$transaction(async (tx) => {
       await tx.voucherCode.update({ ... })
       await tx.transaction.create({ ... })
    });

    // 2. เรียก Smart Contract เพื่อโอน (ethers.js transfer)
    // await contract.safeTransferFrom(...) หรือฟังก์ชันที่ตรงกับ Architecture
  }
  */
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
