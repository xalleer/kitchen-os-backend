import { IsEmail, IsString, Length, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsEmail()
  email: string;

  @IsString()
  @Length(6, 6, { message: 'Code must be exactly 6 digits' })
  code: string;

  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  newPassword: string;
}

export class ForgotPasswordDto {
  @IsEmail({}, { message: 'Please provide a valid email' })
  email: string;
}