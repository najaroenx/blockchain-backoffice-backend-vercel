import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class DryRunRewardsCsvHandler {
  private readonly logger = new Logger(DryRunRewardsCsvHandler.name);
  private static readonly MAX_CSV_BYTES = 5 * 1024 * 1024; // 5MB
  private static readonly MAX_CSV_LINES = 100_000;
  private static readonly MAX_LINE_LENGTH = 10_000;

  constructor(private readonly prisma: PrismaService) {}

  // แกะข้อมูล CSV ทีละบรรทัด (รองรับมีลูกน้ำซ้อนในเครื่องหมายคำพูด และรองรับ Windows CRLF)
  private parseCsvContent(fileContent: string) {
    const lines = fileContent
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length > DryRunRewardsCsvHandler.MAX_CSV_LINES) {
      throw new BadRequestException('CSV has too many lines');
    }

    const parsedRows = [];

    // ข้าม Header ไป 1 แถว (เริ่ม i = 1)
    for (let i = 1; i < lines.length; i++) {
      const text = lines[i];
      if (text.length > DryRunRewardsCsvHandler.MAX_LINE_LENGTH) {
        throw new BadRequestException(`CSV line ${i + 1} is too long`);
      }
      const result = [];
      let current = '';
      let inQuotes = false;

      for (let j = 0; j < text.length; j++) {
        const char = text[j];
        if (char === '"' && text[j + 1] === '"') {
          current += '"';
          j++;
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
      parsedRows.push(result);
    }

    return parsedRows;
  }

  async execute(file: any) {
    if (!file?.buffer) {
      throw new BadRequestException('CSV file is required');
    }

    try {
      if (file.buffer.length > DryRunRewardsCsvHandler.MAX_CSV_BYTES) {
        throw new BadRequestException('CSV file is too large');
      }

      // แปลง Buffer ให้กลายเป็น String เพื่อรัน Logic อ่านทีละบรรทัด
      const fileContent = file.buffer.toString('utf-8');
      const rows = this.parseCsvContent(fileContent);

      const toDistribute = [];
      const notFoundCustomers = [];
      const notFoundMerchants = [];

      for (const row of rows) {
        // หากคอลัมน์ไม่ครบข้ามไป (ต้องการถึงคอลัมน์ L = index 11)
        if (row.length < 12) continue;

        const sequenceNo = row[0];
        const merchantRef = row[1]?.trim();
        const voucherNameCSV = row[3];
        const status = row[8]?.trim();
        const phone = row[9]?.trim();
        const voucherId = row[11]?.trim();

        // เงื่อนไขแจกรางวัล
        if (status !== 'ยังไม่ได้แจก' || !phone) continue;

        // 1. ค้นหา Customer จากเบอร์โทรศัพท์
        const customer = await this.prisma.customer.findUnique({
          where: { tel: phone },
          include: { wallet: true },
        });
        if (!customer) {
          notFoundCustomers.push({ sequenceNo, phone, merchantRef });
          continue;
        }

        // 2. หาสต๊อก Coupon ที่ตรงกับ merchantRef (ไม่ต้อง fix voucherId จากไฟล์ เพราะอาจไม่ตรงกับ DB)
        const availableCode = await this.prisma.voucherCode.findFirst({
          where: {
            voucher: {
              merchantRef: merchantRef,
            },
            currentOwnerType: 'MERCHANT',
            isUsed: false,
          },
          include: { voucher: true },
        });

        if (!availableCode?.voucher) {
          notFoundMerchants.push({
            sequenceNo,
            merchantRef,
            voucherId_in_csv: voucherId,
            reason: 'NO_QUOTA_OR_MERCHANT_NOT_FOUND',
          });
          continue;
        }

        toDistribute.push({
          sequenceNo,
          phone,
          customerWallet: customer.wallet?.walletAddress || null,
          customerId: customer.id,
          merchantRef: merchantRef,
          merchantId: availableCode.currentOwnerId,
          reqVoucherDesc: voucherNameCSV,
          availableCode: availableCode.code,
          availableCodeId: availableCode.id,
          status: 'READY',
        });
      }

      // รีเทิร์นผลลัพธ์เป็น JSON สำหรับ UI / Postman ดูผลการเทียบข้อมูลแบบ Dry Run
      return {
        summary: {
          totalRecordsProcessed: rows.length,
          readyToDistribute: toDistribute.length,
          notFoundCustomers: notFoundCustomers.length,
          notFoundMerchants: notFoundMerchants.length,
        },
        payload: {
          toDistribute,
          notFoundCustomers,
          notFoundMerchants,
        },
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error(
        `Error processing CSV dry-run: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException('Failed to process CSV file');
    }
  }
}
