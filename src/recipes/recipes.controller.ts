import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { RecipesService } from './recipes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  GenerateRecipeDto,
  GenerateCustomRecipeDto,
  SaveRecipeDto,
  CookRecipeDto,
  CookRecipePreviewDto,
} from './dto/recipes.dto';

@Controller('recipes')
@UseGuards(JwtAuthGuard)
export class RecipesController {
  constructor(private readonly recipesService: RecipesService) {}

  @Get()
  getSavedRecipes(@CurrentUser('familyId') familyId: string) {
    return this.recipesService.getSavedRecipes(familyId);
  }

  @Get('expiring')
  getExpiringProductsRecipes(@CurrentUser('familyId') familyId: string) {
    return this.recipesService.getExpiringProductsRecipes(familyId);
  }

  @Get(':id')
  getRecipeById(@Param('id') id: string) {
    return this.recipesService.getRecipeById(id);
  }

  @Post('generate/from-inventory')
  generateRecipeFromInventory(
    @CurrentUser('familyId') familyId: string,
    @Body('portions') portions?: number,
  ) {
    return this.recipesService.generateRecipeFromInventory(
      familyId,
      portions || 2,
    );
  }

  @Post('generate/from-products')
  generateRecipeFromProducts(
    @CurrentUser('familyId') familyId: string,
    @Body() dto: GenerateRecipeDto,
  ) {
    return this.recipesService.generateRecipeFromProducts(familyId, dto);
  }

  @Post('generate/custom')
  generateCustomRecipe(
    @CurrentUser('familyId') familyId: string,
    @Body() dto: GenerateCustomRecipeDto,
  ) {
    return this.recipesService.generateCustomRecipe(familyId, dto);
  }

  @Post('save')
  saveRecipe(@Body() dto: SaveRecipeDto) {
    return this.recipesService.saveRecipe(dto);
  }

  @Post('cook')
  @HttpCode(HttpStatus.OK)
  cookRecipe(
    @CurrentUser('familyId') familyId: string,
    @Body() dto: CookRecipeDto,
  ) {
    return this.recipesService.cookRecipe(familyId, dto);
  }

  @Post('cook/preview')
  @HttpCode(HttpStatus.OK)
  cookRecipePreview(
    @CurrentUser('familyId') familyId: string,
    @Body() dto: CookRecipePreviewDto,
  ) {
    return this.recipesService.cookRecipePreview(familyId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  deleteRecipe(@Param('id') id: string) {
    return this.recipesService.deleteRecipe(id);
  }
}