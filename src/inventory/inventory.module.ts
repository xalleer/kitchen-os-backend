import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { WeeklyBudgetModule } from '../weekly-budget/weekly-budget.module';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [WeeklyBudgetModule, ProductsModule],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
