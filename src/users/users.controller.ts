import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  UpdateProfileDto,
  ChangePasswordDto,
  UpdateUserPreferencesDto,
  CreateFamilyMemberDto,
  UpdateFamilyMemberDto,
  UpdateFamilyBudgetDto,
} from './dto/users.dto';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  getProfile(@CurrentUser('sub') userId: string) {
    return this.usersService.getProfile(userId);
  }

  @Patch('profile')
  updateProfile(
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(userId, dto);
  }

  @Patch('password')
  @HttpCode(HttpStatus.OK)
  changePassword(
    @CurrentUser('sub') userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(userId, dto);
  }

  @Patch('preferences')
  updateUserPreferences(
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateUserPreferencesDto,
  ) {
    return this.usersService.updateUserPreferences(userId, dto);
  }

  @Get('family/members')
  getFamilyMembers(@CurrentUser('familyId') familyId: string) {
    return this.usersService.getFamilyMembers(familyId);
  }

  @Post('family/members')
  createFamilyMember(
    @CurrentUser('familyId') familyId: string,
    @Body() dto: CreateFamilyMemberDto,
  ) {
    return this.usersService.createFamilyMember(familyId, dto);
  }

  @Patch('family/members/:id')
  updateFamilyMember(
    @CurrentUser('familyId') familyId: string,
    @Param('id') memberId: string,
    @Body() dto: UpdateFamilyMemberDto,
  ) {
    return this.usersService.updateFamilyMember(familyId, memberId, dto);
  }

  @Delete('family/members/:id')
  @HttpCode(HttpStatus.OK)
  deleteFamilyMember(
    @CurrentUser('familyId') familyId: string,
    @Param('id') memberId: string,
  ) {
    return this.usersService.deleteFamilyMember(familyId, memberId);
  }

  @Patch('family/budget')
  updateFamilyBudget(
    @CurrentUser('familyId') familyId: string,
    @Body() dto: UpdateFamilyBudgetDto,
  ) {
    return this.usersService.updateFamilyBudget(familyId, dto);
  }
}