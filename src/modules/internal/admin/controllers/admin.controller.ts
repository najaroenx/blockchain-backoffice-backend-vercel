import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Logger,
  Param,
  Post,
  Put,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { Public } from 'src/modules/internal/auth/public.decorator';
import { ExportAisLogQueryDto } from '../dtos/export-ais-log-query.dto';
import { ExportAisLog } from '../handlers/export-ais-log.handler';
import { ExportDatabase } from '../handlers/export-database.handler';
import { ExportDatabaseSql } from '../handlers/export-database-sql.handler';
import { ListAllPoints } from '../handlers/list-all-points.handler';
import { DeleteVoucherCascade } from '../handlers/delete-voucher-cascade.handler';
import { MintTHBToMerchant } from '../handlers/mintTHBToMerchant.handler';
import { ResetCustomerPointBalances } from '../handlers/reset-customer-point-balances.handler';
import { ResetVoucherTokenIds } from '../handlers/reset-voucher-token-ids.handler';
import { UpdatePointContractAddress } from '../handlers/update-point-contract-address.handler';

/**
 * ⚠️ PHASE 1 SOLUTION - DEVELOPMENT/TESTING ONLY
 *
 * This admin controller provides endpoints for minting THB tokens directly to merchants.
 * This is a temporary solution for Phase 1 development and testing.
 *
 * FUTURE IMPROVEMENTS (Phase 2+):
 * - Replace with real payment gateway integration (Stripe, PayPal, Bank Transfer, etc.)
 * - Implement proper KYC/AML verification
 * - Add transaction monitoring and fraud detection
 * - Implement proper admin authentication and authorization
 * - Add rate limiting and security measures
 * - Integrate with real banking systems
 *
 * SECURITY WARNING:
 * - These endpoints should ONLY be accessible to verified admins
 * - Must be disabled or heavily restricted in production
 * - Consider using API keys or admin-only authentication
 */
