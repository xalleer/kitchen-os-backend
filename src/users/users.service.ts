import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  UpdateProfileDto,
  ChangePasswordDto,
  UpdateUserPreferencesDto,
  CreateFamilyMemberDto,
  UpdateFamilyMemberDto,
  UpdateFamilyBudgetDto,
} from './dto/users.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}


  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        familyId: true,
        createdAt: true,
        family: {
          select: {
            id: true,
            name: true,
            budgetLimit: true,
          },
        },
        memberProfile: {
          select: {
            id: true,
            name: true,
            gender: true,
            weight: true,
            height: true,
            age: true,
            goal: true,
            eatsBreakfast: true,
            eatsLunch: true,
            eatsDinner: true,
            eatsSnack: true,
            allergies: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
        UserPreference: {
          include: {
            allergies: {
              select: {
                id: true,
                name: true,
                slug: true,
              }
            },
          }
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    if (dto.email) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });

      if (existingUser && existingUser.id !== userId) {
        throw new BadRequestException('Email already in use');
      }
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    return user;
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.password) {
      throw new BadRequestException('Cannot change password for Google Auth users');
    }

    const isPasswordValid = await bcrypt.compare(dto.oldPassword, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid old password');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(dto.newPassword, salt);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return { message: 'Password changed successfully' };
  }

  async updateUserPreferences(userId: string, dto: UpdateUserPreferencesDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { UserPreference: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { allergyIds, ...restData } = dto

    if (user.UserPreference) {
      return await this.prisma.userPreference.update({
        where: { userId },
        data: {
          ...restData,
          allergies: allergyIds
            ? { set: allergyIds.map((id) => ({ id })) }
            : undefined,
        },
        include: {
          allergies: {
            select: { id: true, name: true, slug: true },
          },
        },
      });
    } else {
      return await this.prisma.userPreference.create({
        data: {
          userId,
          ...restData,
          allergies: {
            connect: allergyIds?.map((id) => ({ id })) || [],
          },
        },
        include: {
          allergies: {
            select: { id: true, name: true, slug: true },
          },
        },
      });
    }
  }


  async getFamilyMembers(familyId: string) {
    if (!familyId) {
      throw new BadRequestException('User does not belong to a family');
    }

    const members = await this.prisma.familyMember.findMany({
      where: { familyId },
      include: {
        allergies: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return members;
  }

  async createFamilyMember(familyId: string, dto: CreateFamilyMemberDto) {
    if (!familyId) {
      throw new BadRequestException('User does not belong to a family');
    }

    if (dto.allergyIds && dto.allergyIds.length > 0) {
      const allergiesCount = await this.prisma.allergy.count({
        where: { id: { in: dto.allergyIds } },
      });

      if (allergiesCount !== dto.allergyIds.length) {
        throw new BadRequestException('Some allergy IDs are invalid');
      }
    }

    const member = await this.prisma.familyMember.create({
      data: {
        familyId,
        name: dto.name,
        gender: dto.gender || 'UNSPECIFIED',
        weight: dto.weight,
        height: dto.height,
        age: dto.age,
        goal: dto.goal || 'MAINTAIN',
        eatsBreakfast: dto.eatsBreakfast ?? true,
        eatsLunch: dto.eatsLunch ?? true,
        eatsDinner: dto.eatsDinner ?? true,
        eatsSnack: dto.eatsSnack ?? false,
        allergies: {
          connect: dto.allergyIds?.map((id) => ({ id })) || [],
        },
      },
      include: {
        allergies: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    return member;
  }

  async updateFamilyMember(
    familyId: string,
    memberId: string,
    dto: UpdateFamilyMemberDto,
  ) {
    if (!familyId) {
      throw new BadRequestException('User does not belong to a family');
    }

    const existingMember = await this.prisma.familyMember.findFirst({
      where: { id: memberId, familyId },
    });

    if (!existingMember) {
      throw new NotFoundException('Family member not found');
    }

    const updateData: any = {
      name: dto.name,
      gender: dto.gender,
      weight: dto.weight,
      height: dto.height,
      age: dto.age,
      goal: dto.goal,
      eatsBreakfast: dto.eatsBreakfast,
      eatsLunch: dto.eatsLunch,
      eatsDinner: dto.eatsDinner,
      eatsSnack: dto.eatsSnack,
    };

    if (dto.allergyIds !== undefined) {
      updateData.allergies = {
        set: dto.allergyIds.map((id) => ({ id })),
      };
    }

    const member = await this.prisma.familyMember.update({
      where: { id: memberId },
      data: updateData,
      include: {
        allergies: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    return member;
  }

  async deleteFamilyMember(familyId: string, memberId: string) {
    if (!familyId) {
      throw new BadRequestException('User does not belong to a family');
    }

    const member = await this.prisma.familyMember.findFirst({
      where: { id: memberId, familyId },
    });

    if (!member) {
      throw new NotFoundException('Family member not found');
    }

    if (member.userId) {
      throw new ForbiddenException('Cannot delete member linked to a user account');
    }

    await this.prisma.familyMember.delete({
      where: { id: memberId },
    });

    return { message: 'Family member deleted successfully' };
  }


  async updateFamilyBudget(familyId: string, dto: UpdateFamilyBudgetDto) {
    if (!familyId) {
      throw new BadRequestException('User does not belong to a family');
    }

    const family = await this.prisma.family.update({
      where: { id: familyId },
      data: { budgetLimit: dto.budgetLimit },
      select: {
        id: true,
        name: true,
        budgetLimit: true,
      },
    });

    return family;
  }
}