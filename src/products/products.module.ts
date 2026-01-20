import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { ProductsImportService } from './products-import.service';
import { ProductsImportTask } from './products-import.task';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule],
  controllers: [ProductsController],
  providers: [ProductsService, ProductsImportService, ProductsImportTask],
})
export class ProductsModule {}
