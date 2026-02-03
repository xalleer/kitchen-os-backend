import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { FamilyModule } from './family/family.module';
import { ProductsModule } from './products/products.module';
import { InventoryModule } from './inventory/inventory.module';
import { PrismaModule } from './prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DictionariesModule } from './dictionaries/dictionaries.module';
import { MailModule } from './mail/mail.module';
import { RecipesModule } from './recipes/recipes.module';
import { AiModule } from './ai/ai.module';
import { MealPlanModule } from './meal-plan/meal-plan.module';
import { ShoppingListModule } from './shopping-list/shopping-list.module';
import { ScheduleModule } from '@nestjs/schedule';
import { FamilyInvitesModule } from './family-invites/family-invites.module';
import { WeeklyBudgetModule } from './weekly-budget/weekly-budget.module';

const enableScheduledTasks = process.env.ENABLE_SCHEDULED_TASKS === 'true';

@Module({
  imports: [
    ...(enableScheduledTasks ? [ScheduleModule.forRoot()] : []),
    AuthModule,
    UsersModule,
    FamilyModule,
    FamilyInvitesModule,
    ProductsModule,
    InventoryModule,
    PrismaModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
    }),
    DictionariesModule,
    MailModule,
    RecipesModule,
    AiModule,
    MealPlanModule,
    ShoppingListModule,
    WeeklyBudgetModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
