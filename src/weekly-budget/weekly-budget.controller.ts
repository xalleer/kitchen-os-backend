import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { WeeklyBudgetService } from './weekly-budget.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { IsDateString, IsOptional } from 'class-validator';

class BudgetPeriodQueryDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

@Controller('weekly-budget')
@UseGuards(JwtAuthGuard)
export class WeeklyBudgetController {
  constructor(private readonly weeklyBudgetService: WeeklyBudgetService) {}

  @Get('current')
  getCurrent(@CurrentUser('familyId') familyId: string) {
    return this.weeklyBudgetService.getCurrentWeekBudget(familyId);
  }

  @Get('period')
  getPeriod(
    @CurrentUser('familyId') familyId: string,
    @Query() query: BudgetPeriodQueryDto,
  ) {
    if (!query.startDate || !query.endDate) {
      return this.weeklyBudgetService.getBudgetForPeriod(
        familyId,
        new Date(0),
        new Date(),
      );
    }

    return this.weeklyBudgetService.getBudgetForPeriod(
      familyId,
      new Date(query.startDate),
      new Date(query.endDate),
    );
  }
}
