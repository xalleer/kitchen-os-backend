import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto, OwnerProfileDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { LoginDto } from './dto/login.dto';
import { OAuth2Client } from 'google-auth-library';
import {ConfigService} from '@nestjs/config';
import { Gender, Goal } from '@prisma/client';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/forgot-password.dto';
import { MailService } from '../mail/mail.service';
import { FamilyInvitesService } from '../family-invites/family-invites.service';
import { JoinFamilyDto } from './dto/join-family.dto';

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client;
  
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private mailService: MailService,
    private familyInvitesService: FamilyInvitesService, // ⭐ НОВЕ
  ) {
    const googleClientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    this.googleClient = new OAuth2Client(googleClientId);
  }

  // ⭐ НОВА ФУНКЦІЯ: Реєстрація через інвайт код
  public async joinFamily(dto: JoinFamilyDto) {
    // Перевіряємо чи існує користувач
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    // Отримуємо інформацію з інвайту
    const inviteInfo = await this.familyInvitesService.getInviteInfo(dto.inviteCode);

    // Хешуємо пароль
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(dto.password, salt);

    // Створюємо користувача і прив'язуємо до сім'ї
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        name: dto.name || inviteInfo.memberInfo.name,
        familyId: inviteInfo.familyId,
      },
    });

    // Використовуємо інвайт код
    await this.familyInvitesService.useInviteCode(
      dto.inviteCode,
      user.id,
      user.email,
    );

    // Оновлюємо дані члена сім'ї якщо користувач вказав додаткові параметри
    if (dto.weight || dto.height || dto.age || dto.goal) {
      await this.prisma.familyMember.update({
        where: { id: inviteInfo.memberInfo.id },
        data: {
          weight: dto.weight,
          height: dto.height,
          age: dto.age,
          goal: dto.goal || inviteInfo.memberInfo.eatsBreakfast ? 'MAINTAIN' : undefined,
        },
      });
    }

    return this.generateToken(user.id, user.email, inviteInfo.familyId);
  }

  // ⭐ НОВА ФУНКЦІЯ: Отримати інформацію про інвайт (для UI)
  public async getInviteInfo(inviteCode: string) {
    return this.familyInvitesService.getInviteInfo(inviteCode);
  }

  // Існуюча функція register - БЕЗ ЗМІН
  public async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new BadRequestException('User already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(dto.password, salt);

    const safeOwnerProfile = dto.ownerProfile || {
      name: dto.name,
      age: null, weight: null, height: null, gender: 'UNSPECIFIED', goal: 'MAINTAIN',
      allergies: [], dislikedProducts: [],
      eatsBreakfast: true, eatsLunch: true, eatsDinner: true, eatsSnack: false,
    };

    const result = await this.prisma.$transaction(async (prisma) => {
      const family = await prisma.family.create({
        data: {
          name: `${dto.name}'s Family`,
          budgetLimit: dto.budgetLimit || 0,
        },
      });

      const user = await prisma.user.create({
        data: {
          email: dto.email,
          name: dto.name,
          password: hashedPassword,
          familyId: family.id,
        },
      });

      // Створюємо owner member profile
      await prisma.familyMember.create({
        data: this.prepareMemberData(safeOwnerProfile, family.id, user.id),
      });

      // Створюємо інших членів сім'ї
      if (dto.familyMembers && dto.familyMembers.length > 0) {
        for (const member of dto.familyMembers) {
          await prisma.familyMember.create({
            data: this.prepareMemberData(member, family.id, null),
          });
        }
      }

      return { user, family };
    });

    return this.generateToken(result.user.id, result.user.email, result.family.id);
  }

  // Решта функцій БЕЗ ЗМІН
  public async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.password) {
      throw new UnauthorizedException('Please login with Google');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateToken(user.id, user.email, user.familyId!);
  }

  public async loginWithGoogle(token: string) {
    try {
      const googleClientId = this.configService.get<string>('GOOGLE_CLIENT_ID');

      const ticket = await this.googleClient.verifyIdToken({
        idToken: token,
        audience: googleClientId,
      });

      const payload = ticket.getPayload();

      if (!payload || !payload.email) {
        throw new UnauthorizedException('Invalid Google Token: Email is missing');
      }

      const email = payload.email;
      const name = payload.name || payload.given_name || 'User';

      let user = await this.prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        user = await this.prisma.$transaction(async (prisma) => {
          const family = await prisma.family.create({
            data: {
              name: `${payload.given_name || name}'s Family`,
              budgetLimit: 0,
            },
          });

          const newUser = await prisma.user.create({
            data: {
              email: email,
              name: name,
              password: null,
              familyId: family.id,
            },
          });

          await prisma.familyMember.create({
            data: {
              familyId: family.id,
              userId: newUser.id,
              name: name,
              gender: Gender.UNSPECIFIED,
              goal: Goal.MAINTAIN,
              eatsBreakfast: true,
              eatsLunch: true,
              eatsDinner: true,
              eatsSnack: false,
              allergies: { connect: [] },
            },
          });

          return newUser;
        });
      }

      return this.generateToken(user.id, user.email, user.familyId!);
    } catch (error) {
      console.error(error);
      throw new UnauthorizedException('Invalid Google Token');
    }
  }

  private prepareMemberData(memberDto: OwnerProfileDto, familyId: string, userId: string | null) {
    return {
      familyId: familyId,
      userId: userId,
      name: memberDto.name,

      age: memberDto.age ?? null,
      weight: memberDto.weight ?? null,
      height: memberDto.height ?? null,
      goal: memberDto.goal || 'MAINTAIN',
      gender: memberDto.gender || 'UNSPECIFIED',

      eatsBreakfast: memberDto.eatsBreakfast ?? true,
      eatsLunch: memberDto.eatsLunch ?? true,
      eatsDinner: memberDto.eatsDinner ?? true,
      eatsSnack: memberDto.eatsSnack ?? false,

      allergies: {
        connect: memberDto.allergyIds?.map((id) => ({ id })) || [],
      },
    };
  }

  public async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.password) return;

    const code = crypto.randomInt(100000, 999999).toString();

    const salt = await bcrypt.genSalt(10);
    const codeHash = await bcrypt.hash(code, salt);

    const expiration = new Date(Date.now() + 15 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetCodeHash: codeHash,
        passwordResetExpires: expiration,
      },
    });

    await this.mailService.sendResetPasswordEmail(user.email, code);
  }

  public async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (
      !user ||
      !user.passwordResetCodeHash ||
      !user.passwordResetExpires ||
      user.passwordResetExpires < new Date()
    ) {
      throw new BadRequestException('Invalid or expired code');
    }

    const isCodeValid = await bcrypt.compare(dto.code, user.passwordResetCodeHash);

    if (!isCodeValid) {
      throw new BadRequestException('Invalid code');
    }

    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(dto.newPassword, salt);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: newPasswordHash,
        passwordResetCodeHash: null,
        passwordResetExpires: null,
      },
    });
  }

  public async checkIfExistingUser(email: string) {
    return !!(await this.prisma.user.findUnique({ where: { email } }));
  }

  private async generateToken(userId: string, email: string, familyId: string) {
    const payload = { sub: userId, email, familyId };
    return {
      access_token: await this.jwtService.signAsync(payload),
    };
  }
}