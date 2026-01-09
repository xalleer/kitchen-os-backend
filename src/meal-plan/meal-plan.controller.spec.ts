import { Test, TestingModule } from '@nestjs/testing';
import { MealPlanController } from './meal-plan.controller';

describe('MealPlanController', () => {
  let controller: MealPlanController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MealPlanController],
    }).compile();

    controller = module.get<MealPlanController>(MealPlanController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
