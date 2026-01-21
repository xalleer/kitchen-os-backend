// src/inventory/dto/inventory.dto.ts - ОНОВЛЕНО

import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsDateString,
  IsBoolean,
  Min,
} from 'class-validator';

export class AddToInventoryDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsNumber()
  @Min(0.01)
  quantity: number;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsBoolean()
  deductFromBudget?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  purchasePrice?: number;

  // ⭐ НОВЕ: Магазин
  @IsOptional()
  @IsString()
  retailer?: string;
}

export class UpdateInventoryItemDto {
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  quantity?: number;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsBoolean()
  deductFromBudget?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  purchasePrice?: number;
}

export class RemoveFromInventoryDto {
  @IsNumber()
  @Min(0.01)
  quantity: number;
}