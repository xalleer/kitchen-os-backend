import {
  IsString,
  IsEmail,
  IsOptional,
  IsNumber,
  IsEnum,
  IsBoolean,
  IsArray,
  MinLength,
  Min,
  Max,
} from 'class-validator';
import { Gender, Goal } from '@prisma/client';

export class UpdateProfileDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(6)
  oldPassword: string;

  @IsString()
  @MinLength(6)
  newPassword: string;
}

export class UpdateUserPreferencesDto {
  @IsOptional()
  @IsNumber()
  @Min(20)
  @Max(300)
  weight?: number;

  @IsOptional()
  @IsNumber()
  @Min(50)
  @Max(250)
  height?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(120)
  age?: number;

  @IsOptional()
  @IsEnum(Goal)
  goal?: Goal;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allergies?: string[];

  @IsOptional()
  @IsBoolean()
  eatsBreakfast?: boolean;

  @IsOptional()
  @IsBoolean()
  eatsLunch?: boolean;

  @IsOptional()
  @IsBoolean()
  eatsDinner?: boolean;

  @IsOptional()
  @IsBoolean()
  eatsSnack?: boolean;
}

export class CreateFamilyMemberDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsNumber()
  @Min(20)
  @Max(300)
  weight?: number;

  @IsOptional()
  @IsNumber()
  @Min(50)
  @Max(250)
  height?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(120)
  age?: number;

  @IsOptional()
  @IsEnum(Goal)
  goal?: Goal;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allergyIds?: string[];

  @IsOptional()
  @IsBoolean()
  eatsBreakfast?: boolean;

  @IsOptional()
  @IsBoolean()
  eatsLunch?: boolean;

  @IsOptional()
  @IsBoolean()
  eatsDinner?: boolean;

  @IsOptional()
  @IsBoolean()
  eatsSnack?: boolean;
}

export class UpdateFamilyMemberDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsNumber()
  @Min(20)
  @Max(300)
  weight?: number;

  @IsOptional()
  @IsNumber()
  @Min(50)
  @Max(250)
  height?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(120)
  age?: number;

  @IsOptional()
  @IsEnum(Goal)
  goal?: Goal;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allergyIds?: string[];

  @IsOptional()
  @IsBoolean()
  eatsBreakfast?: boolean;

  @IsOptional()
  @IsBoolean()
  eatsLunch?: boolean;

  @IsOptional()
  @IsBoolean()
  eatsDinner?: boolean;

  @IsOptional()
  @IsBoolean()
  eatsSnack?: boolean;
}

export class UpdateFamilyBudgetDto {
  @IsNumber()
  @Min(0)
  budgetLimit: number;
}