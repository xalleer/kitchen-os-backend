import { Module } from '@nestjs/common';
import { MealPlanService } from './meal-plan.service';
import { MealPlanController } from './meal-plan.controller';
import { AiModule } from '../ai/ai.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [AiModule, PrismaModule],
  providers: [MealPlanService],
  controllers: [MealPlanController],
  exports: [MealPlanService],
})
export class MealPlanModule {}