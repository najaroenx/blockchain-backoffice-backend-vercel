import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';
import { CustomerDBService } from '../services/customer-db.service';
import { GetCustomerByPhoneResponseTypeV1 } from '../types';
import { logAndRethrowOrInternalError } from 'src/common/utils/handler-error.util';

@Injectable()
export class GetCustomerPhoneDevForResp {
  private logger = new Logger(GetCustomerPhoneDevForResp.name);

  constructor(private db: CustomerDBService) {}

  async execute(
    merchantId: string,
    phone: string,
    callbackUri?: string,
  ): Promise<GetCustomerByPhoneResponseTypeV1> {
    try {
      const customer = await this.db.getCustomersByPhone(merchantId, phone);
      this.logger.log(
        `Fetched customer for phone ${phone} under merchant ${merchantId} callbackUri: ${callbackUri}`,
      );
      if (!customer)
        throw new NotFoundException({
          statusCode: 404,
          message: 'Customer not found',
          error: 'CUSTOMER_NOT_FOUND',
        });

      // Group vouchers by voucherGroupId
      const groupedVouchers = this.groupVouchersByGroupId(
        customer.ownedVouchers || [],
      );

      const formattedCustomer = {
        ...customer,
        phone: phone,
        walletAddress: customer.wallet?.walletAddress || '',
        ownedVouchers: groupedVouchers,
        customerPoints: (customer.customerPoints || []).map((cp: any) => ({
          id: cp.point.id,
          name: cp.point.name,
          symbol: cp.point.symbol,
          merchantId: cp.point.merchantId || null,
          imageUrl: cp.point.imageUrl || null,
          balance: cp.balances,
        })),
        customerMerChant: customer.customerMerChant || [],
      };

      return formattedCustomer;
    } catch (error) {
      logAndRethrowOrInternalError(this.logger, error, [NotFoundException]);
    }
  }

  async executeDetailed(phone: string) {
    try {
      this.logger.log(`[START] Getting customer detailed by phone: ${phone}`);

      const customerData = await this.db.getCustomerByPhoneDetailed(phone);

      if (!customerData) {
        return {
          message: `Customer with phone ${phone} not found`,
          status: 404,
          data: null,
        };
      }

      this.logger.log(`[SUCCESS] Found customer: ${(customerData as any).id}`);

      const merchants = this.formatMerchantsWithPointsAndCoupons(customerData);
      const walletAddress = (customerData as any).wallet?.walletAddress || '';

      return {
        message: 'success',
        status: 200,
        data: {
          walletAddress,
          phone,
          customer: {
            id: (customerData as any).id,
            email: (customerData as any).email,
            firstName: (customerData as any).firstName,
            lastName: (customerData as any).lastName,
            tel: (customerData as any).tel,
            walletAddress,
            createdAt: (customerData as any).createdAt,
            updatedAt: (customerData as any).updatedAt,
            merchants,
          },
        },
      };
    } catch (error) {
      this.logger.error(
        `Error getting customer detailed by phone: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }

  private formatMerchantsWithPointsAndCoupons(customer: any) {
    const merchantMap = new Map();

    // Group by merchants
    customer.customerMerChant?.forEach((cm: any) => {
      if (cm.merchant) {
        merchantMap.set(cm.merchantId, {
          merchantId: cm.merchant.id,
          name: cm.merchant.name,
          description: cm.merchant.description || '',
          points: [],
          coupons: [],
        });
      }
    });

    // Add points to merchants
    customer.customerPoints?.forEach((cp: any) => {
      if (cp.point && cp.point.merchantId) {
        const merchant = merchantMap.get(cp.point.merchantId);
        if (merchant) {
          merchant.points.push({
            title: cp.point.name,
            balance: cp.balances,
            pointId: cp.point.id,
          });
        }
      }
    });

    // Add coupons to merchants
    customer.ownedVouchers?.forEach((voucher: any) => {
      if (voucher.voucher && voucher.voucher.merchantId) {
        const merchant = merchantMap.get(voucher.voucher.merchantId);
        if (merchant) {
          merchant.coupons.push({
            codeId: voucher.id,
            code: voucher.code,
            voucherId: voucher.voucherId,
            name: voucher.voucher.name,
            description: voucher.voucher.description,
            imageUrl: voucher.voucher.imageUrl || null,
            pointsCost: voucher.pointsCost,
            currency: voucher.currency,
            value: voucher.voucher.value,
            valueType: voucher.voucher.valueType,
            isUsed: voucher.isUsed || false,
            usedAt: voucher.usedAt || null,
          });
        }
      }
    });

    return Array.from(merchantMap.values());
  }

  private groupVouchersByGroupId(vouchers: any[]): any[] {
    const groupedMap = new Map<string, any>();
    const now = new Date();

    for (const voucherCode of vouchers) {
      const groupId = voucherCode.voucherGroupId || voucherCode.voucherId;
      const isExpired =
        voucherCode.voucher.endDate &&
        new Date(voucherCode.voucher.endDate) < now;

      // Determine status: expired > used > unused
      let status = 'unused';
      if (isExpired) {
        status = 'expired';
      } else if (voucherCode.isUsed) {
        status = 'used';
      }

      const key = `${groupId}|${status}`;

      if (!groupedMap.has(key)) {
        groupedMap.set(key, {
          voucherGroupId: groupId,
          latestVoucher: {
            ...voucherCode.voucher,
            latestCode: null,
            codeStatus: status,
            pointsCost: voucherCode.pointsCost,
            currency: voucherCode.currency,
          },
          totalCodes: 0,
        });
      }

      const group = groupedMap.get(key);

      // Set latestCode to the latest code in this status group (since we ordered by createdAt desc)
      if (!group.latestVoucher.latestCode) {
        group.latestVoucher.latestCode = voucherCode.code;
      }

      group.totalCodes += 1;
    }

    return Array.from(groupedMap.values());
  }
}
