import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Param } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/forgot-password.dto';
import { JoinFamilyDto } from './dto/join-family.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('check-if-exist-user')
  checkIfExistUser(@Query('email') email: string) {
    return this.authService.checkIfExistingUser(email);
  }

  @HttpCode(HttpStatus.OK)
  @Post('google-login')
  async googleLogin(@Body() dto: GoogleLoginDto) {
    return this.authService.loginWithGoogle(dto.token);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('join-family')
  async joinFamily(@Body() dto: JoinFamilyDto) {
    return this.authService.joinFamily(dto);
  }

  @Get('invite/:code')
  async getInviteInfo(@Param('code') code: string) {
    return this.authService.getInviteInfo(code);
  }
}
