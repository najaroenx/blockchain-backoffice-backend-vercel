import { MerchantRefDetail } from 'src/modules/shared/services/merchant-ref-enrichment.service';
import { VoucherCodeWithVoucher } from 'src/modules/internal/transaction/types';

/**
 * Response DTO for GET /coupon/coupon-by-listing/:listingId
 *
 * Reuses VoucherCodeWithVoucher interface from transaction/types
 * and extends with point + merchantRefDetail enrichment.
 */
export interface GetVoucherByListingResponseDto extends VoucherCodeWithVoucher {
  code: string;
  voucherId: string;
  voucherGroupId?: string;
  pointsCost: number;
  thbPrice?: number;
  pointId?: string;
  currency?: string;
  isUsed: boolean;
  usedBy?: string;
  usedAt?: Date;
  currentOwnerId?: string;
  currentOwnerType?: string;
  createdAt: Date;
  listingBatchId?: string;
  voucher: VoucherCodeWithVoucher['voucher'] & {
    merchantName: string;
    merchantId?: string;
    sellerMerchantId?: string;
    thbPurchasePrice?: number;
    startDate: Date;
    endDate: Date;
    totalIssued: number;
    totalRedeemed: number;
    totalAvailable: number;
    limitPerMember?: number;
    createdAt: Date;
    updatedAt: Date;
    merchantRefDetail?: MerchantRefDetail | null;
  };
  point?: {
    id: string;
    name: string;
    symbol: string;
    contractAddress: object;
    imageUrl?: string;
    merchant?: { id: string };
  };
}
