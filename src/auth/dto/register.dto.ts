import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  IsNumber,
  IsEnum,
  IsOptional,
  IsArray,
  IsBoolean
} from 'class-validator';
import { Goal } from '@prisma/client';

export class RegisterDto {
  @IsEmail({}, { message: 'Incorrect email' })
  @IsNotEmpty()
  email: string;

  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  @IsOptional()
  age?: number;

  @IsNumber()
  @IsNotEmpty({ message: 'Weight is required' })
  weight: number;

  @IsNumber()
  @IsNotEmpty({ message: 'Height is required' })
  height: number;

  @IsEnum(Goal, { message: 'Invalid goal selected' })
  @IsNotEmpty()
  goal: Goal;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  allergies?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  dislikedProducts?: string[];

  @IsBoolean()
  @IsOptional()
  eatsBreakfast?: boolean;

  @IsBoolean()
  @IsOptional()
  eatsLunch?: boolean;

  @IsBoolean()
  @IsOptional()
  eatsDinner?: boolean;

  @IsBoolean()
  @IsOptional()
  eatsSnack?: boolean;
}