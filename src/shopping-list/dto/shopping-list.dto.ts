import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsDateString,
  IsBoolean,
  Min,
} from 'class-validator';

export class GenerateShoppingListDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class AddManualItemDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsNumber()
  @Min(0.01)
  quantity: number;

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateShoppingItemDto {
  @IsNumber()
  @Min(0.01)
  quantity: number;

  @IsOptional()
  @IsString()
  manualNote?: string;
}

export class MarkAsBoughtDto {
  @IsBoolean()
  isBought: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  actualPrice?: number;
}