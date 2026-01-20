import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ShoppingListService } from './shopping-list.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  GenerateShoppingListDto,
  UpdateShoppingItemDto,
  AddManualItemDto,
  MarkAsBoughtDto,
} from './dto/shopping-list.dto';

@Controller('shopping-list')
@UseGuards(JwtAuthGuard)
export class ShoppingListController {
  constructor(private readonly shoppingListService: ShoppingListService) {}

  /**
   * Отримати поточний список покупок
   * GET /shopping-list
   */
  @Get()
  getShoppingList(@CurrentUser('familyId') familyId: string) {
    return this.shoppingListService.getShoppingList(familyId);
  }

  @Get('budget')
  getBudgetSummary(
    @CurrentUser('familyId') familyId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return this.shoppingListService.getBudgetSummary(familyId, start, end);
  }

  /**
   * Згенерувати список покупок на основі meal plan
   * POST /shopping-list/generate
   */
  @Post('generate')
  generateShoppingList(
    @CurrentUser('familyId') familyId: string,
    @Body() dto: GenerateShoppingListDto,
  ) {
    const startDate = dto.startDate ? new Date(dto.startDate) : undefined;
    const endDate = dto.endDate ? new Date(dto.endDate) : undefined;

    return this.shoppingListService.generateShoppingList(familyId, startDate, endDate);
  }

  /**
   * Додати продукт вручну до списку
   * POST /shopping-list/manual
   */
  @Post('manual')
  addManualItem(
    @CurrentUser('familyId') familyId: string,
    @Body() dto: AddManualItemDto,
  ) {
    return this.shoppingListService.addManualItem(
      familyId,
      dto.productId,
      dto.quantity,
      dto.note,
    );
  }

  /**
   * Оновити item в списку (змінити кількість, додати нотатку)
   * PATCH /shopping-list/:id
   */
  @Patch(':id')
  updateShoppingItem(
    @CurrentUser('familyId') familyId: string,
    @Param('id') itemId: string,
    @Body() dto: UpdateShoppingItemDto,
  ) {
    return this.shoppingListService.updateShoppingItem(
      familyId,
      itemId,
      dto.quantity,
      dto.manualNote,
    );
  }

  /**
   * Відмітити продукт як куплений/не куплений з можливістю вказати фактичну ціну
   * POST /shopping-list/:id/mark-bought
   */
  @Post(':id/mark-bought')
  @HttpCode(HttpStatus.OK)
  markAsBought(
    @CurrentUser('familyId') familyId: string,
    @Param('id') itemId: string,
    @Body() dto: MarkAsBoughtDto,
  ) {
    return this.shoppingListService.markAsBought(
      familyId,
      itemId,
      dto.isBought,
      dto.actualPrice,
    );
  }

  /**
   * Видалити item зі списку покупок
   * DELETE /shopping-list/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  deleteShoppingItem(
    @CurrentUser('familyId') familyId: string,
    @Param('id') itemId: string,
  ) {
    return this.shoppingListService.deleteShoppingItem(familyId, itemId);
  }

  /**
   * Завершити покупки - додати всі куплені продукти до інвентаря
   * POST /shopping-list/complete
   */
  @Post('complete')
  @HttpCode(HttpStatus.OK)
  completeShopping(@CurrentUser('familyId') familyId: string) {
    return this.shoppingListService.completeShopping(familyId);
  }

  /**
   * Очистити весь список покупок
   * DELETE /shopping-list
   */
  @Delete()
  @HttpCode(HttpStatus.OK)
  clearShoppingList(@CurrentUser('familyId') familyId: string) {
    return this.shoppingListService.clearShoppingList(familyId);
  }
}