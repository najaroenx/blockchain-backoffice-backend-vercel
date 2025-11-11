import * as crypto from 'crypto';

/**
 * สร้าง unique redeem codes สำหรับ voucher
 * @param voucherId - ID ของ voucher
 * @param quantity - จำนวน codes ที่ต้องการสร้าง (เช่น 1000)
 * @returns Array of unique codes
 */
export function generateUniqueCodes(
  voucherId: string,
  quantity: number,
): string[] {
  const codes = new Set<string>();
  const prefix = voucherId
    .substring(0, 6)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  while (codes.size < quantity) {
    // สร้าง random code
    const randomPart = crypto.randomBytes(4).toString('hex').toUpperCase();
    const code = `${prefix}-${randomPart}`;
    codes.add(code);
  }

  return Array.from(codes);
}

/**
 * สร้าง code แบบ sequential สำหรับ voucher
 * @param voucherId - ID ของ voucher
 * @param quantity - จำนวน codes
 * @returns Array of sequential codes
 */
export function generateSequentialCodes(
  voucherId: string,
  quantity: number,
): string[] {
  const codes: string[] = [];
  const prefix = voucherId
    .substring(0, 6)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  const timestamp = Date.now().toString(36).toUpperCase();

  for (let i = 1; i <= quantity; i++) {
    // Format: PREFIX-TIMESTAMP-XXXX
    // ตัวอย่าง: VCHCR-L9K2P-0001, VCHCR-L9K2P-0002, ...
    const sequence = i.toString().padStart(4, '0');
    codes.push(`${prefix}-${timestamp}-${sequence}`);
  }

  return codes;
}

/**
 * สร้าง code แบบสั้นและจำง่าย
 * @param voucherId - ID ของ voucher
 * @param quantity - จำนวน codes
 * @returns Array of short codes
 */
export function generateShortCodes(
  voucherId: string,
  quantity: number,
): string[] {
  const codes = new Set<string>();
  const prefix = voucherId
    .substring(0, 4)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  while (codes.size < quantity) {
    // สร้าง 6 ตัวอักษร/ตัวเลข
    const random = crypto.randomBytes(3).toString('hex').toUpperCase();
    const code = `${prefix}${random}`;
    codes.add(code);
  }

  return Array.from(codes);
}
