import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MealPlanService } from './meal-plan.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  GenerateMealPlanDto,
  GetMealPlanQueryDto,
  RegenerateDayDto,
} from './dto/meal-plan.dto';

@Controller('meal-plan')
@UseGuards(JwtAuthGuard)
export class MealPlanController {
  constructor(private readonly mealPlanService: MealPlanService) {}

  /**
   * Згенерувати план харчування на тиждень (або N днів)
   * POST /meal-plan/generate
   */
  @Post('generate')
  async generateMealPlan(
    @CurrentUser('familyId') familyId: string,
    @Body() dto: GenerateMealPlanDto,
  ) {
    return this.mealPlanService.generateMealPlan(familyId, dto.daysCount || 7);
  }

  /**
   * Отримати поточний план харчування
   * GET /meal-plan
   * Query params: ?startDate=2024-01-10&endDate=2024-01-17
   */
  @Get()
  async getMealPlan(
    @CurrentUser('familyId') familyId: string,
    @Query() query: GetMealPlanQueryDto,
  ) {
    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;

    return this.mealPlanService.getMealPlan(familyId, startDate, endDate);
  }

  /**
   * Отримати меню на конкретний день
   * GET /meal-plan/day/2024-01-10
   */
  @Get('day/:date')
  async getMealPlanForDay(
    @CurrentUser('familyId') familyId: string,
    @Param('date') date: string,
  ) {
    return this.mealPlanService.getMealPlanForDay(familyId, new Date(date));
  }

  /**
   * Регенерувати план харчування на конкретний день
   * POST /meal-plan/regenerate-day
   */
  @Post('regenerate-day')
  @HttpCode(HttpStatus.OK)
  async regenerateDay(
    @CurrentUser('familyId') familyId: string,
    @Body() dto: RegenerateDayDto,
  ) {
    return this.mealPlanService.regenerateDay(familyId, new Date(dto.date));
  }

  /**
   * Регенерувати конкретну страву (сніданок/обід/вечеря)
   * POST /meal-plan/regenerate-meal/:mealPlanId
   */
  @Post('regenerate-meal/:id')
  @HttpCode(HttpStatus.OK)
  async regenerateMeal(
    @CurrentUser('familyId') familyId: string,
    @Param('id') mealPlanId: string,
  ) {
    return this.mealPlanService.regenerateMeal(familyId, mealPlanId);
  }

  /**
   * Видалити весь план харчування
   * DELETE /meal-plan
   */
  @Delete()
  @HttpCode(HttpStatus.OK)
  async deleteMealPlan(@CurrentUser('familyId') familyId: string) {
    return this.mealPlanService.deleteMealPlan(familyId);
  }
}