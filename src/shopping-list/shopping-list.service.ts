import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Unit } from '@prisma/client';

export interface ProductRequirement {
  productId: string;
  productName: string;
  totalRequired: number;
  inInventory: number;
  needToBuy: number;
  baseUnit: Unit;
  estimatedPrice?: number;
}

export interface ShoppingListItemWithProduct {
  id: string;
  familyId: string;
  productId: string;
  quantity: number;
  isBought: boolean;
  manualNote: string | null;
  product: {
    id: string;
    name: string;
    category: string | null;
    baseUnit: Unit;
    image: string | null;
  };
}


@Injectable()
export class ShoppingListService {
  constructor(private prisma: PrismaService) {}

  /**
   * Згенерувати список покупок на основі meal plan
   */
  async generateShoppingList(familyId: string, startDate?: Date, endDate?: Date) {
    // 1. Отримуємо meal plans
    const where: any = { familyId };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = startDate;
      if (endDate) where.date.lte = endDate;
    } else {
      // За замовчуванням - на тиждень від сьогодні
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weekLater = new Date(today);
      weekLater.setDate(today.getDate() + 7);

      where.date = {
        gte: today,
        lt: weekLater,
      };
    }

    const mealPlans = await this.prisma.mealPlan.findMany({
      where,
      include: {
        recipe: {
          include: {
            ingredients: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });

    if (mealPlans.length === 0) {
      throw new BadRequestException('No meal plans found for the selected period');
    }

    // 2. Збираємо всі інгредієнти та групуємо по продуктах
    const productRequirements = new Map<string, ProductRequirement>();

    for (const mealPlan of mealPlans) {
      for (const ingredient of mealPlan.recipe.ingredients) {
        const productId = ingredient.productId;
        const existing = productRequirements.get(productId);

        if (existing) {
          existing.totalRequired += ingredient.amount;
        } else {
          productRequirements.set(productId, {
            productId,
            productName: ingredient.product.name,
            totalRequired: ingredient.amount,
            inInventory: 0,
            needToBuy: 0,
            baseUnit: ingredient.product.baseUnit,
            estimatedPrice: 0,
          });
        }
      }
    }

    // 3. Перевіряємо що є в інвентарі
    const inventoryItems = await this.prisma.inventoryItem.findMany({
      where: { familyId },
      include: { product: true },
    });

    const inventoryMap = new Map<string, number>();
    for (const item of inventoryItems) {
      const existing = inventoryMap.get(item.productId) || 0;
      inventoryMap.set(item.productId, existing + item.quantity);
    }

    // 4. Розраховуємо що треба купити
    const shoppingItems: ProductRequirement[] = [];

    for (const req of productRequirements.values()) {
      const inInventory = inventoryMap.get(req.productId) || 0;
      req.inInventory = inInventory;

      const needToBuy = req.totalRequired - inInventory;

      if (needToBuy > 0) {
        req.needToBuy = needToBuy;

        // Розраховуємо стандартну тару
        const standardAmount = this.calculateStandardAmount(needToBuy, req.baseUnit);
        req.needToBuy = standardAmount;

        // Оцінюємо ціну
        req.estimatedPrice = this.estimatePrice(req.productName, standardAmount, req.baseUnit);

        shoppingItems.push(req);
      }
    }

    // 5. Очищаємо старий список покупок
    await this.prisma.shoppingListItem.deleteMany({
      where: { familyId },
    });

    // 6. Зберігаємо новий список
    const savedItems: ShoppingListItemWithProduct[] = [];
    for (const item of shoppingItems) {
      const saved = await this.prisma.shoppingListItem.create({
        data: {
          familyId,
          productId: item.productId,
          quantity: item.needToBuy,
          isBought: false,
          manualNote: null,
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              category: true,
              baseUnit: true,
              image: true,
            },
          },
        },
      });
      savedItems.push(saved);
    }

    // 7. Підраховуємо загальну вартість
    const totalEstimatedCost = shoppingItems.reduce(
      (sum, item) => sum + (item.estimatedPrice || 0),
      0,
    );

    const family = await this.prisma.family.findUnique({
      where: { id: familyId },
      select: { budgetLimit: true },
    });

    return {
      items: savedItems,
      summary: {
        totalItems: savedItems.length,
        estimatedCost: Math.round(totalEstimatedCost),
        budgetLimit: Number(family?.budgetLimit || 0),
        withinBudget: totalEstimatedCost <= Number(family?.budgetLimit || 0),
      },
      groupedByCategory: this.groupByCategory(savedItems),
    };
  }

