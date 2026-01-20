import { Module } from '@nestjs/common';
import { MealPlanService } from './meal-plan.service';
import { MealPlanController } from './meal-plan.controller';
import { AiModule } from '../ai/ai.module';
import { PrismaModule } from '../prisma/prisma.module';
import { InventoryModule } from '../inventory/inventory.module';
import { ShoppingListModule } from '../shopping-list/shopping-list.module';

@Module({
  imports: [AiModule, PrismaModule, InventoryModule, ShoppingListModule],
  providers: [MealPlanService],
  controllers: [MealPlanController],
  exports: [MealPlanService],
})
export class MealPlanModule {}