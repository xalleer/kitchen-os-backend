import { BadRequestException } from '@nestjs/common';
import { RecipesService } from './recipes.service';

describe('RecipesService.cookRecipePreview', () => {
  it('cooks without saving recipe', async () => {
    const prismaMock = {
      product: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'p1', name: 'Milk' },
          { id: 'p2', name: 'Bread' },
        ]),
      },
      recipe: {
        create: jest.fn(),
      },
      familyMember: {
        findMany: jest.fn(),
      },
      recipeIngredient: {
        deleteMany: jest.fn(),
      },
      mealPlan: {
        findMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const inventoryServiceMock = {
      checkProductAvailability: jest.fn().mockResolvedValue(true),
      deductProducts: jest.fn().mockResolvedValue([
        { productId: 'p1', deducted: 1, success: true },
      ]),
    };

    const aiServiceMock = {};

    const service = new RecipesService(
      prismaMock as any,
      aiServiceMock as any,
      inventoryServiceMock as any,
    );

    const result = await service.cookRecipePreview('family-1', {
      name: 'Test recipe',
      ingredients: [
        { productId: 'p1', amount: 1 },
        { productId: 'p2', amount: 2 },
      ],
    });

    expect(prismaMock.product.findMany).toHaveBeenCalled();
    expect(inventoryServiceMock.checkProductAvailability).toHaveBeenCalledTimes(2);
    expect(inventoryServiceMock.deductProducts).toHaveBeenCalledTimes(1);
    expect(prismaMock.recipe.create).not.toHaveBeenCalled();

    expect(result).toEqual(
      expect.objectContaining({
        message: 'Recipe cooked successfully',
        recipeName: 'Test recipe',
      }),
    );
  });

  it('throws on empty ingredients', async () => {
    const prismaMock = {
      product: {
        findMany: jest.fn(),
      },
    };

    const inventoryServiceMock = {
      checkProductAvailability: jest.fn(),
      deductProducts: jest.fn(),
    };

    const service = new RecipesService(
      prismaMock as any,
      {} as any,
      inventoryServiceMock as any,
    );

    await expect(
      service.cookRecipePreview('family-1', { ingredients: [] } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
