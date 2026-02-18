import 'reflect-metadata';

jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import {
  CreateMerchantRefStoreDto,
  UpdateMerchantRefStoreDto,
  QueryMerchantRefStoreDto,
} from 'src/modules/internal/dashboard/dtos/merchant-ref-store.dto';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

describe('MerchantRefStore DTOs', () => {
  describe('CreateMerchantRefStoreDto', () => {
    it('should validate with required fields', async () => {
      const dto = plainToInstance(CreateMerchantRefStoreDto, {
        merchantRef: 'ref-001',
        name: 'Test Store',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail without required fields', async () => {
      const dto = plainToInstance(CreateMerchantRefStoreDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should accept optional fields', async () => {
      const dto = plainToInstance(CreateMerchantRefStoreDto, {
        merchantRef: 'ref-001',
        name: 'Test Store',
        category: 'food',
        description: 'A description',
        imageUrl: 'https://example.com/img.png',
        locationUrl: 'https://maps.google.com/test',
        website: 'https://example.com',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should reject invalid URL for imageUrl', async () => {
      const dto = plainToInstance(CreateMerchantRefStoreDto, {
        merchantRef: 'ref-001',
        name: 'Test Store',
        imageUrl: 'not-a-url',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('UpdateMerchantRefStoreDto', () => {
    it('should validate with all optional fields', async () => {
      const dto = plainToInstance(UpdateMerchantRefStoreDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept partial update', async () => {
      const dto = plainToInstance(UpdateMerchantRefStoreDto, {
        name: 'Updated Name',
        isActive: false,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should reject invalid imageUrl', async () => {
      const dto = plainToInstance(UpdateMerchantRefStoreDto, {
        imageUrl: 'bad-url',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('QueryMerchantRefStoreDto', () => {
    it('should have default values', () => {
      const dto = new QueryMerchantRefStoreDto();
      expect(dto.page).toBe(1);
      expect(dto.limit).toBe(20);
    });

    it('should validate with filter params', async () => {
      const dto = plainToInstance(QueryMerchantRefStoreDto, {
        merchantRef: 'ref',
        name: 'store',
        category: 'food',
        page: 2,
        limit: 50,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should reject page less than 1', async () => {
      const dto = plainToInstance(QueryMerchantRefStoreDto, {
        page: 0,
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'page')).toBe(true);
    });

    it('should reject limit greater than 100', async () => {
      const dto = plainToInstance(QueryMerchantRefStoreDto, {
        limit: 200,
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'limit')).toBe(true);
    });
  });
});
