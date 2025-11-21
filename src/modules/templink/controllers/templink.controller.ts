import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  HttpCode,
} from '@nestjs/common';
import {
  CreateTempLink,
  GetTempLinkByUid,
  GetTempLinksByMerchant,
  UpdateTempLink,
  DeleteTempLink,
} from '../handlers';
import {
  CreateTempLinkDto,
  UpdateTempLinkDto,
  GetTempLinkByUidParams,
  GetTempLinksByMerchantParams,
} from '../dtos';
import { Public } from 'src/modules/auth/public.decorator';

@Controller('templink')
export class TempLinkController {
  constructor(
    private readonly createTempLinkHandler: CreateTempLink,
    private readonly getTempLinkByUidHandler: GetTempLinkByUid,
    private readonly getTempLinksByMerchantHandler: GetTempLinksByMerchant,
    private readonly updateTempLinkHandler: UpdateTempLink,
    private readonly deleteTempLinkHandler: DeleteTempLink,
  ) {}

  @Public()
  @Post('/')
  @HttpCode(201)
  async createTempLink(@Body() body: CreateTempLinkDto) {
    return this.createTempLinkHandler.execute(
      body.phoneNumber,
      body.merchantId,
      new Date(body.expire),
    );
  }
  @Public()
  @Get('/:uid')
  @HttpCode(200)
  async getTempLinkByUid(@Param() params: GetTempLinkByUidParams) {
    return this.getTempLinkByUidHandler.execute(params.uid);
  }

  @Get('/merchant/:merchantId')
  @HttpCode(200)
  async getTempLinksByMerchant(@Param() params: GetTempLinksByMerchantParams) {
    return this.getTempLinksByMerchantHandler.execute(params.merchantId);
  }

  @Put('/:uid')
  @HttpCode(200)
  async updateTempLink(
    @Param() params: GetTempLinkByUidParams,
    @Body() body: UpdateTempLinkDto,
  ) {
    return this.updateTempLinkHandler.execute(
      params.uid,
      body.expire ? new Date(body.expire) : undefined,
    );
  }

  @Delete('/:uid')
  @HttpCode(200)
  async deleteTempLink(@Param() params: GetTempLinkByUidParams) {
    return this.deleteTempLinkHandler.execute(params.uid);
  }
}
