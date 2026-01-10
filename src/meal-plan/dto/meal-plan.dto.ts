
import {
  IsInt,
  Min,
  IsOptional,
  IsDateString,
  Max
} from 'class-validator';
import { Type } from 'class-transformer';

export class GenerateMealPlanDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(14)
  daysCount?: number;
}

export class GetMealPlanQueryDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class RegenerateDayDto {
  @IsDateString()
  date: string;
}