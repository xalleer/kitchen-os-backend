import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { OAuth2Client } from 'google-auth-library';
import {ConfigService} from '@nestjs/config';

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
      throw new BadRequestException('User is already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(dto.password, salt);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        password: hashedPassword,

        family: {
          create: {
            name: `${dto.name}'s Family`,
            budgetLimit: 0,
          },
        },

        preferences: {
          create: {
            age: dto.age,
            weight: dto.weight,
            height: dto.height,
            goal: dto.goal,
            allergies: dto.allergies || [],
            dislikedProducts: dto.dislikedProducts || [],

            ...(dto.eatsBreakfast !== undefined && { eatsBreakfast: dto.eatsBreakfast }),
            ...(dto.eatsLunch !== undefined && { eatsLunch: dto.eatsLunch }),
            ...(dto.eatsDinner !== undefined && { eatsDinner: dto.eatsDinner }),
            ...(dto.eatsSnack !== undefined && { eatsSnack: dto.eatsSnack }),
          }
        }
      },
      include: {
        family: true
      }
    })

    return this.generateToken(user.id, user.email, user.familyId!);
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
      const name = payload.name || `${payload.given_name} ${payload.family_name}`;

      let user = await this.prisma.user.findUnique({
        where: { email },
      });

      if (!user) {

        user = await this.prisma.user.create({
          data: {
            email: email,
            name: name,
            password: null,
            family: {
              create: {
                name: `${payload.given_name}'s Family`,
                budgetLimit: 0,
              },
            },
            preferences: {
              create: {
                weight: 0,
                height: 0,
                age: 0,
                goal: 'MAINTAIN',
                eatsBreakfast: true,
                eatsLunch: true,
                eatsDinner: true,
                eatsSnack: false,
              },
            },
          },
          include: { family: true }
        });
      }

      return this.generateToken(user.id, user.email, user.familyId!);

    } catch (error) {
      console.error(error);
      throw new UnauthorizedException('Invalid Google Token');
    }
  }

  private async generateToken(userId: string, email: string, familyId: string) {
    const payload = { sub: userId, email, familyId };
    return {
      access_token: await this.jwtService.signAsync(payload),
    };
  }
}
