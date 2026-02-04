import { Module } from '@nestjs/common';
import { ShoppingListService } from './shopping-list.service';
import { ShoppingListController } from './shopping-list.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { WeeklyBudgetModule } from '../weekly-budget/weekly-budget.module';

@Module({
  imports: [PrismaModule, WeeklyBudgetModule],
  providers: [ShoppingListService],
  controllers: [ShoppingListController],
  exports: [ShoppingListService],
})
export class ShoppingListModule {}