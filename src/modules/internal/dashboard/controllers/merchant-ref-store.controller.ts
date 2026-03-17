import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Public } from 'src/modules/internal/auth/public.decorator';
import {
  CreateMerchantRefStoreDto,
  UpdateMerchantRefStoreDto,
  QueryMerchantRefStoreDto,
  PaginatedMerchantRefStoreResponse,
  MerchantRefStoreResponse,
} from '../dtos/merchant-ref-store.dto';
import {
  ListMerchantRefStoreHandler,
  GetMerchantRefStoreByIdHandler,
  GetMerchantRefStoreByRefHandler,
} from '../handlers/merchant-ref-store/list-merchant-ref-store.handler';
import { CreateMerchantRefStoreHandler } from '../handlers/merchant-ref-store/create-merchant-ref-store.handler';
import { UpdateMerchantRefStoreHandler } from '../handlers/merchant-ref-store/update-merchant-ref-store.handler';
import { DeleteMerchantRefStoreHandler } from '../handlers/merchant-ref-store/delete-merchant-ref-store.handler';

@Public()
@Controller('merchant-ref-store')
export class MerchantRefStoreController {
  constructor(
    private readonly listHandler: ListMerchantRefStoreHandler,
    private readonly getByIdHandler: GetMerchantRefStoreByIdHandler,
    private readonly getByRefHandler: GetMerchantRefStoreByRefHandler,
    private readonly createHandler: CreateMerchantRefStoreHandler,
    private readonly updateHandler: UpdateMerchantRefStoreHandler,
    private readonly deleteHandler: DeleteMerchantRefStoreHandler,
  ) {}

  /**
   * GET /merchant-ref-store
   * List all MerchantRefStores with pagination and filters
   */
  @Get()
  async list(
    @Query() query: QueryMerchantRefStoreDto,
  ): Promise<PaginatedMerchantRefStoreResponse> {
    return this.listHandler.execute(query);
  }

  /**
   * GET /merchant-ref-store/:merchantRef
   * Get a single MerchantRefStore by merchantRef
   */
  @Get(':id')
  async getByMerchantRef(
    @Param('id') merchantRef: string,
  ): Promise<MerchantRefStoreResponse> {
    return this.getByIdHandler.execute(merchantRef);
  }

  /**
   * GET /merchant-ref-store/ref/:merchantRef
   * Get a single MerchantRefStore by merchantRef (alias route)
   */
  @Get('ref/:merchantRef')
  async getByRef(
    @Param('merchantRef') merchantRef: string,
  ): Promise<MerchantRefStoreResponse> {
    return this.getByRefHandler.execute(merchantRef);
  }

  /**
   * POST /merchant-ref-store
   * Create a new MerchantRefStore
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateMerchantRefStoreDto,
  ): Promise<MerchantRefStoreResponse> {
    return this.createHandler.execute(dto);
  }

  /**
   * PUT /merchant-ref-store/:id
   * Update an existing MerchantRefStore
   */
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateMerchantRefStoreDto,
  ): Promise<MerchantRefStoreResponse> {
    return this.updateHandler.execute(id, dto);
  }

  /**
   * DELETE /merchant-ref-store/:id
   * Soft delete a MerchantRefStore (set isActive = false)
   */
  @Delete(':id')
  async delete(@Param('id') id: string): Promise<MerchantRefStoreResponse> {
    return this.deleteHandler.execute(id);
  }
}
