import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FamilyInvitesService } from './family-invites.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('family/invites')
@UseGuards(JwtAuthGuard)
export class FamilyInvitesController {
  constructor(private readonly familyInvitesService: FamilyInvitesService) {}

  @Get()
  getAllInvites(@CurrentUser('familyId') familyId: string) {
    return this.familyInvitesService.getInvitesForFamily(familyId);
  }

  @Post('generate')
  @HttpCode(HttpStatus.OK)
  generateInvites(@CurrentUser('familyId') familyId: string) {
    return this.familyInvitesService.generateInvitesForFamily(familyId);
  }

  @Post(':memberId/regenerate')
  @HttpCode(HttpStatus.OK)
  regenerateInvite(
    @CurrentUser('familyId') familyId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.familyInvitesService.regenerateInviteCode(familyId, memberId);
  }
}
