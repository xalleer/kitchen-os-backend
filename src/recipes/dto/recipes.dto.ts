import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsNumber,
  IsOptional,
  ValidateNested,
  Min,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';

class IngredientDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsNumber()
  @Min(0.01)
  amount: number;
}

export class GenerateRecipeDto {
  @IsArray()
  @IsString({ each: true })
  productIds: string[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  portions?: number;

  @IsOptional()
  @IsString()
  cuisine?: string;
}

export class GenerateRecipeByNamesDto {
  @IsArray()
  @IsString({ each: true })
  productNames: string[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  portions?: number;
}

export class GenerateCustomRecipeDto {
  @IsString()
  @IsNotEmpty()
  dishName: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  portions?: number;
}

export class CookRecipeDto {
  @IsString()
  @IsNotEmpty()
  recipeId: string;
}

export class SaveRecipeDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  instructions: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  cookingTime?: number;

  @IsOptional()
  @IsNumber()
  servings?: number;

  @IsOptional()
  @IsNumber()
  calories?: number;

  @IsOptional()
  @IsString()
  category?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IngredientDto)
  ingredients: IngredientDto[];
}