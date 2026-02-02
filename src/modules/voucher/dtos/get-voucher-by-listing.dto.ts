import { ApiProperty } from '@nestjs/swagger';

// Nested DTOs
class VoucherDetailDto {
  @ApiProperty({ description: 'Voucher ID' })
  id: string;

  @ApiProperty({ description: 'Voucher name' })
  name: string;

  @ApiProperty({ description: 'Voucher description', required: false })
  description?: string;

  @ApiProperty({
    description: 'Voucher status',
    enum: ['active', 'upcoming', 'expired'],
  })
  status: string;

  @ApiProperty({ description: 'Merchant name', required: false })
  merchantName?: string;

  @ApiProperty({ description: 'Merchant ID', required: false })
  merchantId?: string;

  @ApiProperty({ description: 'Merchant reference', required: false })
  merchantRef?: string;

  @ApiProperty({ description: 'Seller merchant ID', required: false })
  sellerMerchantId?: string;

  @ApiProperty({ description: 'Token ID on blockchain' })
  tokenId: string;

  @ApiProperty({ description: 'Value type', enum: ['cash', 'percentage'] })
  valueType: string;

  @ApiProperty({ description: 'Voucher value' })
  value: number;

  @ApiProperty({ description: 'THB purchase price', required: false })
  thbPurchasePrice?: number;

  @ApiProperty({ description: 'Currency' })
  currency: string;

  @ApiProperty({ description: 'Start date' })
  startDate: Date;

  @ApiProperty({ description: 'End date' })
  endDate: Date;

  @ApiProperty({ description: 'Total issued' })
  totalIssued: number;

  @ApiProperty({ description: 'Total redeemed' })
  totalRedeemed: number;

  @ApiProperty({ description: 'Total available' })
  totalAvailable: number;

  @ApiProperty({ description: 'Image URL', required: false })
  imageUrl?: string;

  @ApiProperty({ description: 'Limit per member', required: false })
  limitPerMember?: number;

  @ApiProperty({ description: 'Created at' })
  createdAt: Date;

  @ApiProperty({ description: 'Updated at' })
  updatedAt: Date;

  @ApiProperty({ description: 'Merchant info', required: false })
  merchant?: object;
}

class PointDetailDto {
  @ApiProperty({ description: 'Point ID' })
  id: string;

  @ApiProperty({ description: 'Point name' })
  name: string;

  @ApiProperty({ description: 'Point symbol' })
  symbol: string;

  @ApiProperty({ description: 'Contract address (Buffer object)' })
  contractAddress: object;

  @ApiProperty({ description: 'Image URL', required: false })
  imageUrl?: string;
}

// Main Response DTO
export class GetVoucherByListingResponseDto {
  @ApiProperty({ description: 'Voucher code ID' })
  id: string;

  @ApiProperty({ description: 'Unique voucher code' })
  code: string;

  @ApiProperty({ description: 'Voucher ID reference' })
  voucherId: string;

  @ApiProperty({ description: 'Voucher group ID (listing ID)' })
  voucherGroupId: string;

  @ApiProperty({ description: 'Points cost to redeem' })
  pointsCost: number;

  @ApiProperty({ description: 'THB price' })
  thbPrice: number;

  @ApiProperty({ description: 'Point ID', required: false })
  pointId?: string;

  @ApiProperty({ description: 'Currency symbol' })
  currency: string;

  @ApiProperty({ description: 'Whether the voucher is used' })
  isUsed: boolean;

  @ApiProperty({ description: 'User ID who used', required: false })
  usedBy?: string;

  @ApiProperty({ description: 'Used at timestamp', required: false })
  usedAt?: Date;

  @ApiProperty({ description: 'Current owner ID', required: false })
  currentOwnerId?: string;

  @ApiProperty({
    description: 'Current owner type',
    enum: ['MERCHANT', 'CUSTOMER'],
    required: false,
  })
  currentOwnerType?: string;

  @ApiProperty({ description: 'Created at timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Listing batch ID', required: false })
  listingBatchId?: string;

  @ApiProperty({ description: 'Voucher details', type: VoucherDetailDto })
  voucher: VoucherDetailDto;

  @ApiProperty({
    description: 'Point details',
    type: PointDetailDto,
    required: false,
  })
  point?: PointDetailDto;
}
