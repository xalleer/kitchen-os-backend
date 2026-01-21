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
    private familyInvitesService: FamilyInvitesService,
  ) {
    const googleClientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    this.googleClient = new OAuth2Client(googleClientId);
  }

  // ⭐ НОВА ФУНКЦІЯ: Реєстрація через інвайт код
  public async joinFamily(dto: JoinFamilyDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    const inviteInfo = await this.familyInvitesService.getInviteInfo(dto.inviteCode);

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(dto.password, salt);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        name: dto.name || inviteInfo.memberInfo.name,
        familyId: inviteInfo.familyId,
      },
    });

    await this.familyInvitesService.useInviteCode(
      dto.inviteCode,
      user.id,
      user.email,
    );

    if (dto.weight || dto.height || dto.age || dto.goal) {
      await this.prisma.familyMember.update({
        where: { id: inviteInfo.memberInfo.id },
        data: {
          weight: dto.weight,
          height: dto.height,
          age: dto.age,
          goal: dto.goal || 'MAINTAIN',
        },
      });
    }

    return this.generateToken(user.id, user.email, inviteInfo.familyId);
  }

  public async getInviteInfo(inviteCode: string) {
    return this.familyInvitesService.getInviteInfo(inviteCode);
  }

  // ⭐ ВИПРАВЛЕНА функція register
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
      age: null,
      weight: null,
      height: null,
      gender: 'UNSPECIFIED',
      goal: 'MAINTAIN',
      allergyIds: [], // ⭐ ВИПРАВЛЕНО: allergyIds замість allergies
      eatsBreakfast: true,
      eatsLunch: true,
      eatsDinner: true,
      eatsSnack: false,
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

      // ⭐ ВИПРАВЛЕНО: додано await
      const ownerMemberData = await this.prepareMemberData(safeOwnerProfile, family.id, user.id);
      await prisma.familyMember.create({
        data: ownerMemberData,
      });

      // ⭐ ВИПРАВЛЕНО: додано await для кожного member
      if (dto.familyMembers && dto.familyMembers.length > 0) {
        for (const member of dto.familyMembers) {
          const memberData = await this.prepareMemberData(member, family.id, null);
          await prisma.familyMember.create({
            data: memberData,
          });
        }
      }

      return { user, family };
    });

    return this.generateToken(result.user.id, result.user.email, result.family.id);
  }

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

  // ⭐ ВИПРАВЛЕНА функція prepareMemberData - тепер async
  private async prepareMemberData(memberDto: OwnerProfileDto, familyId: string, userId: string | null) {
    // Перевіряємо чи існують алергії перед підключенням
    let validAllergyIds: string[] = [];

    if (memberDto.allergyIds && memberDto.allergyIds.length > 0) {
      const existingAllergies = await this.prisma.allergy.findMany({
        where: {
          id: { in: memberDto.allergyIds }
        },
        select: { id: true }
      });

      validAllergyIds = existingAllergies.map(a => a.id);

      // Логування для debug
      if (validAllergyIds.length !== memberDto.allergyIds.length) {
        console.warn(`⚠️ Some allergy IDs were not found. Requested: ${memberDto.allergyIds.length}, Found: ${validAllergyIds.length}`);
      }
    }

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
        connect: validAllergyIds.map((id) => ({ id })),
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