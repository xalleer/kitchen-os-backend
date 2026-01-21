import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsEnum,
  Min,
  Max,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Unit } from '@prisma/client';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  category: string;

  @IsEnum(Unit)
  baseUnit: Unit;

  @IsNumber()
  @Min(0)
  averagePrice: number;

  @IsNumber()
  @Min(0)
  caloriesPer100: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  standardAmount?: number;

  @IsOptional()
  @IsString()
  image?: string;
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsEnum(Unit)
  baseUnit?: Unit;

  @IsOptional()
  @IsNumber()
  @Min(0)
  caloriesPer100?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  averagePrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  standardAmount?: number;
}

export class GetProductsQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsEnum(Unit)
  baseUnit?: Unit;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}