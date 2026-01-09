import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AddToInventoryDto,
  UpdateInventoryItemDto,
  RemoveFromInventoryDto,
} from './dto/inventory.dto';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

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
          },
        },
      },
      orderBy: [
        { expiryDate: 'asc' }, // Продукти що швидше псуються - вгорі
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

  async addToInventory(familyId: string, dto: AddToInventoryDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
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
    } else {
      // Якщо немає - створюємо новий запис
      inventoryItem = await this.prisma.inventoryItem.create({
        data: {
          familyId,
          productId: dto.productId,
          quantity: dto.quantity,
          expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
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
    }

    return inventoryItem;
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

    const updatedItem = await this.prisma.inventoryItem.update({
      where: { id: itemId },
      data: {
        quantity: dto.quantity,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
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

    return updatedItem;
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