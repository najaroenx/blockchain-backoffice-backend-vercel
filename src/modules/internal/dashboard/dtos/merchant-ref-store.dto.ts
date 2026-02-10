import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  Max,
  IsUrl,
} from 'class-validator';
import { Type } from 'class-transformer';

// DTO สำหรับสร้าง MerchantRefStore
export class CreateMerchantRefStoreDto {
  @IsString()
  merchantRef: string; // รหัสอ้างอิงร้านค้า (unique)

  @IsString()
  name: string; // ชื่อร้าน

  @IsOptional()
  @IsString()
  category?: string; // ประเภทร้าน

  @IsOptional()
  @IsString()
  description?: string; // อธิบาย

  @IsOptional()
  @IsUrl()
  imageUrl?: string; // รูปร้าน

  @IsOptional()
  @IsUrl()
  locationUrl?: string; // URL Google Map

  @IsOptional()
  @IsUrl()
  website?: string; // เว็บไซต์ร้าน
}

// DTO สำหรับอัปเดต MerchantRefStore (ทุก field เป็น optional)
export class UpdateMerchantRefStoreDto {
  @IsOptional()
  @IsString()
  merchantRef?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @IsOptional()
  @IsUrl()
  locationUrl?: string;

  @IsOptional()
  @IsUrl()
  website?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// DTO สำหรับ query list with pagination
export class QueryMerchantRefStoreDto {
  @IsOptional()
  @IsString()
  merchantRef?: string; // Filter by merchantRef (partial match)

  @IsOptional()
  @IsString()
  name?: string; // Filter by name (partial match)

  @IsOptional()
  @IsString()
  category?: string; // Filter by category

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean; // Filter by active status

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1; // Page number (1-indexed)

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20; // Items per page (max 100)
}

// Response type สำหรับ MerchantRefStore
export interface MerchantRefStoreResponse {
  id: string;
  merchantRef: string;
  name: string;
  category: string | null;
  description: string | null;
  imageUrl: string | null;
  locationUrl: string | null;
  website: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Response type สำหรับ pagination
export interface PaginatedMerchantRefStoreResponse {
  data: MerchantRefStoreResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