  /**
   * Отримати поточний список покупок
   */
  async getShoppingList(familyId: string) {
    const items = await this.prisma.shoppingListItem.findMany({
      where: { familyId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            category: true,
            baseUnit: true,
            image: true,
          },
        },
      },
      orderBy: [
        { isBought: 'asc' },
        { product: { category: 'asc' } },
        { product: { name: 'asc' } },
      ],
    });

    const estimatedCost = items.reduce((sum, item) => {
      const price = this.estimatePrice(
        item.product.name,
        item.quantity,
        item.product.baseUnit,
      );
      return sum + price;
    }, 0);

    const family = await this.prisma.family.findUnique({
      where: { id: familyId },
      select: { budgetLimit: true },
    });

    return {
      items,
      summary: {
        totalItems: items.length,
        boughtItems: items.filter((i) => i.isBought).length,
        remainingItems: items.filter((i) => !i.isBought).length,
        estimatedCost: Math.round(estimatedCost),
        budgetLimit: Number(family?.budgetLimit || 0),
      },
      groupedByCategory: this.groupByCategory(items),
    };
  }

  /**
   * Оновити item в списку покупок
   */
  async updateShoppingItem(
    familyId: string,
    itemId: string,
    quantity: number,
    manualNote?: string,
  ) {
    const item = await this.prisma.shoppingListItem.findFirst({
      where: { id: itemId, familyId },
    });

    if (!item) {
      throw new NotFoundException('Shopping list item not found');
    }

    const updated = await this.prisma.shoppingListItem.update({
      where: { id: itemId },
      data: {
        quantity,
        manualNote,
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            category: true,
            baseUnit: true,
            image: true,
          },
        },
      },
    });

    return updated;
  }

  /**
   * Відмітити продукт як куплений
   */
  async markAsBought(familyId: string, itemId: string, isBought: boolean) {
    const item = await this.prisma.shoppingListItem.findFirst({
      where: { id: itemId, familyId },
    });

    if (!item) {
      throw new NotFoundException('Shopping list item not found');
    }

    const updated = await this.prisma.shoppingListItem.update({
      where: { id: itemId },
      data: { isBought },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            category: true,
            baseUnit: true,
            image: true,
          },
        },
      },
    });

    return updated;
  }

  /**
   * Видалити item зі списку покупок
   */
  async deleteShoppingItem(familyId: string, itemId: string) {
    const item = await this.prisma.shoppingListItem.findFirst({
      where: { id: itemId, familyId },
    });

    if (!item) {
      throw new NotFoundException('Shopping list item not found');
    }

    await this.prisma.shoppingListItem.delete({
      where: { id: itemId },
    });

    return { message: 'Item removed from shopping list' };
  }

  /**
   * Завершити покупки - додати все до інвентаря
   */
  async completeShopping(familyId: string) {
    const boughtItems = await this.prisma.shoppingListItem.findMany({
      where: {
        familyId,
        isBought: true,
      },
      include: { product: true },
    });

    if (boughtItems.length === 0) {
      throw new BadRequestException('No items marked as bought');
    }

    // Додаємо куплені продукти до інвентаря
    for (const item of boughtItems) {
      // Перевіряємо чи вже є такий продукт в інвентарі (без терміну придатності)
      const existingItem = await this.prisma.inventoryItem.findFirst({
        where: {
          familyId,
          productId: item.productId,
          expiryDate: null,
        },
      });

      if (existingItem) {
        // Якщо є - збільшуємо кількість
        await this.prisma.inventoryItem.update({
          where: { id: existingItem.id },
          data: {
            quantity: existingItem.quantity + item.quantity,
          },
        });
      } else {
        // Якщо немає - створюємо новий
        await this.prisma.inventoryItem.create({
          data: {
            familyId,
            productId: item.productId,
            quantity: item.quantity,
            expiryDate: null,
          },
        });
      }
    }

    // Видаляємо куплені items зі списку
    await this.prisma.shoppingListItem.deleteMany({
      where: {
        familyId,
        isBought: true,
      },
    });

    return {
      message: 'Shopping completed successfully',
      addedToInventory: boughtItems.length,
      products: boughtItems.map((item) => ({
        name: item.product.name,
        quantity: item.quantity,
        unit: item.product.baseUnit,
      })),
    };
  }

  /**
   * Додати продукт вручну до списку покупок
   */
  async addManualItem(
    familyId: string,
    productId: string,
    quantity: number,
    note?: string,
  ) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Перевіряємо чи вже є такий продукт в списку
    const existing = await this.prisma.shoppingListItem.findFirst({
      where: {
        familyId,
        productId,
      },
    });

    let item;

    if (existing) {
      // Якщо є - збільшуємо кількість
      item = await this.prisma.shoppingListItem.update({
        where: { id: existing.id },
        data: {
          quantity: existing.quantity + quantity,
          manualNote: note,
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              category: true,
              baseUnit: true,
              image: true,
            },
          },
        },
      });
    } else {
      // Якщо немає - створюємо новий
      item = await this.prisma.shoppingListItem.create({
        data: {
          familyId,
          productId,
          quantity,
          isBought: false,
          manualNote: note,
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              category: true,
              baseUnit: true,
              image: true,
            },
          },
        },
      });
    }

    return item;
  }

  /**
   * Очистити весь список покупок
   */
  async clearShoppingList(familyId: string) {
    await this.prisma.shoppingListItem.deleteMany({
      where: { familyId },
    });

    return { message: 'Shopping list cleared' };
  }

  // ==================== HELPER METHODS ====================

  /**
   * Розрахувати стандартну тару для продукту
   */
  private calculateStandardAmount(needed: number, unit: Unit): number {
    switch (unit) {
      case 'ML':
        // Молоко, соки - стандартні пакування
        if (needed <= 200) return 200;
        if (needed <= 500) return 500;
        if (needed <= 900) return 1000;
        if (needed <= 1500) return 2000;
        return Math.ceil(needed / 1000) * 1000;

      case 'G':
        // Сипучі продукти, м'ясо
        if (needed <= 100) return 100;
        if (needed <= 200) return 200;
        if (needed <= 500) return 500;
        if (needed <= 1000) return 1000;
        return Math.ceil(needed / 1000) * 1000;

      case 'PCS':
        // Штучні товари - округляємо вгору
        return Math.ceil(needed);

      default:
        return Math.ceil(needed);
    }
  }

  /**
   * Оцінити ціну продукту (базові ціни)
   */
  private estimatePrice(productName: string, quantity: number, unit: Unit): number {
    const name = productName.toLowerCase();

    // Базові ціни за 100г/100мл/1шт (в грн)
    let pricePerUnit = 0;

    // М'ясо та риба
    if (name.includes('курка') || name.includes('куряч')) pricePerUnit = 1.2;
    else if (name.includes('свинина')) pricePerUnit = 1.8;
    else if (name.includes('яловичина')) pricePerUnit = 2.5;
    else if (name.includes('риба')) pricePerUnit = 2.0;

    // Молочні продукти
    else if (name.includes('молоко')) pricePerUnit = 0.35;
    else if (name.includes('сир твердий')) pricePerUnit = 2.5;
    else if (name.includes('сметана')) pricePerUnit = 0.8;
    else if (name.includes('йогурт')) pricePerUnit = 0.6;
    else if (name.includes('масло')) pricePerUnit = 3.0;

    // Овочі
    else if (name.includes('картопля')) pricePerUnit = 0.15;
    else if (name.includes('морква')) pricePerUnit = 0.2;
    else if (name.includes('цибуля')) pricePerUnit = 0.2;
    else if (name.includes('капуста')) pricePerUnit = 0.25;
    else if (name.includes('помідор')) pricePerUnit = 0.6;
    else if (name.includes('огірок')) pricePerUnit = 0.5;

    // Фрукти
    else if (name.includes('яблуко')) pricePerUnit = 0.4;
    else if (name.includes('банан')) pricePerUnit = 0.5;
    else if (name.includes('апельсин')) pricePerUnit = 0.6;

    // Крупи та макарони
    else if (name.includes('рис')) pricePerUnit = 0.4;
    else if (name.includes('гречка')) pricePerUnit = 0.5;
    else if (name.includes('макарон')) pricePerUnit = 0.35;
    else if (name.includes('вівсян')) pricePerUnit = 0.3;

    // Яйця (за десяток)
    else if (name.includes('яйц')) {
      const dozens = Math.ceil(quantity / 10);
      return dozens * 50;
    }

    // Хліб
    else if (name.includes('хліб')) pricePerUnit = 20;

    // Олія
    else if (name.includes('олія')) pricePerUnit = 0.7;

    // Борошно
    else if (name.includes('борошно')) pricePerUnit = 0.25;

    // Цукор
    else if (name.includes('цукор')) pricePerUnit = 0.3;

    // Сіль
    else if (name.includes('сіль')) pricePerUnit = 0.1;

    // За замовчуванням
    else pricePerUnit = 0.5;

    // Розраховуємо ціну залежно від одиниці виміру
    if (unit === 'G' || unit === 'ML') {
      return (quantity / 100) * pricePerUnit;
    } else if (unit === 'PCS') {
      return quantity * pricePerUnit;
    }

    return quantity * pricePerUnit;
  }

  /**
   * Групувати продукти по категоріях
   */
  private groupByCategory(items: any[]) {
    const grouped: Record<string, any[]> = {};

    for (const item of items) {
      const category = item.product.category || 'Інше';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(item);
    }

    return grouped;
  }
}