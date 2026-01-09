import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateProductDto,
  UpdateProductDto,
  GetProductsQueryDto,
} from './dto/products.dto';
import { Unit } from '@prisma/client';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async seedProducts(products: CreateProductDto[]) {
    let created = 0;
    let skipped = 0;

    for (const product of products) {
      try {
        await this.prisma.product.create({ data: product });
        created++;
      } catch (e: any) {
        if (e.code === 'P2002') {
          skipped++;
        } else {
          throw e;
        }
      }
    }

    return { created, skipped, total: products.length };
  }

  async getProducts(query: GetProductsQueryDto) {
    const { search, category, baseUnit, page = 1, limit = 50 } = query;

    const where: any = {
      familyMemberId: null,
    };

    if (search) {
      where.name = {
        contains: search,
        mode: 'insensitive',
      };
    }

    if (category) {
      where.category = category;
    }

    if (baseUnit) {
      where.baseUnit = baseUnit;
    }

    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          category: true,
          baseUnit: true,
          caloriesPer100: true,
          standardAmount: true,
          image: true
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      products,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getProductById(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        category: true,
        baseUnit: true,
        caloriesPer100: true,
        standardAmount: true,
        familyMemberId: true,
        image: true
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async createProduct(dto: CreateProductDto) {
    const existingProduct = await this.prisma.product.findUnique({
      where: { name: dto.name },
    });

    if (existingProduct) {
      throw new BadRequestException('Product with this name already exists');
    }

    const product = await this.prisma.product.create({
      data: {
        name: dto.name,
        category: dto.category,
        baseUnit: dto.baseUnit,
        caloriesPer100: dto.caloriesPer100,
        standardAmount: dto.standardAmount,
      },
      select: {
        id: true,
        name: true,
        category: true,
        baseUnit: true,
        caloriesPer100: true,
        standardAmount: true,
      },
    });

    return product;
  }

  async updateProduct(productId: string, dto: UpdateProductDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.familyMemberId) {
      throw new ForbiddenException('Cannot update user-specific product');
    }

    if (dto.name) {
      const existingProduct = await this.prisma.product.findUnique({
        where: { name: dto.name },
      });

      if (existingProduct && existingProduct.id !== productId) {
        throw new BadRequestException('Product with this name already exists');
      }
    }

    const updatedProduct = await this.prisma.product.update({
      where: { id: productId },
      data: dto,
      select: {
        id: true,
        name: true,
        category: true,
        baseUnit: true,
        caloriesPer100: true,
        standardAmount: true,
      },
    });

    return updatedProduct;
  }

  async deleteProduct(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        inventoryItems: true,
        shoppingItems: true,
        recipeIngredients: true,
      },
    });


    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.familyMemberId) {
      throw new ForbiddenException('Cannot delete user-specific product');
    }

    if (
      product.inventoryItems.length > 0 ||
      product.shoppingItems.length > 0 ||
      product.recipeIngredients.length > 0
    ) {
      throw new BadRequestException(
        'Cannot delete product that is used in inventory, shopping lists, or recipes',
      );
    }

    await this.prisma.product.delete({
      where: { id: productId },
    });

    return { message: 'Product deleted successfully' };
  }

  async getCategories() {
    const categories = await this.prisma.product.findMany({
      where: {
        category: { not: null },
        familyMemberId: null,
      },
      select: {
        category: true,
      },
      distinct: ['category'],
      orderBy: {
        category: 'asc',
      },
    });

    return categories
      .map((p) => p.category)
      .filter((c): c is string => c !== null);
  }
}