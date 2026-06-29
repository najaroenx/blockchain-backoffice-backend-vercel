import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  MerchantFilterDto,
  PaginationDto,
  PointFilterDto,
} from 'src/common/dtos/pagination.dto';

describe('Pagination and Filter DTOs', () => {
  describe('PaginationDto', () => {
    it('should provide default page and limit values', () => {
      const dto = new PaginationDto();

      expect(dto.page).toBe(1);
      expect(dto.limit).toBe(20);
      expect(dto.skip).toBeUndefined();
    });

    it('should transform numeric query string values to numbers', () => {
      const dto = plainToInstance(PaginationDto, {
        page: '2',
        limit: '50',
        skip: '10',
      });

      const errors = validateSync(dto);

      expect(errors).toHaveLength(0);
      expect(dto.page).toBe(2);
      expect(dto.limit).toBe(50);
      expect(dto.skip).toBe(10);
    });

    it('should fail validation when values are out of range', () => {
      const dto = plainToInstance(PaginationDto, {
        page: '0',
        limit: '101',
        skip: '-1',
      });

      const errors = validateSync(dto);
      const errorMap = new Map(errors.map((error) => [error.property, error]));

      expect(errorMap.has('page')).toBe(true);
      expect(errorMap.has('limit')).toBe(true);
      expect(errorMap.has('skip')).toBe(true);
    });
  });

  describe('MerchantFilterDto', () => {
    it('should transform hasWallet string values to booleans', () => {
      const dtoTrue = plainToInstance(MerchantFilterDto, { hasWallet: 'true' });
      const dtoFalse = plainToInstance(MerchantFilterDto, {
        hasWallet: 'false',
      });

      expect(dtoTrue.hasWallet).toBe(true);
      expect(dtoFalse.hasWallet).toBe(false);
    });

    it('should preserve hasWallet when value is not true/false string', () => {
      const dto = plainToInstance(MerchantFilterDto, { hasWallet: 'maybe' });

      expect(dto.hasWallet).toBe('maybe' as unknown as boolean);
    });

    it('should validate optional string fields', () => {
      const validDto = plainToInstance(MerchantFilterDto, {
        name: 'Shop A',
        location: 'Bangkok',
        website: 'https://example.com',
        pointId: 'point-1',
      });

      const invalidDto = plainToInstance(MerchantFilterDto, {
        name: 123,
      });

      expect(validateSync(validDto)).toHaveLength(0);
      expect(validateSync(invalidDto).some((error) => error.property === 'name')).toBe(true);
    });
  });

  describe('PointFilterDto', () => {
    it('should validate optional filter fields as strings', () => {
      const dto = plainToInstance(PointFilterDto, {
        name: 'Token A',
        symbol: 'TKA',
        merchantId: 'merchant-1',
        merchantName: 'Merchant A',
        pointName: 'Reward Point',
      });

      const errors = validateSync(dto);

      expect(errors).toHaveLength(0);
    });

    it('should fail when symbol is not a string', () => {
      const dto = plainToInstance(PointFilterDto, { symbol: 1234 });

      const errors = validateSync(dto);

      expect(errors.some((error) => error.property === 'symbol')).toBe(true);
    });
  });
});
