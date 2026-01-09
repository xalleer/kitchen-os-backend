import { Module } from '@nestjs/common';
import { RecipesService } from './recipes.service';
import { RecipesController } from './recipes.controller';
import { AiModule } from '../ai/ai.module';
import { InventoryModule } from '../inventory/inventory.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    AiModule,
    InventoryModule,
    PrismaModule,
  ],
  providers: [RecipesService],
  controllers: [RecipesController],
})
export class RecipesModule {}
