// src/products/products.controller.ts - ОНОВЛЕНО

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductPriceService } from './product-price.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CreateProductDto,
  UpdateProductDto,
  GetProductsQueryDto,
} from './dto/products.dto';

@Controller('products')
@UseGuards(JwtAuthGuard)
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly productPriceService: ProductPriceService,
  ) {}

  /**
   * ⭐ НОВЕ: Seed базового каталогу
   */
  @Post('seed-basic')
  @HttpCode(HttpStatus.OK)
  async seedBasic() {
    return this.productsService.seedBasicCatalog();
  }

  @Get()
  getProducts(@Query() query: GetProductsQueryDto) {
    return this.productsService.getProducts(query);
  }

  @Get('categories')
  getCategories() {
    return this.productsService.getCategories();
  }

  @Get(':id')
  getProductById(@Param('id') id: string) {
    return this.productsService.getProductById(id);
  }

  /**
   * ⭐ НОВЕ: Отримати статистику цін для продукту
   */
  @Get(':id/price-stats')
  getPriceStats(@Param('id') id: string) {
    return this.productPriceService.getProductPriceStats(id);
  }

  /**
   * ⭐ ОНОВЛЕНО: Створити продукт (тепер з усіма полями)
   */
  @Post()
  createProduct(@Body() dto: CreateProductDto) {
    return this.productsService.createProduct(dto);
  }

  @Patch(':id')
  updateProduct(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.updateProduct(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  deleteProduct(@Param('id') id: string) {
    return this.productsService.deleteProduct(id);
  }
}