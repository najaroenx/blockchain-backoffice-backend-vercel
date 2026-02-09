import { Controller, Get, HttpCode, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { Public } from 'src/modules/internal/auth/public.decorator';
import { PointDBService } from 'src/modules/internal/point/services/point-db.service';
import { GetPointById } from 'src/modules/internal/point/handlers/getPointById.handler';
import { GetPointByPhone } from 'src/modules/internal/point/handlers/getPointByPhone.handler';
import { PointFilterDto } from 'src/common/dtos/pagination.dto';
import { GetPointByIdParams } from 'src/modules/internal/point/dtos';

/**
 * External Point Controller
 *
 * Endpoints for external integration:
 * - GET /points/all - Get all points with pagination
 * - GET /points/my-points/{phone} - Get user points by phone
 * - GET /points/{pointId} - Get point by ID
 */
@ApiTags('External - Points')
@Controller('points')
export class ExternalPointController {
  constructor(
    private readonly pointDBService: PointDBService,
    private readonly getPointByIdHandler: GetPointById,
    private readonly getPointByPhoneHandler: GetPointByPhone,
  ) {}

  /**
   * Get all points with pagination and filtering
   * GET /points/all?page=1&limit=20&name=gold&symbol=GOLD&merchantName=store
   */
  @Get('/all')
  @Public()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get All Points',
    description: 'ดึงข้อมูล Point ทั้งหมดพร้อม pagination และ filtering',
  })
  @ApiResponse({
    status: 200,
    description: 'Points retrieved successfully',
  })
  async getAllPoints(@Query() filters: PointFilterDto) {
    return this.pointDBService.getAllPoints(filters);
  }

  /**
   * Get points by customer phone
   * GET /points/my-points/:phone
   * NOTE: Must be defined BEFORE /:pointId to avoid route conflict
   */
  @Get('/my-points/:phone')
  @Public()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get User Points by Phone',
    description: 'ดึงข้อมูล Point ของลูกค้าด้วยเบอร์โทรศัพท์',
  })
  @ApiParam({
    name: 'phone',
    description: 'เบอร์โทรศัพท์ของลูกค้า (10 digits)',
    example: '0984360421',
  })
  @ApiResponse({
    status: 200,
    description: 'Points retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Customer not found',
  })
  async getPointsByPhone(@Param('phone') phone: string) {
    return this.getPointByPhoneHandler.execute(phone);
  }

  /**
   * Get point by ID
   * GET /points/:pointId
   */
  @Get('/:pointId')
  @Public()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get Point by ID',
    description: 'ดึงข้อมูล Point ด้วย Point ID',
  })
  @ApiParam({
    name: 'pointId',
    description: 'Point ID',
    example: 'cm4abc123xyz',
  })
  @ApiResponse({
    status: 200,
    description: 'Point retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Point not found',
  })
  async getPointById(@Param() params: GetPointByIdParams) {
    const { pointId } = params;
    return this.getPointByIdHandler.execute(pointId);
  }
}
