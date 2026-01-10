import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService, MealPlanParams } from '../ai/ai.service';
import { MealType } from '@prisma/client';

@Injectable()
export class MealPlanService {
  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
  ) {}

  /**
   * Генерує план харчування на тиждень для сім'ї
   */
  async generateMealPlan(familyId: string, daysCount: number = 5) {
    if (daysCount > 7) {
      daysCount = 7;
    }
    const family = await this.prisma.family.findUnique({
      where: { id: familyId },
      include: {
        members: {
          include: {
            allergies: { select: { name: true } },
          },
        },
      },
    });

    if (!family) {
      throw new NotFoundException('Family not found');
    }

    if (family.members.length === 0) {
      throw new BadRequestException('Family has no members');
    }

    const aiParams: MealPlanParams = {
      familyMembers: family.members.map((member) => ({
        name: member.name,
        allergies: member.allergies.map((a) => a.name),
        goal: member.goal,
        eatsBreakfast: member.eatsBreakfast,
        eatsLunch: member.eatsLunch,
        eatsDinner: member.eatsDinner,
        eatsSnack: member.eatsSnack,
      })),
      budgetLimit: Number(family.budgetLimit) || 0,
      daysCount,
    };

    const aiMealPlan = await this.aiService.generateMealPlan(aiParams);

    console.log('AI Meal Plan Response:', JSON.stringify(aiMealPlan, null, 2));

    if (!aiMealPlan.days || !Array.isArray(aiMealPlan.days)) {
      throw new BadRequestException('Invalid AI response: days array is missing');
    }

    await this.prisma.mealPlan.deleteMany({
      where: { familyId },
    });

    const savedMealPlans: Awaited<ReturnType<typeof this.prisma.mealPlan.create>>[] = [];

    for (const day of aiMealPlan.days) {
      if (!day.meals || !Array.isArray(day.meals)) {
        console.error('Invalid day structure:', day);
        continue;
      }

      for (const meal of day.meals) {
        const productIds = await this.findOrCreateProducts(meal.recipe.ingredients);

        const recipe = await this.prisma.recipe.create({
          data: {
            name: meal.recipe.name,
            instructions: meal.recipe.instructions.join('\n'),
            ingredients: {
              create: meal.recipe.ingredients.map((ing, index) => ({
                productId: productIds[index],
                amount: ing.amount,
              })),
            },
          },
        });

        const mealPlan = await this.prisma.mealPlan.create({
          data: {
            familyId,
            date: new Date(day.date),
            type: meal.type as MealType,
            recipeId: recipe.id,
          },
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

        savedMealPlans.push(mealPlan);
      }
    }

    return {
      message: 'Meal plan generated successfully',
      estimatedCost: aiMealPlan.estimatedCost,
      budgetLimit: Number(family.budgetLimit),
      daysCount,
      totalMeals: savedMealPlans.length,
      mealPlans: savedMealPlans,
    };
  }

  /**
   * Отримати поточний план харчування
   */
  async getMealPlan(familyId: string, startDate?: Date, endDate?: Date) {
    const where: any = { familyId };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = startDate;
      if (endDate) where.date.lte = endDate;
    }

    const mealPlans = await this.prisma.mealPlan.findMany({
      where,
      include: {
        recipe: {
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
        },
      },
      orderBy: [{ date: 'asc' }, { type: 'asc' }],
    });

    const groupedByDay = mealPlans.reduce((acc, meal) => {
      const dateKey = meal.date.toISOString().split('T')[0];
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(meal);
      return acc;
    }, {} as Record<string, typeof mealPlans>);

    return {
      mealPlans,
      groupedByDay,
      totalDays: Object.keys(groupedByDay).length,
      totalMeals: mealPlans.length,
    };
  }

  /**
   * Отримати меню на конкретний день
   */
  async getMealPlanForDay(familyId: string, date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const mealPlans = await this.prisma.mealPlan.findMany({
      where: {
        familyId,
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        recipe: {
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
        },
      },
      orderBy: { type: 'asc' },
    });

    return {
      date: date.toISOString().split('T')[0],
      meals: mealPlans,
      totalMeals: mealPlans.length,
    };
  }

  /**
   * Регенерувати план харчування на конкретний день
   */
  async regenerateDay(familyId: string, date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const deletedMeals = await this.prisma.mealPlan.findMany({
      where: {
        familyId,
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: { recipe: true },
    });

    await this.prisma.mealPlan.deleteMany({
      where: {
        familyId,
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    for (const meal of deletedMeals) {
      const usageCount = await this.prisma.mealPlan.count({
        where: { recipeId: meal.recipeId },
      });

      if (usageCount === 0) {
        await this.prisma.recipeIngredient.deleteMany({
          where: { recipeId: meal.recipeId },
        });
        await this.prisma.recipe.delete({
          where: { id: meal.recipeId },
        });
      }
    }

    await this.generateMealPlan(familyId, 1);

    return this.getMealPlanForDay(familyId, date);
  }

  /**
   * Регенерувати конкретну страву (сніданок/обід/вечеря)
   */
  async regenerateMeal(familyId: string, mealPlanId: string) {
    const mealPlan = await this.prisma.mealPlan.findFirst({
      where: {
        id: mealPlanId,
        familyId,
      },
      include: {
        recipe: {
          include: {
            ingredients: true,
          },
        },
      },
    });

    if (!mealPlan) {
      throw new NotFoundException('Meal plan not found');
    }

    const oldRecipeId = mealPlan.recipeId;

    const family = await this.prisma.family.findUnique({
      where: { id: familyId },
      include: {
        members: {
          include: {
            allergies: { select: { name: true } },
          },
        },
      },
    });

    if (!family) {
      throw new NotFoundException('Family not found');
    }

    const aiParams: MealPlanParams = {
      familyMembers: family.members.map((member) => ({
        name: member.name,
        allergies: member.allergies.map((a) => a.name),
        goal: member.goal,
        eatsBreakfast: member.eatsBreakfast,
        eatsLunch: member.eatsLunch,
        eatsDinner: member.eatsDinner,
        eatsSnack: member.eatsSnack,
      })),
      budgetLimit: Number(family.budgetLimit) || 0,
      daysCount: 1,
    };

    const aiMealPlan = await this.aiService.generateMealPlan(aiParams);
    const newMeal = aiMealPlan.days[0].meals.find((m) => m.type === mealPlan.type);

    if (!newMeal) {
      throw new BadRequestException('Failed to generate new meal');
    }

    const productIds = await this.findOrCreateProducts(newMeal.recipe.ingredients);

    const newRecipe = await this.prisma.recipe.create({
      data: {
        name: newMeal.recipe.name,
        instructions: newMeal.recipe.instructions.join('\n'),
        ingredients: {
          create: newMeal.recipe.ingredients.map((ing, index) => ({
            productId: productIds[index],
            amount: ing.amount,
          })),
        },
      },
    });

    const updatedMealPlan = await this.prisma.mealPlan.update({
      where: { id: mealPlanId },
      data: { recipeId: newRecipe.id },
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

    const usageCount = await this.prisma.mealPlan.count({
      where: { recipeId: oldRecipeId },
    });

    if (usageCount === 0) {
      await this.prisma.recipeIngredient.deleteMany({
        where: { recipeId: oldRecipeId },
      });
      await this.prisma.recipe.delete({
        where: { id: oldRecipeId },
      });
    }

    return updatedMealPlan;
  }

  /**
   * Видалити весь план харчування
   */
  async deleteMealPlan(familyId: string) {
    const mealPlans = await this.prisma.mealPlan.findMany({
      where: { familyId },
      include: { recipe: true },
    });

    const recipeIds = mealPlans.map((mp) => mp.recipeId);

    await this.prisma.mealPlan.deleteMany({
      where: { familyId },
    });

    for (const recipeId of recipeIds) {
      const usageCount = await this.prisma.mealPlan.count({
        where: { recipeId },
      });

      if (usageCount === 0) {
        await this.prisma.recipeIngredient.deleteMany({
          where: { recipeId },
        });
        await this.prisma.recipe.delete({
          where: { id: recipeId },
        });
      }
    }

    return { message: 'Meal plan deleted successfully' };
  }

  /**
   * Helper: Знайти або створити продукти для інгредієнтів
   */
  private async findOrCreateProducts(
    ingredients: Array<{ productName: string; amount: number; unit: string }>,
  ): Promise<string[]> {
    const productIds: string[] = [];

    for (const ing of ingredients) {
      let product = await this.prisma.product.findFirst({
        where: {
          name: {
            equals: ing.productName,
            mode: 'insensitive',
          },
        },
      });

      if (!product) {
        product = await this.prisma.product.create({
          data: {
            name: ing.productName,
            baseUnit: this.mapUnitToEnum(ing.unit),
            category: 'Інше',
          },
        });
      }

      productIds.push(product.id);
    }

    return productIds;
  }

  /**
   * Helper: Конвертує одиниці виміру в enum
   */
  private mapUnitToEnum(unit: string): 'G' | 'ML' | 'PCS' {
    const normalized = unit.toLowerCase();
    if (normalized.includes('г') || normalized.includes('кг') || normalized === 'g') {
      return 'G';
    }
    if (normalized.includes('мл') || normalized.includes('л') || normalized === 'ml') {
      return 'ML';
    }
    return 'PCS';
  }
}