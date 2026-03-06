import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';

interface VoucherRow {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  status: string;
  valueType: string;
  value: number;
  currency: string | null;
  startDate: Date;
  endDate: Date;
  tokenId: string | null;
  totalRedeemed: number;
  merchantId: string | null;
  merchantName: string;
  merchantRef: string | null;
  createdAt: Date;
  updatedAt: Date;
  // merchant join
  m_id: string | null;
  m_name: string | null;
  m_description: string | null;
  m_imageUrl: string | null;
  m_website: string | null;
  // latest unused code (LEFT JOIN LATERAL)
  lc_id: string | null;
  lc_code: string | null;
  lc_pointsCost: number | null;
  lc_currency: string | null;
  lc_isUsed: boolean | null;
  lc_usedAt: Date | null;
  lc_usedBy: string | null;
  lc_currentOwnerId: string | null;
  lc_createdAt: Date | null;
  // count
  totalCodes: bigint;
}

@Injectable()
export class GetVoucherById {
  private logger = new Logger(GetVoucherById.name);

  constructor(private prisma: PrismaService) {}

  async execute(voucherId: string): Promise<any> {
    try {
      this.logger.log(`[START] Getting voucher by id: ${voucherId}`);

      const rows = await this.prisma.$queryRaw<VoucherRow[]>`
        SELECT
          v."id",
          v."name",
          v."description",
          v."imageUrl",
          v."status",
          v."valueType",
          v."value",
          v."currency",
          v."startDate",
          v."endDate",
          v."tokenId",
          v."totalRedeemed",
          v."merchantId",
          v."merchantName",
          v."merchantRef",
          v."created_at"  AS "createdAt",
          v."updated_at"  AS "updatedAt",
          m."id"          AS "m_id",
          m."name"        AS "m_name",
          m."description" AS "m_description",
          m."imageUrl"    AS "m_imageUrl",
          m."website"     AS "m_website",
          lc."id"             AS "lc_id",
          lc."code"           AS "lc_code",
          lc."pointsCost"     AS "lc_pointsCost",
          lc."currency"       AS "lc_currency",
          lc."isUsed"         AS "lc_isUsed",
          lc."usedAt"         AS "lc_usedAt",
          lc."usedBy"         AS "lc_usedBy",
          lc."currentOwnerId" AS "lc_currentOwnerId",
          lc."created_at"     AS "lc_createdAt",
          (
            SELECT COUNT(*)::bigint
            FROM "VoucherCode" cc
            WHERE cc."voucherId" = v."id"
              AND cc."voucherGroupId" IS NOT NULL
          ) AS "totalCodes"
        FROM "Voucher" v
        LEFT JOIN "Merchant" m ON m."id" = v."merchantId"
        LEFT JOIN LATERAL (
          SELECT *
          FROM "VoucherCode" vc
          WHERE vc."voucherId" = v."id"
            AND vc."voucherGroupId" IS NOT NULL
            AND vc."isUsed" = false
          ORDER BY vc."created_at" DESC
          LIMIT 1
        ) lc ON true
        WHERE v."id" = ${voucherId}
      `;

      if (!rows.length) {
        this.logger.error(`[ERROR] Voucher with id ${voucherId} not found`);
        throw new NotFoundException(`Voucher with id ${voucherId} not found`);
      }

      const row = rows[0];

      const result = {
        id: row.id,
        name: row.name,
        description: row.description,
        imageUrl: row.imageUrl,
        status: row.status,
        valueType: row.valueType,
        value: row.value,
        currency: row.currency,
        startDate: row.startDate,
        endDate: row.endDate,
        tokenId: row.tokenId,
        totalRedeemed: row.totalRedeemed,
        merchantId: row.merchantId,
        merchantName: row.merchantName,
        merchantRef: row.merchantRef,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        merchant: row.m_id
          ? {
              id: row.m_id,
              name: row.m_name,
              description: row.m_description,
              imageUrl: row.m_imageUrl,
              website: row.m_website,
            }
          : null,
        latestCode: row.lc_id
          ? {
              id: row.lc_id,
              code: row.lc_code,
              pointsCost: row.lc_pointsCost,
              currency: row.lc_currency,
              isUsed: row.lc_isUsed,
              usedAt: row.lc_usedAt,
              usedBy: row.lc_usedBy,
              currentOwnerId: row.lc_currentOwnerId,
              createdAt: row.lc_createdAt,
            }
          : null,
        totalCodes: Number(row.totalCodes),
      };

      this.logger.log(`[SUCCESS] Retrieved voucher ${voucherId}`);

      return result;
    } catch (error) {
      this.logger.error(
        `[FATAL ERROR] Failed to get voucher: ${error.message}`,
        error.stack,
      );

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
