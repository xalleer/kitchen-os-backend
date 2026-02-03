import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { InventoryService } from '../inventory/inventory.service';
import {
  GenerateRecipeDto,
  GenerateCustomRecipeDto,
  SaveRecipeDto,
  CookRecipeDto,
  CookRecipePreviewDto,
} from './dto/recipes.dto';

@Injectable()
export class RecipesService {
  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
    private inventoryService: InventoryService,
  ) {}

  async getSavedRecipes(familyId: string) {
    const recipes = await this.prisma.recipe.findMany({
      where: { isSaved: true },
      include: {
        ingredients: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                baseUnit: true,
                image: true,
              },
            },
          },
        },
      },
      orderBy: { id: 'desc' },
    });

    return recipes;
  }

  async getRecipeById(recipeId: string) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
      include: {
        ingredients: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                baseUnit: true,
                caloriesPer100: true,
                image: true,
              },
            },
          },
        },
      },
    });

    if (!recipe) {
      throw new NotFoundException('Recipe not found');
    }

    return recipe;
  }

async generateRecipeFromInventory(familyId: string, portions: number = 2) {
  const { items } = await this.inventoryService.getInventory(familyId);

  if (items.length === 0) {
    throw new BadRequestException('No products in inventory');
  }

  const productNames = items.map((item) => item.product.name);

  const familyMembers = await this.prisma.familyMember.findMany({
    where: { familyId },
    include: {
      allergies: { select: { name: true } },
    },
  });

  const allAllergies = [
    ...new Set(
      familyMembers.flatMap((member) =>
        member.allergies.map((a) => a.name),
      ),
    ),
  ];

  const aiRecipe = await this.aiService.generateRecipe({
    productNames,
    portions,
    dietaryRestrictions: allAllergies,
  });

  const productsMap = new Map(items.map((item) => [item.product.name, item.product]));

  const unknownIngredients = aiRecipe.ingredients
    .filter((ing) => !productsMap.has(ing.productName))
    .map((ing) => ({ productName: ing.productName, amount: ing.amount, unit: ing.unit }));

  if (unknownIngredients.length > 0) {
    throw new BadRequestException({
      message:
        'AI generated ingredients that are not present in your inventory products list. Please add them first and retry.',
      unknownIngredients,
    });
  }

  // Отримуємо inventory з продуктами для перевірки доступності
  const inventoryMap = new Map(
    items.map((item) => [item.product.name, item.quantity]),
  );

  return {
    ...aiRecipe,
    ingredients: aiRecipe.ingredients.map((ing) => ({
      ...ing,
      productId: productsMap.get(ing.productName)?.id || null,
      available: (inventoryMap.get(ing.productName) || 0) >= ing.amount,
    })),
    canCook: true,
  };
}

  async generateRecipeFromProducts(
  familyId: string,
  dto: GenerateRecipeDto,
) {
  const products = await this.prisma.product.findMany({
    where: {
      id: { in: dto.productIds },
    },
  });

  if (products.length !== dto.productIds.length) {
    throw new BadRequestException('Some products not found');
  }

  const productNames = products.map((p) => p.name);

  const familyMembers = await this.prisma.familyMember.findMany({
    where: { familyId },
    include: {
      allergies: { select: { name: true } },
    },
  });

  const allAllergies = [
    ...new Set(
      familyMembers.flatMap((member) =>
        member.allergies.map((a) => a.name),
      ),
    ),
  ];

  const aiRecipe = await this.aiService.generateRecipe({
    productNames,
    portions: dto.portions,
    dietaryRestrictions: allAllergies,
    cuisine: dto.cuisine,
  });

  const allowedNames = new Set(productNames);
  const unknownIngredients = aiRecipe.ingredients
    .filter((ing) => !allowedNames.has(ing.productName))
    .map((ing) => ({ productName: ing.productName, amount: ing.amount, unit: ing.unit }));

  if (unknownIngredients.length > 0) {
    throw new BadRequestException({
      message:
        'AI generated ingredients that are not present in selected products list. Please select/add these products and retry.',
      unknownIngredients,
    });
  }

  // ⭐ ВИПРАВЛЕНО: отримуємо inventory з include
  const inventory = await this.inventoryService.getInventory(familyId);
  const inventoryMap = new Map(
    inventory.items.map((item) => [item.product.name, item.quantity]),
  );

  const missingProducts: string[] = [];
  const ingredientsWithAvailability = aiRecipe.ingredients.map((ing) => {
    const product = products.find((p) => p.name === ing.productName);
    const availableQty = inventoryMap.get(ing.productName) || 0;
    const isAvailable = availableQty >= ing.amount;

    if (!isAvailable) {
      missingProducts.push(ing.productName);
    }

    return {
      ...ing,
      productId: product?.id || null,
      available: isAvailable,
      availableQuantity: availableQty,
    };
  });

  return {
    ...aiRecipe,
    ingredients: ingredientsWithAvailability,
    canCook: missingProducts.length === 0,
    missingProducts,
  };
}

  async generateCustomRecipe(familyId: string, dto: GenerateCustomRecipeDto) {
    const familyMembers = await this.prisma.familyMember.findMany({
      where: { familyId },
      include: {
        allergies: { select: { name: true } },
      },
    });

    const allAllergies = [
      ...new Set(
        familyMembers.flatMap((member) =>
          member.allergies.map((a) => a.name),
        ),
      ),
    ];

    const aiRecipe = await this.aiService.generateRecipe({
      productNames: [dto.dishName],
      portions: dto.portions,
      dietaryRestrictions: allAllergies,
    });

    const allProducts = await this.prisma.product.findMany({
      select: { id: true, name: true },
    });

    const productsMap = new Map(allProducts.map((p) => [p.name.toLowerCase(), p]));

    const { items } = await this.inventoryService.getInventory(familyId);
    const inventoryMap = new Map(
      items.map((item) => [item.product.name, item.quantity]),
    );

    const unknownIngredients = aiRecipe.ingredients
      .filter((ing) => !productsMap.has(ing.productName.toLowerCase()))
      .map((ing) => ({ productName: ing.productName, amount: ing.amount, unit: ing.unit }));

    if (unknownIngredients.length > 0) {
      throw new BadRequestException({
        message:
          'AI generated ingredients that are not present in products catalog. Please add these products to the database and retry.',
        unknownIngredients,
      });
    }

    const missingProducts: string[] = [];
    const ingredientsWithAvailability = aiRecipe.ingredients.map((ing) => {
      const product = productsMap.get(ing.productName.toLowerCase());
      const availableQty = inventoryMap.get(ing.productName) || 0;
      const isAvailable = availableQty >= ing.amount;

      if (!isAvailable) {
        missingProducts.push(ing.productName);
      }

      return {
        ...ing,
        productId: product?.id || null,
        available: isAvailable,
        availableQuantity: availableQty,
      };
    });

    return {
      ...aiRecipe,
      ingredients: ingredientsWithAvailability,
      canCook: missingProducts.length === 0,
      missingProducts,
    };
  }

  async saveRecipe(dto: SaveRecipeDto) {
    const recipe = await this.prisma.recipe.create({
      data: {
        name: dto.name,
        instructions: dto.instructions,
        isSaved: true,
        ingredients: {
          create: dto.ingredients.map((ing) => ({
            productId: ing.productId,
            amount: ing.amount,
          })),
        },
      },
      include: {
        ingredients: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                baseUnit: true,
              },
            },
          },
        },
      },
    });

    return recipe;
  }

  async cookRecipe(familyId: string, dto: CookRecipeDto) {
    const recipe = await this.getRecipeById(dto.recipeId);

    const productsToDeduct = recipe.ingredients.map((ing) => ({
      productId: ing.productId,
      quantity: ing.amount,
    }));

    for (const { productId, quantity } of productsToDeduct) {
      const hasEnough = await this.inventoryService.checkProductAvailability(
        familyId,
        productId,
        quantity,
      );

      if (!hasEnough) {
        throw new BadRequestException(
          `Not enough ${recipe.ingredients.find((i) => i.productId === productId)?.product.name} in inventory`,
        );
      }
    }

    const results = await this.inventoryService.deductProducts(
      familyId,
      productsToDeduct,
    );

    return {
      message: 'Recipe cooked successfully',
      recipeName: recipe.name,
      deductedProducts: results,
    };
  }

  async cookRecipePreview(familyId: string, dto: CookRecipePreviewDto) {
    if (!dto.ingredients || dto.ingredients.length === 0) {
      throw new BadRequestException('No ingredients provided');
    }

    const productIds = dto.ingredients.map((i) => i.productId);
    const products = await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
      },
      select: {
        id: true,
        name: true,
      },
    });

    const productNameById = new Map(products.map((p) => [p.id, p.name]));

    const productsToDeduct = dto.ingredients.map((ing) => ({
      productId: ing.productId,
      quantity: ing.amount,
    }));

    for (const { productId, quantity } of productsToDeduct) {
      const hasEnough = await this.inventoryService.checkProductAvailability(
        familyId,
        productId,
        quantity,
      );

      if (!hasEnough) {
        const productName = productNameById.get(productId) || productId;
        throw new BadRequestException(`Not enough ${productName} in inventory`);
      }
    }

    const results = await this.inventoryService.deductProducts(
      familyId,
      productsToDeduct,
    );

    return {
      message: 'Recipe cooked successfully',
      recipeName: dto.name || null,
      deductedProducts: results,
    };
  }

  // ===== FIXED DELETE METHOD =====
  async deleteRecipe(recipeId: string) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
      include: {
        mealPlans: true,
        ingredients: true,
      },
    });

    if (!recipe) {
      throw new NotFoundException('Recipe not found');
    }

    if (recipe.mealPlans.length > 0) {
      throw new BadRequestException(
        'Cannot delete recipe that is used in meal plans',
      );
    }

    // Використовуємо транзакцію для правильного видалення
    await this.prisma.$transaction([
      // Спочатку видаляємо всі інгредієнти
      this.prisma.recipeIngredient.deleteMany({
        where: { recipeId },
      }),
      // Потім видаляємо сам рецепт
      this.prisma.recipe.delete({
        where: { id: recipeId },
      }),
    ]);

    return { message: 'Recipe deleted successfully' };
  }

  // ===== FIXED EXPIRING PRODUCTS =====
  async getExpiringProductsRecipes(familyId: string) {
    const expiringItems = await this.inventoryService.getExpiringProducts(
      familyId,
      2,
    );

    if (expiringItems.length === 0) {
      return {
        expiringProducts: [],
        suggestedRecipe: null
      };
    }

    const productNames = expiringItems.map((item) => item.product.name);

    const familyMembers = await this.prisma.familyMember.findMany({
      where: { familyId },
      include: {
        allergies: { select: { name: true } },
      },
    });

    const allAllergies = [
      ...new Set(
        familyMembers.flatMap((member) =>
          member.allergies.map((a) => a.name),
        ),
      ),
    ];

    const aiRecipe = await this.aiService.generateRecipe({
      productNames,
      portions: 2,
      dietaryRestrictions: allAllergies,
    });

    // Отримуємо всі продукти з БД для маппінгу
    const allProducts = await this.prisma.product.findMany({
      where: {
        name: {
          in: aiRecipe.ingredients.map(ing => ing.productName)
        }
      },
      select: { id: true, name: true, baseUnit: true },
    });

    const productsMap = new Map(
      allProducts.map((p) => [p.name.toLowerCase(), p])
    );

    // Додаємо productId до кожного інгредієнта
    const ingredientsWithIds = aiRecipe.ingredients.map((ing) => {
      const product = productsMap.get(ing.productName.toLowerCase());
      return {
        ...ing,
        productId: product?.id || null,
        unit: product?.baseUnit || ing.unit,
      };
    });

    return {
      expiringProducts: expiringItems.map((item) => ({
        name: item.product.name,
        quantity: item.quantity,
        expiryDate: item.expiryDate,
      })),
      suggestedRecipe: {
        ...aiRecipe,
        ingredients: ingredientsWithIds,
      },
    };
  }
}