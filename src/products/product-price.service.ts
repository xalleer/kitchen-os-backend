// src/products/product-price.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductPriceService {
  private readonly logger = new Logger(ProductPriceService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Записати ціну від користувача та оновити статистику продукту
   */
  async recordUserPrice(
    productId: string,
    familyId: string,
    price: number,
    quantity: number,
    baseUnit: string,
    standardAmount?: number | null,
    userId?: string,
    retailer?: string,
    region?: string,
  ) {
    const baseAmount =
      typeof standardAmount === 'number' && Number.isFinite(standardAmount) && standardAmount > 0
        ? standardAmount
        : baseUnit === 'G' || baseUnit === 'ML'
          ? 1000
          : 1;

    // 1. Записуємо ціну користувача
    await this.prisma.userProductPrice.create({
      data: {
        productId,
        familyId,
        userId,
        price,
        quantity,
        totalCost: (price * quantity) / baseAmount,
        retailer: retailer || 'Невідомо',
        region: region || 'Україна',
      },
    });

    // 2. Оновлюємо статистику продукту
    await this.updateProductPriceStats(productId);

    this.logger.log(
      `💰 Записано ціну: ${price}₴ для продукту ${productId} від сім'ї ${familyId}`,
    );
  }

  /**
   * Перерахувати статистику цін для продукту
   */
  async updateProductPriceStats(productId: string) {
    // Беремо ціни за останні 90 днів
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const priceStats = await this.prisma.userProductPrice.aggregate({
      where: {
        productId,
        createdAt: {
          gte: ninetyDaysAgo,
        },
      },
      _avg: { price: true },
      _min: { price: true },
      _max: { price: true },
      _count: true,
    });

    if (!priceStats._count) {
      return;
    }

    // Отримуємо останню ціну
    const lastPrice = await this.prisma.userProductPrice.findFirst({
      where: { productId },
      orderBy: { createdAt: 'desc' },
      select: { price: true },
    });

    // Оновлюємо Product
    await this.prisma.product.update({
      where: { id: productId },
      data: {
        averagePrice: priceStats._avg.price ?? undefined,
        minPrice: priceStats._min.price,
        maxPrice: priceStats._max.price,
        lastPrice: lastPrice?.price,
        priceSamplesCount: priceStats._count,
        priceUpdatedAt: new Date(),
      },
    });

    this.logger.log(
      `📊 Оновлено статистику для продукту ${productId}: avg=${priceStats._avg.price?.toFixed(2)}₴, min=${priceStats._min.price}₴, max=${priceStats._max.price}₴`,
    );
  }

  /**
   * Отримати статистику цін для продукту
   */
  async getProductPriceStats(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        averagePrice: true,
        minPrice: true,
        maxPrice: true,
        lastPrice: true,
        priceSamplesCount: true,
        priceUpdatedAt: true,
      },
    });

    if (!product) {
      return null;
    }

    // Останні 10 цін
    const recentPrices = await this.prisma.userProductPrice.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        price: true,
        quantity: true,
        retailer: true,
        region: true,
        createdAt: true,
      },
    });

    // Розбивка по магазинах
    const byRetailer = await this.prisma.userProductPrice.groupBy({
      by: ['retailer'],
      where: {
        productId,
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
      _avg: { price: true },
      _count: true,
    });

    return {
      product: {
        id: product.id,
        name: product.name,
      },
      stats: {
        averagePrice: product.averagePrice,
        minPrice: product.minPrice,
        maxPrice: product.maxPrice,
        lastPrice: product.lastPrice,
        samplesCount: product.priceSamplesCount,
        lastUpdated: product.priceUpdatedAt,
      },
      recentPrices,
      byRetailer: byRetailer.map((r) => ({
        retailer: r.retailer,
        averagePrice: r._avg.price,
        samplesCount: r._count,
      })),
    };
  }

  /**
   * Отримати розрахункову ціну для певної кількості
   */
  getEstimatedPrice(
    averagePrice: number,
    quantity: number,
    baseUnit: string,
    standardAmount?: number | null,
  ): number {
    const baseAmount =
      typeof standardAmount === 'number' && Number.isFinite(standardAmount) && standardAmount > 0
        ? standardAmount
        : baseUnit === 'G' || baseUnit === 'ML'
          ? 1000
          : 1;
    return (quantity / baseAmount) * averagePrice;
  }
}