@ApiTags('Admin')
@Public()
@Controller('admin')
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(
    private readonly mintTHBToMerchantHandler: MintTHBToMerchant,
    private readonly exportAisLogHandler: ExportAisLog,
    private readonly exportDatabaseHandler: ExportDatabase,
    private readonly exportDatabaseSqlHandler: ExportDatabaseSql,
    private readonly listAllPointsHandler: ListAllPoints,
    private readonly deleteVoucherCascadeHandler: DeleteVoucherCascade,
    private readonly resetCustomerPointBalancesHandler: ResetCustomerPointBalances,
    private readonly resetVoucherTokenIdsHandler: ResetVoucherTokenIds,
    private readonly updatePointContractAddressHandler: UpdatePointContractAddress,
  ) {}

  /**
   * PHASE 1: Mint THB tokens to merchant wallet
   *
   * This endpoint allows admins to mint THB tokens directly to a merchant's wallet.
   * In Phase 1, this simulates a merchant purchasing THB tokens with real money.
   *
   * In real-world implementation (Phase 2+), this should be replaced with:
   * 1. Merchant deposits real money (bank transfer, credit card, etc.)
   * 2. Payment gateway verifies the deposit
   * 3. System mints equivalent THB tokens to merchant's wallet
   * 4. Proper audit trail and compliance reporting
   *
   * @param merchantId - The merchant ID who should receive THB tokens
   * @param amount - Amount of THB tokens to mint (in THB, e.g., 1000 = 1000 THB)
   */
  @Post('mint-thb-to-merchant')
  async mintTHBToMerchant(
    @Body('merchantId') merchantId: string,
    @Body('amount') amount: number,
  ) {
    this.logger.warn(
      `[PHASE 1] Admin minting ${amount} THB to merchant ${merchantId}`,
    );
    this.logger.warn(
      '[WARNING] This is a Phase 1 development endpoint. Should be replaced with payment gateway in production.',
    );

    return this.mintTHBToMerchantHandler.execute(merchantId, amount);
  }

  @Get('export-ais-log')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Export AIS transfer log',
    description:
      'ส่งออก AIS transfer log ตามช่วงวันที่ในรูปแบบไฟล์ Excel (.xlsx)',
  })
  @ApiQuery({
    name: 'startDate',
    required: true,
    description: 'วันเริ่มต้นของข้อมูลในรูปแบบ YYYY-MM-DD',
    example: '2026-03-01',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description:
      'วันสิ้นสุดของข้อมูลในรูปแบบ YYYY-MM-DD ถ้าไม่ส่งมาจะใช้เวลาปัจจุบัน',
    example: '2026-03-09',
  })
  @ApiProduces(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @ApiResponse({
    status: 200,
    description: 'ส่งออกไฟล์ AIS transfer log สำเร็จ',
    schema: {
      type: 'string',
      format: 'binary',
    },
    headers: {
      'Content-Disposition': {
        description: 'ชื่อไฟล์ที่ดาวน์โหลด',
        schema: {
          type: 'string',
          example:
            'attachment; filename="ais-transfer-log-2026-03-01-to-2026-03-09.xlsx"',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'ข้อมูลวันที่ไม่ถูกต้อง เช่น รูปแบบไม่ใช่ YYYY-MM-DD หรือ startDate มากกว่า endDate',
  })
  async exportAisLog(
    @Query() query: ExportAisLogQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const { fileBuffer, fileName } =
      await this.exportAisLogHandler.execute(query);

    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileName}"`,
    );

    return new StreamableFile(fileBuffer);
  }

  @Get('export-database')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Export full database as JSON',
    description:
      'ส่งออกข้อมูลทุกตารางใน database เป็นไฟล์ JSON รวมข้อมูล sensitive ทั้งหมดสำหรับงาน backup/audit ภายใน',
  })
  @ApiProduces('application/json')
  @ApiResponse({
    status: 200,
    description: 'ส่งออกไฟล์ database สำเร็จ',
    schema: {
      type: 'string',
      format: 'binary',
    },
    headers: {
      'Content-Disposition': {
        description: 'ชื่อไฟล์ที่ดาวน์โหลด',
        schema: {
          type: 'string',
          example:
            'attachment; filename="database-export-2026-03-27T10-00-00-000Z.json"',
        },
      },
    },
  })
  async exportDatabase(
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const { fileBuffer, fileName } = await this.exportDatabaseHandler.execute();

    response.setHeader('Content-Type', 'application/json');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileName}"`,
    );

    return new StreamableFile(fileBuffer);
  }

  @Get('export-database-sql')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Export full database as SQL',
    description:
      'ส่งออกข้อมูลทุกตารางใน database เป็นไฟล์ SQL สำหรับ import กลับเข้า PostgreSQL ได้โดยตรง รวมข้อมูล sensitive ทั้งหมด',
  })
  @ApiProduces('application/sql')
  @ApiResponse({
    status: 200,
    description: 'ส่งออกไฟล์ SQL สำเร็จ',
    schema: {
      type: 'string',
      format: 'binary',
    },
    headers: {
      'Content-Disposition': {
        description: 'ชื่อไฟล์ที่ดาวน์โหลด',
        schema: {
          type: 'string',
          example:
            'attachment; filename="database-export-2026-03-27T10-00-00-000Z.sql"',
        },
      },
    },
  })
  async exportDatabaseSql(
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const { fileBuffer, fileName } =
      await this.exportDatabaseSqlHandler.execute();

    response.setHeader('Content-Type', 'application/sql');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileName}"`,
    );

    return new StreamableFile(fileBuffer);
  }

  @Get('points')
  @HttpCode(200)
  @ApiOperation({
    summary: 'List all Point records',
    description: 'ดึงทุก record จากตาราง Point',
  })
  @ApiResponse({
    status: 200,
    description: 'List all points successfully',
    schema: {
      type: 'object',
      properties: {
        points: {
          type: 'array',
          items: {
            type: 'object',
          },
        },
        counts: {
          type: 'number',
          example: 12,
        },
      },
    },
  })
  async listAllPoints() {
    return this.listAllPointsHandler.execute();
  }

  @Put('points/:pointId/contract-address')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Update Point contractAddress',
    description: 'อัปเดต contractAddress ของ record ในตาราง Point ตาม pointId',
  })
  @ApiResponse({
    status: 200,
    description: 'Update point contractAddress successfully',
    schema: {
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          example: true,
        },
        message: {
          type: 'string',
          example: 'Point contractAddress updated successfully',
        },
        point: {
          type: 'object',
        },
      },
    },
  })
  async updatePointContractAddress(
    @Param('pointId') pointId: string,
    @Body('contractAddress') contractAddress: string,
  ) {
    return this.updatePointContractAddressHandler.execute(
      pointId,
      contractAddress,
    );
  }

  @Post('customer-point/reset-balances')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Reset all CustomerPoint balances',
    description: 'อัปเดตทุก record ในตาราง CustomerPoint ให้ balances เป็น 0',
  })
  @ApiResponse({
    status: 200,
    description: 'Reset customer point balances successfully',
    schema: {
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          example: true,
        },
        message: {
          type: 'string',
          example: 'All customerPoint balances have been reset to 0',
        },
        updatedCount: {
          type: 'number',
          example: 128,
        },
      },
    },
  })
  async resetCustomerPointBalances() {
    return this.resetCustomerPointBalancesHandler.execute();
  }

  @Post('vouchers/reset-token-ids')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Reset all Voucher tokenId values',
    description:
      'อัปเดต tokenId ของทุก record ในตาราง Voucher ให้เริ่มจาก 10000 และเพิ่มทีละ 1 ตามลำดับ',
  })
  @ApiResponse({
    status: 200,
    description: 'Reset voucher tokenId values successfully',
    schema: {
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          example: true,
        },
        message: {
          type: 'string',
          example: 'All voucher tokenId values have been reset successfully',
        },
        updatedCount: {
          type: 'number',
          example: 25,
        },
        startTokenId: {
          type: 'string',
          example: '10000',
          nullable: true,
        },
        endTokenId: {
          type: 'string',
          example: '10024',
          nullable: true,
        },
      },
    },
  })
  async resetVoucherTokenIds() {
    return this.resetVoucherTokenIdsHandler.execute();
  }

  @Delete('vouchers/cascade')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Delete Transaction, VoucherCode, and Voucher data with cascade order',
    description:
      'ลบข้อมูลทั้งหมดในตาราง Transaction, VoucherCode และ Voucher แบบ cascade order โดยลบ Transaction ก่อน จากนั้นลบ VoucherCode และ Voucher',
  })
  @ApiResponse({
    status: 200,
    description: 'Delete voucher-related data successfully',
    schema: {
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          example: true,
        },
        message: {
          type: 'string',
          example:
            'Transaction, voucherCode, and voucher data deleted successfully',
        },
        deletedTransactions: {
          type: 'number',
          example: 120,
        },
        deletedVoucherCodes: {
          type: 'number',
          example: 60,
        },
        deletedVouchers: {
          type: 'number',
          example: 12,
        },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async deleteVoucherCascade() {
    return this.deleteVoucherCascadeHandler.execute();
  }
}
