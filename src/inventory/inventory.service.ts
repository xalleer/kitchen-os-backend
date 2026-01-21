import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WeeklyBudgetService } from '../weekly-budget/weekly-budget.service';
import {
  AddToInventoryDto,
  UpdateInventoryItemDto,
  RemoveFromInventoryDto,
} from './dto/inventory.dto';
import { ProductPriceService } from '../products/product-price.service';

@Injectable()
export class InventoryService {
  constructor(
    private prisma: PrismaService,
    private weeklyBudgetService: WeeklyBudgetService,
    private readonly productPriceService: ProductPriceService,
  ) {}

  async addToInventory(familyId: string, dto: AddToInventoryDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Розрахунок ціни покупки
    let finalPurchasePrice: number | undefined = undefined;

    if (dto.deductFromBudget) {
      if (dto.purchasePrice !== undefined && dto.purchasePrice > 0) {
        finalPurchasePrice = dto.purchasePrice;
      } else if (product.averagePrice && product.averagePrice > 0) {
        finalPurchasePrice = this.estimatePrice(
          product.averagePrice,
          dto.quantity,
          product.baseUnit,
        );
      } else {
        finalPurchasePrice = 0;
      }
    }

    const existingItem = await this.prisma.inventoryItem.findFirst({
      where: {
        familyId,
        productId: dto.productId,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
      },
    });

    let inventoryItem;

    if (existingItem) {
      inventoryItem = await this.prisma.inventoryItem.update({
        where: { id: existingItem.id },
        data: {
          quantity: existingItem.quantity + dto.quantity,
          deductFromBudget: dto.deductFromBudget ?? existingItem.deductFromBudget,
          purchasePrice:
            finalPurchasePrice !== undefined
              ? (existingItem.purchasePrice || 0) + finalPurchasePrice
              : existingItem.purchasePrice,
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              category: true,
              baseUnit: true,
              averagePrice: true,
            },
          },
        },
      });
    } else {
      inventoryItem = await this.prisma.inventoryItem.create({
        data: {
          familyId,
          productId: dto.productId,
          quantity: dto.quantity,
          expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
          deductFromBudget: dto.deductFromBudget ?? false,
          purchasePrice: finalPurchasePrice,
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              category: true,
              baseUnit: true,
              averagePrice: true,
            },
          },
        },
      });
    }

    // ⭐ НОВЕ: Записати ціну користувача для статистики
    if (dto.purchasePrice && dto.purchasePrice > 0) {
      const pricePerUnit = this.calculatePricePerUnit(
        dto.purchasePrice,
        dto.quantity,
        product.baseUnit,
      );

      await this.productPriceService.recordUserPrice(
        dto.productId,
        familyId,
        pricePerUnit,
        dto.quantity,
        undefined, // userId - можна додати пізніше
        dto.retailer, // ⭐ Додати retailer в DTO
        undefined, // region
      );
    }

    // Вирахування з бюджету
    let budgetUpdate: any = null;
    if (dto.deductFromBudget && finalPurchasePrice && finalPurchasePrice > 0) {
      budgetUpdate = await this.weeklyBudgetService.addExpense(
        familyId,
        finalPurchasePrice,
      );
    }

    return {
      item: inventoryItem,
      budgetUpdate: this.mapBudgetUpdate(budgetUpdate),
    };
  }

  /**
   * ⭐ НОВЕ: Розрахувати ціну за одиницю (для 100г/100мл або за штуку)
   */
  private calculatePricePerUnit(
    totalPrice: number,
    quantity: number,
    baseUnit: string,
  ): number {
    if (baseUnit === 'G' || baseUnit === 'ML') {
      // Ціна за 100г/100мл
      return (totalPrice / quantity) * 100;
    } else if (baseUnit === 'PCS') {
      // Ціна за штуку
      return totalPrice / quantity;
    }
    return totalPrice / quantity;
  }

  /**
   * Helper: Оцінити ціну
   */
  private estimatePrice(
    pricePerUnit: number,
    quantity: number,
    unit: string,
  ): number {
    if (unit === 'G' || unit === 'ML') {
      return (quantity / 100) * pricePerUnit;
    } else if (unit === 'PCS') {
      return quantity * pricePerUnit;
    }
    return quantity * pricePerUnit;
  }

  private mapBudgetUpdate(
    budgetUpdate: Awaited<ReturnType<WeeklyBudgetService['addExpense']>> | null,
  ) {
    if (!budgetUpdate) return null;

    return {
      spent: Number(budgetUpdate.weeklyBudget.spent),
      remaining: Number(budgetUpdate.weeklyBudget.remaining),
      isOverBudget: budgetUpdate.isOverBudget,
    };
  }


  async getInventory(familyId: string) {
    const items = await this.prisma.inventoryItem.findMany({
      where: { familyId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            category: true,
            baseUnit: true,
            caloriesPer100: true,
            image: true,
            averagePrice: true, // ⭐ ДОДАНО для розрахунку
          },
        },
      },
      orderBy: [
        { expiryDate: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    const grouped = items.reduce((acc, item) => {
      const category = item.product.category || 'Інше';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(item);
      return acc;
    }, {} as Record<string, typeof items>);

    return {
      items,
      grouped,
      total: items.length,
    };
  }

  async getInventoryItem(familyId: string, itemId: string) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: {
        id: itemId,
        familyId,
      },
      include: {
        product: true,
      },
    });

    if (!item) {
      throw new NotFoundException('Inventory item not found');
    }

    return item;
  }

  async updateInventoryItem(
    familyId: string,
    itemId: string,
    dto: UpdateInventoryItemDto,
  ) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: {
        id: itemId,
        familyId,
      },
    });

    if (!item) {
      throw new NotFoundException('Inventory item not found');
    }

    // ⭐ НОВЕ: Якщо змінюємо deductFromBudget - перераховуємо бюджет
    let budgetUpdate: Awaited<ReturnType<WeeklyBudgetService['addExpense']>> | null = null;

    // Якщо раніше було deductFromBudget=true, а тепер false - повертаємо гроші
    if (item.deductFromBudget && dto.deductFromBudget === false && item.purchasePrice) {
      await this.weeklyBudgetService.removeExpense(
        familyId,
        Number(item.purchasePrice),
        item.createdAt,
      );
    }

    // Якщо раніше було deductFromBudget=false, а тепер true - вираховуємо
    if (!item.deductFromBudget && dto.deductFromBudget === true && dto.purchasePrice) {
      budgetUpdate = await this.weeklyBudgetService.addExpense(
        familyId,
        dto.purchasePrice,
        item.createdAt,
      );
    }

    const updatedItem = await this.prisma.inventoryItem.update({
      where: { id: itemId },
      data: {
        quantity: dto.quantity,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
        deductFromBudget: dto.deductFromBudget,
        purchasePrice: dto.purchasePrice,
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            category: true,
            baseUnit: true,
          },
        },
      },
    });

    return {
      item: updatedItem,
      budgetUpdate: this.mapBudgetUpdate(budgetUpdate),
    };
  }

  async removeFromInventory(
    familyId: string,
    itemId: string,
    dto: RemoveFromInventoryDto,
  ) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: {
        id: itemId,
        familyId,
      },
    });

    if (!item) {
      throw new NotFoundException('Inventory item not found');
    }

    if (dto.quantity >= item.quantity) {
      await this.prisma.inventoryItem.delete({
        where: { id: itemId },
      });

      return {
        message: 'Item removed from inventory',
        removed: true,
      };
    } else {
      const updatedItem = await this.prisma.inventoryItem.update({
        where: { id: itemId },
        data: {
          quantity: item.quantity - dto.quantity,
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              category: true,
              baseUnit: true,
            },
          },
        },
      });

      return {
        message: 'Quantity reduced',
        removed: false,
        item: updatedItem,
      };
    }
  }

  async deleteInventoryItem(familyId: string, itemId: string) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: {
        id: itemId,
        familyId,
      },
    });

    if (!item) {
      throw new NotFoundException('Inventory item not found');
    }

    // ⭐ НОВЕ: Якщо товар було вираховано з бюджету - повертаємо гроші
    if (item.deductFromBudget && item.purchasePrice) {
      await this.weeklyBudgetService.removeExpense(
        familyId,
        Number(item.purchasePrice),
        item.createdAt,
      );
    }

    await this.prisma.inventoryItem.delete({
      where: { id: itemId },
    });

    return { message: 'Item deleted from inventory' };
  }

  async checkProductAvailability(
    familyId: string,
    productId: string,
    requiredQuantity: number,
  ): Promise<boolean> {
    const items = await this.prisma.inventoryItem.findMany({
      where: {
        familyId,
        productId,
      },
    });

    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

    return totalQuantity >= requiredQuantity;
  }

  async deductProducts(
    familyId: string,
    products: Array<{ productId: string; quantity: number }>,
  ) {
    const results: Array<{
      productId: string;
      deducted: number;
      success: boolean;
    }> = [];

    for (const { productId, quantity } of products) {
      const items = await this.prisma.inventoryItem.findMany({
        where: {
          familyId,
          productId,
        },
        orderBy: {
          expiryDate: 'asc',
        },
      });

      let remainingToDeduct = quantity;

      for (const item of items) {
        if (remainingToDeduct <= 0) break;

        if (item.quantity <= remainingToDeduct) {
          await this.prisma.inventoryItem.delete({
            where: { id: item.id },
          });
          remainingToDeduct -= item.quantity;
        } else {
          await this.prisma.inventoryItem.update({
            where: { id: item.id },
            data: {
              quantity: item.quantity - remainingToDeduct,
            },
          });
          remainingToDeduct = 0;
        }
      }

      results.push({
        productId,
        deducted: quantity - remainingToDeduct,
        success: remainingToDeduct === 0,
      });
    }

    return results;
  }

  async getExpiringProducts(familyId: string, daysAhead: number = 2) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    const items = await this.prisma.inventoryItem.findMany({
      where: {
        familyId,
        expiryDate: {
          lte: futureDate,
          gte: new Date(),
        },
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            category: true,
            baseUnit: true,
          },
        },
      },
      orderBy: {
        expiryDate: 'asc',
      },
    });

    return items;
  }

}