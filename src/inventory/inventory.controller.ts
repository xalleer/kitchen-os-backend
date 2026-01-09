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
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  AddToInventoryDto,
  UpdateInventoryItemDto,
  RemoveFromInventoryDto,
} from './dto/inventory.dto';
import { Type } from 'class-transformer';
import { IsInt, Min, IsOptional } from 'class-validator';

class ExpiringQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  daysAhead?: number;
}

@Controller('inventory')
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  getInventory(@CurrentUser('familyId') familyId: string) {
    return this.inventoryService.getInventory(familyId);
  }

  @Get('expiring')
  getExpiringProducts(
    @CurrentUser('familyId') familyId: string,
    @Query() query: ExpiringQueryDto,
  ) {
    return this.inventoryService.getExpiringProducts(
      familyId,
      query.daysAhead || 2,
    );
  }

  @Get(':id')
  getInventoryItem(
    @CurrentUser('familyId') familyId: string,
    @Param('id') id: string,
  ) {
    return this.inventoryService.getInventoryItem(familyId, id);
  }

  @Post()
  addToInventory(
    @CurrentUser('familyId') familyId: string,
    @Body() dto: AddToInventoryDto,
  ) {
    return this.inventoryService.addToInventory(familyId, dto);
  }

  @Patch(':id')
  updateInventoryItem(
    @CurrentUser('familyId') familyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateInventoryItemDto,
  ) {
    return this.inventoryService.updateInventoryItem(familyId, id, dto);
  }

  @Post(':id/remove')
  @HttpCode(HttpStatus.OK)
  removeFromInventory(
    @CurrentUser('familyId') familyId: string,
    @Param('id') id: string,
    @Body() dto: RemoveFromInventoryDto,
  ) {
    return this.inventoryService.removeFromInventory(familyId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  deleteInventoryItem(
    @CurrentUser('familyId') familyId: string,
    @Param('id') id: string,
  ) {
    return this.inventoryService.deleteInventoryItem(familyId, id);
  }
}