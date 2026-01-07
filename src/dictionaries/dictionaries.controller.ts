import { Body, Controller, Get, Post } from '@nestjs/common';
import { DictionariesService } from './dictionaries.service';
import { CreateAllergiesDto } from './dto/create-dictionary.dto';

@Controller('dictionaries')
export class DictionariesController {
  constructor(private readonly dictionariesService: DictionariesService) {}

  @Post('allergies')
  addAllergies(@Body() dto: CreateAllergiesDto) {
    return this.dictionariesService.addAllergies(dto);
  }

  @Get('allergies')
  getAllergies() {
    return this.dictionariesService.getAllergies();
  }

}