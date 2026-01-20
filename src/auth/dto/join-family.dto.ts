import { IsString, IsEmail, IsOptional, IsNumber, IsEnum } from 'class-validator';
import { Goal } from '@prisma/client';

export class JoinFamilyDto {
  @IsString()
  inviteCode: string;

  @IsEmail()
  email: string;

  @IsString()
  password: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  weight?: number;

  @IsOptional()
  @IsNumber()
  height?: number;

  @IsOptional()
  @IsNumber()
  age?: number;

  @IsOptional()
  @IsEnum(Goal)
  goal?: Goal;
}
