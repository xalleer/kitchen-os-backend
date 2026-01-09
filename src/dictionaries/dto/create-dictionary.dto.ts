import { IsString, IsNotEmpty, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class AllergyItemDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  slug: string;
}

export class CreateAllergiesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AllergyItemDto)
  allergies: AllergyItemDto[];
}
