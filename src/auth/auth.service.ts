import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { OwnerProfileDto, RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { OAuth2Client } from 'google-auth-library';
import {ConfigService} from '@nestjs/config';
import { Gender, Goal } from '@prisma/client';

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client;
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService
  ) {
    const googleClientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    this.googleClient = new OAuth2Client(googleClientId);
  }

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

      await prisma.familyMember.create({
        data: this.prepareMemberData(safeOwnerProfile, family.id, user.id),
      });

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
