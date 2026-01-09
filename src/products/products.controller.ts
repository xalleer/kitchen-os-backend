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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CreateProductDto,
  UpdateProductDto,
  GetProductsQueryDto,
} from './dto/products.dto';

@Controller('products')
@UseGuards(JwtAuthGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

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

  @Post('seed')
  async seed(@Body() products: CreateProductDto[]) {
    return this.productsService.seedProducts(products);
  }
}