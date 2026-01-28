import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { ProductPriceService } from './product-price.service';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService, ProductPriceService],
  exports: [ProductsService, ProductPriceService],
})
export class ProductsModule {}
