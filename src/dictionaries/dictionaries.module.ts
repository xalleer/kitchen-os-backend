import { Module } from '@nestjs/common';
import { DictionariesService } from './dictionaries.service';
import { DictionariesController } from './dictionaries.controller';

@Module({
  controllers: [DictionariesController],
  providers: [DictionariesService],
})
export class DictionariesModule {}
