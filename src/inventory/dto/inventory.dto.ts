import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsDateString,
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
}

export class UpdateInventoryItemDto {
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  quantity?: number;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;
}

export class RemoveFromInventoryDto {
  @IsNumber()
  @Min(0.01)
  quantity: number;
}