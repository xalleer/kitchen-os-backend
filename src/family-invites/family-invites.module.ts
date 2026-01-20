import { Module } from '@nestjs/common';
import { FamilyInvitesService } from './family-invites.service';
import { FamilyInvitesController } from './family-invites.controller';

@Module({
  controllers: [FamilyInvitesController],
  providers: [FamilyInvitesService],
  exports: [FamilyInvitesService],
})
export class FamilyInvitesModule {}
