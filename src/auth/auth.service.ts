import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

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

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateToken(user.id, user.email, user.familyId!);
  }

  private async generateToken(userId: string, email: string, familyId: string) {
    const payload = { sub: userId, email, familyId };
    return {
      access_token: await this.jwtService.signAsync(payload),
    };
  }
}
