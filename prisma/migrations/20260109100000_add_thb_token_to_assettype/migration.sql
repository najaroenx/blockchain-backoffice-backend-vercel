-- Add THB_TOKEN to AssetType enum
-- This migration adds the THB_TOKEN value to the existing AssetType enum

ALTER TYPE "AssetType" ADD VALUE IF NOT EXISTS 'THB_TOKEN';
