import { Module } from '@nestjs/common';
import { MealPlanService } from './meal-plan.service';
import { MealPlanController } from './meal-plan.controller';

@Module({
  providers: [MealPlanService],
  controllers: [MealPlanController]
})
export class MealPlanModule {}
