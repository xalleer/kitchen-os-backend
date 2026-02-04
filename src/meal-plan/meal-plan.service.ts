import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService, MealPlanParams } from '../ai/ai.service';
import { MealType, Unit } from '@prisma/client';
import { InventoryService } from '../inventory/inventory.service';
import { ShoppingListService } from '../shopping-list/shopping-list.service';
import { CookMealPlanDto } from './dto/meal-plan.dto';

@Injectable()
export class MealPlanService implements OnModuleInit {
  private readonly logger = new Logger(MealPlanService.name);
  private pendingJobsPoller: NodeJS.Timeout | null = null;

  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
    private inventoryService: InventoryService,
    private shoppingListService: ShoppingListService,
  ) {}

  onModuleInit() {
    // Lightweight in-process worker: claims and processes pending jobs.
    // This avoids losing jobs on process restart without requiring Redis/queues.
    const pollMs = 5000;
    this.pendingJobsPoller = setInterval(() => {
      void this.processNextPendingJob();
    }, pollMs);

    // Kick once on startup
    void this.processNextPendingJob();
  }

  private getDefaultDaysCountUntilSunday(): number {
    const now = new Date();
    const day = now.getDay();
    const diffToSunday = day === 0 ? 0 : 7 - day;
    return Math.max(1, diffToSunday + 1);
  }

  async generateMealPlanAsync(familyId: string, userId: string, daysCount: number) {
    const normalizedDaysCount = Math.max(1, Math.min(7, Math.round(daysCount || 7)));

    const job = await this.prisma.mealPlanGenerationJob.create({
      data: {
        familyId,
        userId,
        daysCount: normalizedDaysCount,
        status: 'PENDING',
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
      },
    });

    setImmediate(() => {
      void this.processMealPlanGenerationJob(job.id);
    });

    return {
      jobId: job.id,
      status: job.status,
      createdAt: job.createdAt,
    };
  }

  private async processNextPendingJob() {
    const next = await this.prisma.mealPlanGenerationJob.findFirst({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });

    if (!next) {
      return;
    }

    await this.processMealPlanGenerationJob(next.id);
  }

  async getMealPlanGenerationJob(familyId: string, jobId: string) {
    const job = await this.prisma.mealPlanGenerationJob.findFirst({
      where: {
        id: jobId,
        familyId,
      },
      select: {
        id: true,
        status: true,
        error: true,
        daysCount: true,
        createdAt: true,
        startedAt: true,
        finishedAt: true,
      },
    });

    if (!job) {
      throw new NotFoundException('Meal plan generation job not found');
    }

    return job;
  }

  async generateMealPlan(familyId: string, daysCount: number = 5, specificDate?: Date) {
    if (daysCount > 7) {
      daysCount = 7;
    }

    const expectedDaysCount = specificDate
      ? 1
      : Math.min(daysCount, this.getDefaultDaysCountUntilSunday());
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

    const allowedProducts = await this.prisma.product.findMany({
      where: {
        familyMemberId: null,
      },
      select: {
        id: true,
        name: true,
        baseUnit: true,
        averagePrice: true,
        standardAmount: true,
      },
      orderBy: { name: 'asc' },
    });

    const allowedProductsById = new Map(
      allowedProducts.map((p) => [
        p.id,
        { baseUnit: p.baseUnit, averagePrice: p.averagePrice, standardAmount: p.standardAmount },
      ]),
    );

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
      allowedProducts,
    };

    let aiMealPlan: Awaited<ReturnType<AiService['generateMealPlan']>>;
    try {
      aiMealPlan = await this.aiService.generateMealPlan(aiParams);

      if (aiMealPlan?.days?.length && aiMealPlan.days.length < expectedDaysCount && !specificDate) {
        this.logger.warn(
          `AI returned only ${aiMealPlan.days.length}/${expectedDaysCount} days. Retrying generation once...`,
        );
        aiMealPlan = await this.aiService.generateMealPlan(aiParams);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Meal plan AI generation failed: ${message}`);
      throw new BadRequestException({
        message: 'Failed to generate meal plan. AI response could not be processed.',
        details: message,
      });
    }

    console.log('AI Meal Plan Response:', JSON.stringify(aiMealPlan, null, 2));

    if (!aiMealPlan.days || !Array.isArray(aiMealPlan.days)) {
      throw new BadRequestException('Invalid AI response: days array is missing');
    }

    if (!specificDate && aiMealPlan.days.length < expectedDaysCount) {
      throw new BadRequestException({
        message: 'AI returned incomplete meal plan',
        expectedDays: expectedDaysCount,
        receivedDays: aiMealPlan.days.length,
      });
    }

    if (specificDate) {
      const startOfDay = new Date(specificDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(specificDate);
      endOfDay.setHours(23, 59, 59, 999);

      await this.prisma.mealPlan.deleteMany({
        where: {
          familyId,
          date: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      });
    } else {
      await this.prisma.mealPlan.deleteMany({
        where: { familyId },
      });
    }

    const savedMealPlans: any [] = [];
    let estimatedCost = 0;

    for (const day of aiMealPlan.days) {
      if (!day.meals || !Array.isArray(day.meals)) {
        console.error('Invalid day structure:', day);
        continue;
      }

      const dayDate = specificDate || new Date(day.date);

      for (const meal of day.meals) {
        const productIds = await this.mapIngredientsToExistingProducts(meal.recipe.ingredients);

        for (let i = 0; i < meal.recipe.ingredients.length; i++) {
          const ing = meal.recipe.ingredients[i];
          const productId = productIds[i];
          const p = allowedProductsById.get(productId);
          if (!p) {
            continue;
          }
          estimatedCost += this.estimatePrice(
            p.averagePrice ?? null,
            ing.amount,
            p.baseUnit,
            p.standardAmount ?? null,
          );
        }

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
            date: dayDate,
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
      estimatedCost: Math.round(estimatedCost),
      budgetLimit: Number(family.budgetLimit),
      daysCount,
      totalMeals: savedMealPlans.length,
      mealPlans: savedMealPlans,
    };
  }

  private async processMealPlanGenerationJob(jobId: string) {
    const claimed = await this.prisma.mealPlanGenerationJob.updateMany({
      where: {
        id: jobId,
        status: 'PENDING',
      },
      data: {
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });

    if (claimed.count === 0) {
      return;
    }

    const job = await this.prisma.mealPlanGenerationJob.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        familyId: true,
        daysCount: true,
      },
    });

    if (!job) {
      return;
    }

    try {
      await this.generateMealPlan(job.familyId, job.daysCount);

      await this.prisma.mealPlanGenerationJob.update({
        where: { id: jobId },
        data: {
          status: 'DONE',
          finishedAt: new Date(),
          error: null,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Meal plan async job failed: ${message}`);

      await this.prisma.mealPlanGenerationJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          finishedAt: new Date(),
          error: message,
        },
      });
    }
  }

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

  async getCurrentMeal(familyId: string, userId: string) {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const userPref = await this.prisma.userPreference.findUnique({
      where: { userId },
      select: {
        eatsBreakfast: true,
        eatsLunch: true,
        eatsDinner: true,
        eatsSnack: true,
        breakfastTime: true,
        lunchTime: true,
        dinnerTime: true,
        snackTime: true,
      },
    });

    const enabledTypes: MealType[] = [];
    if (userPref?.eatsBreakfast ?? true) enabledTypes.push('BREAKFAST');
    if (userPref?.eatsLunch ?? true) enabledTypes.push('LUNCH');
    if (userPref?.eatsDinner ?? true) enabledTypes.push('DINNER');
    if (userPref?.eatsSnack ?? false) enabledTypes.push('SNACK');

    const mealPlans = await this.prisma.mealPlan.findMany({
      where: {
        familyId,
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
        type: {
          in: enabledTypes,
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
    });

    const byType = new Map<MealType, (typeof mealPlans)[number]>();
    for (const mp of mealPlans) {
      byType.set(mp.type, mp);
    }

    const ordered = enabledTypes
      .map((t) => ({ type: t, at: this.getMealTimeForType(now, t, userPref) }))
      .sort((a, b) => a.at.getTime() - b.at.getTime());

    const lastStartedIndex = (() => {
      let idx = -1;
      for (let i = 0; i < ordered.length; i++) {
        if (now.getTime() >= ordered[i].at.getTime()) {
          idx = i;
        }
      }
      return idx;
    })();

    const startIndex = lastStartedIndex === -1 ? 0 : lastStartedIndex;
    const orderedTypes = ordered.slice(startIndex).map((m) => m.type);

    const current = orderedTypes
      .map((t) => byType.get(t))
      .find((mp) => mp && !mp.isCooked && !mp.isSkipped);

    return {
      date: startOfDay.toISOString().split('T')[0],
      now: now.toISOString(),
      meal: current ?? null,
      availableMealsCount: mealPlans.length,
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

    await this.generateMealPlan(familyId, 1, startOfDay);

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

    let aiMealPlan: Awaited<ReturnType<AiService['generateMealPlan']>>;
    try {
      aiMealPlan = await this.aiService.generateMealPlan(aiParams);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Meal plan AI generation failed during regenerateMeal: ${message}`);
      throw new BadRequestException({
        message: 'Failed to regenerate meal. AI response could not be processed.',
        details: message,
      });
    }

    if (!aiMealPlan.days || !Array.isArray(aiMealPlan.days) || aiMealPlan.days.length === 0) {
      this.logger.error('Invalid AI meal plan response during regenerateMeal');
      throw new BadRequestException('Invalid AI response: days array is missing');
    }

    const newMeal = aiMealPlan.days[0].meals.find((m) => m.type === mealPlan.type);

    if (!newMeal) {
      throw new BadRequestException('Failed to generate new meal');
    }

    const productIds = await this.mapIngredientsToExistingProducts(newMeal.recipe.ingredients);

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

  async cookMeal(familyId: string, mealPlanId: string, dto: CookMealPlanDto) {
    const mealPlan = await this.prisma.mealPlan.findFirst({
      where: {
        id: mealPlanId,
        familyId,
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
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!mealPlan) {
      throw new NotFoundException('Meal plan not found');
    }

    if (mealPlan.isCooked) {
      return {
        message: 'Meal already cooked',
        mealPlan,
      };
    }

    if (mealPlan.isSkipped) {
      throw new BadRequestException('Meal is skipped');
    }

    const requiredByProduct = new Map<
      string,
      { productId: string; quantity: number; productName: string; baseUnit: Unit }
    >();

    for (const ingredient of mealPlan.recipe.ingredients) {
      const existing = requiredByProduct.get(ingredient.productId);
      if (existing) {
        existing.quantity += ingredient.amount;
      } else {
        requiredByProduct.set(ingredient.productId, {
          productId: ingredient.productId,
          quantity: ingredient.amount,
          productName: ingredient.product.name,
          baseUnit: ingredient.product.baseUnit,
        });
      }
    }

    const inventoryItems = await this.prisma.inventoryItem.findMany({
      where: {
        familyId,
        productId: {
          in: [...requiredByProduct.keys()],
        },
      },
    });

    const inventoryTotals = new Map<string, number>();
    for (const item of inventoryItems) {
      inventoryTotals.set(item.productId, (inventoryTotals.get(item.productId) || 0) + item.quantity);
    }

    const missingItems: Array<{
      productId: string;
      productName: string;
      baseUnit: Unit;
      required: number;
      inInventory: number;
      missing: number;
    }> = [];

    for (const req of requiredByProduct.values()) {
      const inInventory = inventoryTotals.get(req.productId) || 0;
      const missing = req.quantity - inInventory;

      if (missing > 0) {
        missingItems.push({
          productId: req.productId,
          productName: req.productName,
          baseUnit: req.baseUnit,
          required: req.quantity,
          inInventory,
          missing,
        });
      }
    }

    if (missingItems.length > 0) {
      if (dto?.addToShoppingList) {
        for (const item of missingItems) {
          await this.shoppingListService.addManualItem(
            familyId,
            item.productId,
            item.missing,
            undefined,
          );
        }
      }

      if (!dto?.ignoreMissing) {
        throw new ConflictException({
          message: 'Not enough products in inventory',
          missingItems,
          addedToShoppingList: Boolean(dto?.addToShoppingList),
        });
      }
    }

    const toDeduct = [...requiredByProduct.values()]
      .map((r) => {
        const inInventory = inventoryTotals.get(r.productId) || 0;
        const quantity = dto?.ignoreMissing ? Math.max(0, Math.min(r.quantity, inInventory)) : r.quantity;
        return {
          productId: r.productId,
          quantity,
        };
      })
      .filter((r) => r.quantity > 0);

    const deductResults =
      toDeduct.length > 0 ? await this.inventoryService.deductProducts(familyId, toDeduct) : [];

    if (!dto?.ignoreMissing) {
      const failed = deductResults.filter((r) => !r.success);
      if (failed.length > 0) {
        throw new ConflictException({
          message: 'Failed to deduct some products from inventory',
          failed,
        });
      }
    }

    const updated = await this.prisma.mealPlan.update({
      where: { id: mealPlanId },
      data: {
        isCooked: true,
        cookedAt: new Date(),
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

    return {
      message: 'Meal cooked successfully',
      deducted: deductResults,
      missingItems: missingItems.length > 0 ? missingItems : undefined,
      mealPlan: updated,
    };
  }

  async skipMeal(familyId: string, mealPlanId: string) {
    const mealPlan = await this.prisma.mealPlan.findFirst({
      where: {
        id: mealPlanId,
        familyId,
      },
    });

    if (!mealPlan) {
      throw new NotFoundException('Meal plan not found');
    }

    if (mealPlan.isCooked) {
      throw new BadRequestException('Meal already cooked');
    }

    if (mealPlan.isSkipped) {
      return {
        message: 'Meal already skipped',
        mealPlan,
      };
    }

    const updated = await this.prisma.mealPlan.update({
      where: { id: mealPlanId },
      data: {
        isSkipped: true,
        skippedAt: new Date(),
      },
    });

    return {
      message: 'Meal skipped successfully',
      mealPlan: updated,
    };
  }

  private getMealTimeForType(
    baseDate: Date,
    type: MealType,
    userPref: {
      breakfastTime: string | null;
      lunchTime: string | null;
      dinnerTime: string | null;
      snackTime: string | null;
    } | null,
  ): Date {
    const fallback: Record<MealType, string> = {
      BREAKFAST: '09:00',
      LUNCH: '13:00',
      DINNER: '20:00',
      SNACK: '17:00',
    };

    const timeStr =
      type === 'BREAKFAST'
        ? userPref?.breakfastTime
        : type === 'LUNCH'
          ? userPref?.lunchTime
          : type === 'DINNER'
            ? userPref?.dinnerTime
            : userPref?.snackTime;

    const resolved = this.parseTimeToDate(baseDate, timeStr ?? fallback[type]);
    return resolved;
  }

  private parseTimeToDate(baseDate: Date, time: string): Date {
    const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec((time || '').trim());
    const hours = m ? Number(m[1]) : 0;
    const minutes = m ? Number(m[2]) : 0;
    const d = new Date(baseDate);
    d.setHours(hours, minutes, 0, 0);
    return d;
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

  private async mapIngredientsToExistingProducts(
    ingredients: Array<{ productId?: string; productName: string; amount: number; unit: string }>,
  ): Promise<string[]> {
    if (!ingredients.length) {
      return [];
    }

    const byId = new Map<string, string>();
    const byName = new Map<string, string>();

    const products = await this.prisma.product.findMany({
      where: {
        familyMemberId: null,
      },
      select: {
        id: true,
        name: true,
      },
    });

    for (const p of products) {
      byId.set(p.id, p.id);
      byName.set(p.name.trim().toLowerCase(), p.id);
    }

    const unknown: Array<{ productId?: string; productName: string }> = [];
    const mapped: string[] = [];

    for (const ing of ingredients) {
      if (ing.productId && byId.has(ing.productId)) {
        mapped.push(ing.productId);
        continue;
      }

      const id = byName.get((ing.productName || '').trim().toLowerCase());
      if (id) {
        mapped.push(id);
        continue;
      }

      unknown.push({ productId: ing.productId, productName: ing.productName });
    }

    if (unknown.length > 0) {
      throw new BadRequestException({
        message:
          'AI generated ingredients that are not present in products catalog. Please add these products to the database and retry.',
        unknownIngredients: unknown,
      });
    }

    return mapped;
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