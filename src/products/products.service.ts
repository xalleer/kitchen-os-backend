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
import { BASIC_PRODUCTS_CATALOG } from './data/basic-products.catalog';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  /**
   * ⭐ НОВЕ: Seed базового каталогу продуктів
   */
  async seedBasicCatalog() {
    let created = 0;
    let updated = 0;

    for (const item of BASIC_PRODUCTS_CATALOG) {
      const result = await this.prisma.product.upsert({
        where: { name: item.name },
        create: {
          name: item.name,
          category: item.category,
          baseUnit: item.baseUnit,
          averagePrice: item.averagePrice,
          caloriesPer100: item.caloriesPer100,
          standardAmount: item.standardAmount,
          image: item.image,
          // Початкова статистика
          minPrice: item.averagePrice,
          maxPrice: item.averagePrice,
          lastPrice: item.averagePrice,
          priceSamplesCount: 1,
        },
        update: {
          category: item.category,
          baseUnit: item.baseUnit,
          caloriesPer100: item.caloriesPer100,
          standardAmount: item.standardAmount,
          image: item.image,
        },
        select: { createdAt: true },
      });

      if (result.createdAt.getTime() >= Date.now() - 5_000) {
        created++;
      } else {
        updated++;
      }
    }

    return {
      success: true,
      created,
      skipped: 0,
      updated,
      total: BASIC_PRODUCTS_CATALOG.length,
      message: `Створено ${created} продуктів, оновлено ${updated}`,
    };
  }

  /**
   * Отримати список продуктів з пошуком та фільтрацією
   */
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
          averagePrice: true,
          minPrice: true,
          maxPrice: true,
          lastPrice: true,
          priceSamplesCount: true,
          standardAmount: true,
          image: true,
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

  /**
   * Отримати продукт за ID
   */
  async getProductById(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        category: true,
        baseUnit: true,
        caloriesPer100: true,
        averagePrice: true,
        minPrice: true,
        maxPrice: true,
        lastPrice: true,
        priceSamplesCount: true,
        priceUpdatedAt: true,
        standardAmount: true,
        familyMemberId: true,
        image: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  /**
   * ⭐ ОНОВЛЕНО: Створити продукт (тепер з усіма полями!)
   */
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
        averagePrice: dto.averagePrice,
        minPrice: dto.averagePrice,
        maxPrice: dto.averagePrice,
        lastPrice: dto.averagePrice,
        priceSamplesCount: 1,
        standardAmount: dto.standardAmount,
        image: dto.image,
      },
      select: {
        id: true,
        name: true,
        category: true,
        baseUnit: true,
        caloriesPer100: true,
        averagePrice: true,
        standardAmount: true,
      },
    });

    return product;
  }

  /**
   * Оновити продукт
   */
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
        averagePrice: true,
        standardAmount: true,
      },
    });

    return updatedProduct;
  }

  /**
   * Видалити продукт
   */
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

  /**
   * Отримати категорії
   */
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

  /**
   * ⭐ ДОДАНО: Метод для імпорту (для сумісності)
   */
  async seedProducts(products: CreateProductDto[]) {
    let created = 0;
    let updated = 0;

    for (const product of products) {
      const upserted = await this.prisma.product.upsert({
        where: { name: product.name },
        create: {
          name: product.name,
          category: product.category,
          baseUnit: product.baseUnit,
          averagePrice: product.averagePrice,
          minPrice: product.averagePrice,
          maxPrice: product.averagePrice,
          lastPrice: product.averagePrice,
          priceSamplesCount: 1,
          caloriesPer100: product.caloriesPer100,
          standardAmount: product.standardAmount,
          image: product.image,
        },
        update: {
          category: product.category,
          baseUnit: product.baseUnit,
          caloriesPer100: product.caloriesPer100,
          standardAmount: product.standardAmount,
          image: product.image,
        },
        select: { createdAt: true },
      });

      if (upserted.createdAt.getTime() >= Date.now() - 5_000) {
        created++;
      } else {
        updated++;
      }
    }

    return { created, skipped: 0, updated, total: products.length };
  }
}