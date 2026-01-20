import { Module } from '@nestjs/common';
import { WeeklyBudgetService } from './weekly-budget.service';
import { WeeklyBudgetController } from './weekly-budget.controller';

@Module({
  controllers: [WeeklyBudgetController],
  providers: [WeeklyBudgetService],
  exports: [WeeklyBudgetService],
})
export class WeeklyBudgetModule {}
