import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WeeklyBudgetService {
  constructor(private prisma: PrismaService) {}

  /**
   * Отримати або створити тижневий бюджет
   */
  async getOrCreateWeeklyBudget(familyId: string, date: Date = new Date()) {
    const { weekStartDate, weekEndDate } = this.getWeekBoundaries(date);

    let weeklyBudget = await this.prisma.weeklyBudget.findUnique({
      where: {
        familyId_weekStartDate: {
          familyId,
          weekStartDate,
        },
      },
    });

    const family = await this.prisma.family.findUnique({
      where: { id: familyId },
      select: { budgetLimit: true },
    });

    if (!family) {
      throw new NotFoundException('Family not found');
    }

    const desiredTotalBudget = Number(family.budgetLimit || 0);

    if (!weeklyBudget) {
      weeklyBudget = await this.prisma.weeklyBudget.create({
        data: {
          familyId,
          weekStartDate,
          weekEndDate,
          totalBudget: desiredTotalBudget,
          spent: 0,
          remaining: desiredTotalBudget,
        },
      });
    } else {
      const currentTotalBudget = Number(weeklyBudget.totalBudget);
      const currentSpent = Number(weeklyBudget.spent);
      const desiredRemaining = desiredTotalBudget - currentSpent;
      const currentRemaining = Number(weeklyBudget.remaining);

      if (currentTotalBudget !== desiredTotalBudget || currentRemaining !== desiredRemaining) {
        weeklyBudget = await this.prisma.weeklyBudget.update({
          where: { id: weeklyBudget.id },
          data: {
            totalBudget: desiredTotalBudget,
            remaining: desiredRemaining,
          },
        });
      }
    }

    return weeklyBudget;
  }

  /**
   * Додати витрату до тижневого бюджету
   */
  async addExpense(familyId: string, amount: number, date: Date = new Date()) {
    const weeklyBudget = await this.getOrCreateWeeklyBudget(familyId, date);

    const newSpent = Number(weeklyBudget.spent) + amount;
    const newRemaining = Number(weeklyBudget.totalBudget) - newSpent;

    const updated = await this.prisma.weeklyBudget.update({
      where: { id: weeklyBudget.id },
      data: {
        spent: newSpent,
        remaining: newRemaining,
      },
    });

    return {
      weeklyBudget: updated,
      isOverBudget: newRemaining < 0,
      remaining: newRemaining,
    };
  }

  /**
   * Відняти витрату (якщо продукт видалили з інвентаря)
   */
  async removeExpense(familyId: string, amount: number, date: Date = new Date()) {
    const weeklyBudget = await this.getOrCreateWeeklyBudget(familyId, date);

    const newSpent = Math.max(0, Number(weeklyBudget.spent) - amount);
    const newRemaining = Number(weeklyBudget.totalBudget) - newSpent;

    const updated = await this.prisma.weeklyBudget.update({
      where: { id: weeklyBudget.id },
      data: {
        spent: newSpent,
        remaining: newRemaining,
      },
    });

    return updated;
  }

  /**
   * Отримати поточний бюджет тижня
   */
  async getCurrentWeekBudget(familyId: string) {
    const weeklyBudget = await this.getOrCreateWeeklyBudget(familyId);

    return {
      weekStartDate: weeklyBudget.weekStartDate,
      weekEndDate: weeklyBudget.weekEndDate,
      totalBudget: Number(weeklyBudget.totalBudget),
      spent: Number(weeklyBudget.spent),
      remaining: Number(weeklyBudget.remaining),
      isOverBudget: Number(weeklyBudget.remaining) < 0,
      spentPercentage: Number(weeklyBudget.totalBudget) > 0 
        ? Math.round((Number(weeklyBudget.spent) / Number(weeklyBudget.totalBudget)) * 100)
        : 0,
    };
  }

  /**
   * Отримати бюджет за період
   */
  async getBudgetForPeriod(familyId: string, startDate: Date, endDate: Date) {
    const budgets = await this.prisma.weeklyBudget.findMany({
      where: {
        familyId,
        weekStartDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: {
        weekStartDate: 'desc',
      },
    });

    const totalSpent = budgets.reduce((sum, b) => sum + Number(b.spent), 0);
    const totalBudget = budgets.reduce((sum, b) => sum + Number(b.totalBudget), 0);

    return {
      budgets: budgets.map(b => ({
        weekStartDate: b.weekStartDate,
        weekEndDate: b.weekEndDate,
        totalBudget: Number(b.totalBudget),
        spent: Number(b.spent),
        remaining: Number(b.remaining),
      })),
      summary: {
        totalBudget,
        totalSpent,
        totalRemaining: totalBudget - totalSpent,
        averageSpentPerWeek: budgets.length > 0 ? Math.round(totalSpent / budgets.length) : 0,
      },
    };
  }

  /**
   * Отримати межі тижня (понеділок - неділя)
   */
  private getWeekBoundaries(date: Date): { weekStartDate: Date; weekEndDate: Date } {
    const currentDate = new Date(date);
    currentDate.setHours(0, 0, 0, 0);

    const dayOfWeek = currentDate.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    
    const weekStartDate = new Date(currentDate);
    weekStartDate.setDate(currentDate.getDate() + diffToMonday);

    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekStartDate.getDate() + 6);
    weekEndDate.setHours(23, 59, 59, 999);

    return { weekStartDate, weekEndDate };
  }
}