import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsEnum,
  IsBoolean,
  ValidateNested,
  IsArray,
  IsEmail,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Goal, Gender } from '@prisma/client';

class BaseMemberSettingsDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allergyIds?: string[];


  @IsOptional() @IsBoolean() eatsBreakfast?: boolean;
  @IsOptional() @IsBoolean() eatsLunch?: boolean;
  @IsOptional() @IsBoolean() eatsDinner?: boolean;
  @IsOptional() @IsBoolean() eatsSnack?: boolean;
}

export class OwnerProfileDto extends BaseMemberSettingsDto {
  @IsOptional() @IsNumber() age?: number;
  @IsOptional() @IsNumber() weight?: number;
  @IsOptional() @IsNumber() height?: number;
  @IsOptional() @IsEnum(Goal) goal?: Goal;
}

export class FamilyMemberDto extends BaseMemberSettingsDto {}

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsNumber()
  budgetLimit?: number;

  @ValidateNested()
  @Type(() => OwnerProfileDto)
  ownerProfile: OwnerProfileDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FamilyMemberDto)
  familyMembers?: FamilyMemberDto[];
}