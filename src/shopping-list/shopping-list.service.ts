import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Unit } from '@prisma/client';

type BoughtShoppingListItem = {
  id: string;
  quantity: number;
  actualPrice: number | null;
  estimatedPrice: number | null;
  boughtAt: Date | null;
  product: {
    name: string;
    baseUnit: Unit;
    standardAmount: number | null;
  };
};

type BoughtShoppingListItemWithFullProduct = {
  id: string;
  productId: string;
  quantity: number;
  actualPrice: number | null;
  estimatedPrice: number | null;
  boughtAt: Date | null;
  product: {
    id: string;
    name: string;
    category: string | null;
    baseUnit: Unit;
    caloriesPer100: number | null;
    price: number | null;
    image: string | null;
    standardAmount: number | null;
    familyMemberId: string | null;
  };
};

export interface ProductRequirement {
  productId: string;
  productName: string;
  totalRequired: number;
  inInventory: number;
  needToBuy: number;
  baseUnit: Unit;
  estimatedPrice?: number;
  pricePerUnit?: number | null;
  standardAmount?: number | null;
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
    averagePrice?: number | null;
    standardAmount?: number | null;
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
            pricePerUnit: ingredient.product.averagePrice,
            standardAmount: ingredient.product.standardAmount,
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

        const packagingAmount =
          typeof req.standardAmount === 'number' && Number.isFinite(req.standardAmount) && req.standardAmount > 0
            ? req.standardAmount
            : this.calculateStandardAmount(needToBuy, req.baseUnit);
        req.needToBuy = packagingAmount;

        // Оцінюємо ціну
        req.estimatedPrice = this.estimatePrice(
          req.pricePerUnit ?? null,
          packagingAmount,
          req.baseUnit,
          req.standardAmount ?? null,
        );

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
          estimatedPrice: item.estimatedPrice || 0,
          manualNote: null,
        },
        include: {
          product: {
            select: {
              id: true,
        name: true,
        category: true,
        baseUnit: true,
        averagePrice: true, 
        standardAmount: true,
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
        averagePrice: true, // ⭐ ВИПРАВЛЕНО
        standardAmount: true,
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
  const price =
    item.estimatedPrice ??
    this.estimatePrice(
      item.product.averagePrice ?? null, // ⭐ ВИПРАВЛЕНО
      item.quantity, 
      item.product.baseUnit,
      item.product.standardAmount ?? null,
    );
  return sum + (price || 0);
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

  async getBudgetSummary(familyId: string, startDate?: Date, endDate?: Date) {
    const family = await this.prisma.family.findUnique({
      where: { id: familyId },
      select: { budgetLimit: true },
    });

    if (!family) {
      throw new NotFoundException('Family not found');
    }

    const where: any = {
      familyId,
      isBought: true,
    };

    if (startDate || endDate) {
      if (startDate && Number.isNaN(startDate.getTime())) {
        throw new BadRequestException('Invalid startDate');
      }
      if (endDate && Number.isNaN(endDate.getTime())) {
        throw new BadRequestException('Invalid endDate');
      }
      where.boughtAt = {};
      if (startDate) where.boughtAt.gte = startDate;
      if (endDate) where.boughtAt.lte = endDate;
    }

    const boughtItems = (await this.prisma.shoppingListItem.findMany({
      where,
      select: {
        id: true,
        quantity: true,
        actualPrice: true,
        estimatedPrice: true,
        boughtAt: true,
        product: {
          select: {
            name: true,
            baseUnit: true,
            standardAmount: true,
          },
        },
      },
    } as any)) as unknown as BoughtShoppingListItem[];

    const spent = boughtItems.reduce((sum, item) => {
      const price =
        item.actualPrice ??
        item.estimatedPrice ??
        this.estimatePrice(null, item.quantity, item.product.baseUnit, item.product.standardAmount);
      return sum + (price || 0);
    }, 0);

    const budgetLimit = Number(family.budgetLimit || 0);
    const spentRounded = Math.round(spent);
    const remaining = Math.round(budgetLimit - spent);

    return {
      budgetLimit,
      spent: spentRounded,
      remaining,
      withinBudget: spent <= budgetLimit,
      period: {
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString(),
      },
      itemsCount: boughtItems.length,
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
        averagePrice: true, // ⭐ ВИПРАВЛЕНО
        standardAmount: true,
        image: true,
          },
        },
      },
    });

    return updated;
  }

  /**
   * Відмітити продукт як куплений з можливістю вказати фактичну ціну
   */
  async markAsBought(
    familyId: string,
    itemId: string,
    isBought: boolean,
    actualPrice?: number,
  ) {
    const item = await this.prisma.shoppingListItem.findFirst({
      where: { id: itemId, familyId },
    });

    if (!item) {
      throw new NotFoundException('Shopping list item not found');
    }

    const updateData: {
      isBought: boolean;
      boughtAt?: Date | null;
      actualPrice?: number;
    } = { isBought };

    if (isBought) {
      updateData.boughtAt = new Date();
      if (actualPrice !== undefined) {
        updateData.actualPrice = actualPrice;
      }
    } else {
      updateData.boughtAt = null;
    }

    const updated = await this.prisma.shoppingListItem.update({
      where: { id: itemId },
      data: updateData,
      include: {
        product: {
          select: {
            id: true,
        name: true,
        category: true,
        baseUnit: true,
        averagePrice: true, // ⭐ ВИПРАВЛЕНО
        standardAmount: true,
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
    const boughtItems = (await this.prisma.shoppingListItem.findMany({
      where: {
        familyId,
        isBought: true,
      },
      include: { product: true },
    } as any)) as unknown as BoughtShoppingListItemWithFullProduct[];

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

    // Підраховуємо бюджет
    const totalEstimated = boughtItems.reduce(
      (sum, item) => sum + (item.estimatedPrice || 0),
      0,
    );
    const totalActual = boughtItems.reduce(
      (sum, item) => sum + (item.actualPrice || item.estimatedPrice || 0),
      0,
    );

    return {
      message: 'Shopping completed successfully',
      addedToInventory: boughtItems.length,
      products: boughtItems.map((item) => ({
        name: item.product.name,
        quantity: item.quantity,
        unit: item.product.baseUnit,
        estimatedPrice: item.estimatedPrice,
        actualPrice: item.actualPrice,
      })),
      budget: {
        estimated: Math.round(totalEstimated),
        actual: Math.round(totalActual),
        difference: Math.round(totalActual - totalEstimated),
        savedMoney: totalActual < totalEstimated,
      },
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
        averagePrice: true, // ⭐ ВИПРАВЛЕНО
        standardAmount: true,
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
        averagePrice: true, // ⭐ ВИПРАВЛЕНО
        standardAmount: true,
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
  private estimatePrice(
    pricePerUnit: number | null,
    quantity: number,
    unit: Unit,
    standardAmount?: number | null,
  ): number {
    const p = typeof pricePerUnit === 'number' && Number.isFinite(pricePerUnit) ? pricePerUnit : 0;
    const baseAmount =
      typeof standardAmount === 'number' && Number.isFinite(standardAmount) && standardAmount > 0
        ? standardAmount
        : unit === 'G' || unit === 'ML'
          ? 1000
          : 1;
    return (quantity / baseAmount) * p;
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