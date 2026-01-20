import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ShoppingListService } from './shopping-list.service';

describe('ShoppingListService.getBudgetSummary', () => {
  it('returns spent vs budgetLimit', async () => {
    const prismaMock = {
      family: {
        findUnique: jest.fn().mockResolvedValue({ budgetLimit: 100 }),
      },
      shoppingListItem: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: '1',
            quantity: 1,
            actualPrice: 30,
            estimatedPrice: null,
            boughtAt: new Date('2026-01-01T00:00:00.000Z'),
            product: { name: 'Milk', baseUnit: 'ML' },
          },
          {
            id: '2',
            quantity: 1,
            actualPrice: null,
            estimatedPrice: 40,
            boughtAt: new Date('2026-01-02T00:00:00.000Z'),
            product: { name: 'Bread', baseUnit: 'PCS' },
          },
        ]),
      },
    };

    const service = new ShoppingListService(prismaMock as any);

    const res = await service.getBudgetSummary('family-1');

    expect(res).toEqual(
      expect.objectContaining({
        budgetLimit: 100,
        spent: 70,
        remaining: 30,
        withinBudget: true,
        itemsCount: 2,
      }),
    );
  });

  it('throws NotFoundException when family missing', async () => {
    const prismaMock = {
      family: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      shoppingListItem: {
        findMany: jest.fn(),
      },
    };

    const service = new ShoppingListService(prismaMock as any);

    await expect(service.getBudgetSummary('family-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws BadRequestException for invalid dates', async () => {
    const prismaMock = {
      family: {
        findUnique: jest.fn().mockResolvedValue({ budgetLimit: 100 }),
      },
      shoppingListItem: {
        findMany: jest.fn(),
      },
    };

    const service = new ShoppingListService(prismaMock as any);

    await expect(
      service.getBudgetSummary('family-1', new Date('nope'), undefined),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
