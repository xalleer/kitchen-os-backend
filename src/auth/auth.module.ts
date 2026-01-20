import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { FamilyInvitesModule } from '../family-invites/family-invites.module';

@Module({
  imports: [FamilyInvitesModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
