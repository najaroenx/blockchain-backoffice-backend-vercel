/*
  Warnings:

  - You are about to drop the column `pointsCost` on the `Voucher` table. All the data in the column will be lost.
  - Added the required column `pointsCost` to the `VoucherCode` table without a default value. This is not possible if the table is not empty.

*/

-- Step 1: เพิ่ม column pointsCost ใน VoucherCode (ใส่ default ชั่วคราว)
ALTER TABLE "VoucherCode" ADD COLUMN "pointsCost" INTEGER NOT NULL DEFAULT 0;

-- Step 2: Copy ค่า pointsCost จาก Voucher ไปยัง VoucherCode ที่เกี่ยวข้อง
UPDATE "VoucherCode" 
SET "pointsCost" = "Voucher"."pointsCost"
FROM "Voucher"
WHERE "VoucherCode"."voucherId" = "Voucher"."id";

-- Step 3: ลบ column pointsCost จาก Voucher
ALTER TABLE "Voucher" DROP COLUMN "pointsCost";
