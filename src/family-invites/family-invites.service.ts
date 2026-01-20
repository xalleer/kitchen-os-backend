import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class FamilyInvitesService {
  constructor(private prisma: PrismaService) {}

  async getInvitesForFamily(familyId: string) {
    const family = await this.prisma.family.findUnique({
      where: { id: familyId },
      select: {
        id: true,
        name: true,
      },
    });

    if (!family) {
      throw new NotFoundException('Family not found');
    }

    const invites = await this.prisma.familyInvite.findMany({
      where: { familyId },
      orderBy: { createdAt: 'desc' },
      include: {
        familyMember: {
          select: {
            id: true,
            name: true,
            userId: true,
          },
        },
      },
    });

    return {
      familyName: family.name,
      invites: invites.map((i) => ({
        memberId: i.familyMember.id,
        memberName: i.familyMember.name,
        inviteCode: i.inviteCode,
        expiresAt: i.expiresAt,
        isUsed: !!i.usedAt,
        createdAt: i.createdAt,
        isMemberLinkedToUser: !!i.familyMember.userId,
      })),
    };
  }

  /**
   * Генерувати коди запрошення для всіх членів сім'ї
   */
  async generateInvitesForFamily(familyId: string) {
    const family = await this.prisma.family.findUnique({
      where: { id: familyId },
      include: {
        members: true,
      },
    });

    if (!family) {
      throw new NotFoundException('Family not found');
    }

    const invites: {
      memberId: string;
      memberName: string;
      inviteCode: string;
      expiresAt: Date | null;
      isUsed: boolean;
    }[] = [];

    const existingInvites = await this.prisma.familyInvite.findMany({
      where: {
        familyId,
        familyMemberId: {
          in: family.members.map((m) => m.id),
        },
      },
    });

    const existingByMemberId = new Map(
      existingInvites.map((i) => [i.familyMemberId, i]),
    );

    for (const member of family.members) {
      // Пропускаємо якщо вже є зв'язаний користувач
      if (member.userId) {
        continue;
      }

      const existingInvite = existingByMemberId.get(member.id);

      // Якщо вже є інвайт - повертаємо існуючий
      if (existingInvite) {
        invites.push({
          memberId: member.id,
          memberName: member.name,
          inviteCode: existingInvite.inviteCode,
          expiresAt: existingInvite.expiresAt,
          isUsed: !!existingInvite.usedAt,
        });
        continue;
      }

      const invite = await this.createInviteWithUniqueCode(familyId, member.id);

      invites.push({
        memberId: member.id,
        memberName: member.name,
        inviteCode: invite.inviteCode,
        expiresAt: invite.expiresAt,
        isUsed: false,
      });
    }

    return {
      familyName: family.name,
      invites,
    };
  }

  /**
   * Отримати інформацію про інвайт
   */
  async getInviteInfo(inviteCode: string) {
    const invite = await this.prisma.familyInvite.findUnique({
      where: { inviteCode },
      include: {
        family: {
          select: {
            id: true,
            name: true,
            budgetLimit: true,
          },
        },
        familyMember: {
          select: {
            id: true,
            name: true,
            gender: true,
            age: true,
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
      },
    });

    if (!invite) {
      throw new NotFoundException('Invite code not found');
    }

    // Перевірка терміну дії
    if (invite.expiresAt && invite.expiresAt < new Date()) {
      throw new BadRequestException('Invite code has expired');
    }

    // Перевірка чи вже використаний
    if (invite.usedAt) {
      throw new BadRequestException('Invite code has already been used');
    }

    return {
      familyId: invite.family.id,
      familyName: invite.family.name,
      budgetLimit: Number(invite.family.budgetLimit),
      memberInfo: {
        id: invite.familyMember.id,
        name: invite.familyMember.name,
        gender: invite.familyMember.gender,
        age: invite.familyMember.age,
        eatsBreakfast: invite.familyMember.eatsBreakfast,
        eatsLunch: invite.familyMember.eatsLunch,
        eatsDinner: invite.familyMember.eatsDinner,
        eatsSnack: invite.familyMember.eatsSnack,
        allergies: invite.familyMember.allergies,
      },
    };
  }

  /**
   * Використати інвайт код при реєстрації
   */
  async useInviteCode(inviteCode: string, userId: string, userEmail: string) {
    const invite = await this.prisma.familyInvite.findUnique({
      where: { inviteCode },
      include: {
        familyMember: true,
        family: true,
      },
    });

    if (!invite) {
      throw new NotFoundException('Invite code not found');
    }

    // Перевірка терміну дії
    if (invite.expiresAt && invite.expiresAt < new Date()) {
      throw new BadRequestException('Invite code has expired');
    }

    // Перевірка чи вже використаний
    if (invite.usedAt) {
      throw new BadRequestException('Invite code has already been used');
    }

    // Транзакція: оновлюємо invite, member і user
    await this.prisma.$transaction(async (prisma) => {
      // Оновлюємо інвайт
      await prisma.familyInvite.update({
        where: { id: invite.id },
        data: {
          usedAt: new Date(),
          usedByUserId: userId,
        },
      });

      // Прив'язуємо користувача до member
      await prisma.familyMember.update({
        where: { id: invite.familyMemberId },
        data: {
          userId,
        },
      });

      // Оновлюємо familyId у користувача
      await prisma.user.update({
        where: { id: userId },
        data: {
          familyId: invite.familyId,
        },
      });
    });

    return {
      message: 'Successfully joined family',
      familyId: invite.familyId,
      familyName: invite.family.name,
      memberName: invite.familyMember.name,
    };
  }

  /**
   * Регенерувати код запрошення
   */
  async regenerateInviteCode(familyId: string, memberId: string) {
    const member = await this.prisma.familyMember.findFirst({
      where: {
        id: memberId,
        familyId,
      },
    });

    if (!member) {
      throw new NotFoundException('Family member not found');
    }

    if (member.userId) {
      throw new BadRequestException('Member is already linked to a user');
    }

    await this.prisma.familyInvite.deleteMany({
      where: { familyMemberId: memberId },
    });

    const invite = await this.createInviteWithUniqueCode(familyId, memberId);

    return {
      memberId: member.id,
      memberName: member.name,
      inviteCode: invite.inviteCode,
      expiresAt: invite.expiresAt,
    };
  }

  /**
   * Генерувати унікальний 8-символьний код
   */
  private generateUniqueCode(): string {
    // Формат: XXXX-XXXX (8 символів + дефіс)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Без O, 0, I, 1 для зручності
    let code = '';

    for (let i = 0; i < 8; i++) {
      if (i === 4) {
        code += '-';
      }
      const randomIndex = crypto.randomInt(0, chars.length);
      code += chars[randomIndex];
    }

    return code;
  }

  private async createInviteWithUniqueCode(familyId: string, memberId: string) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    for (let attempt = 0; attempt < 5; attempt++) {
      const inviteCode = this.generateUniqueCode();

      try {
        return await this.prisma.familyInvite.create({
          data: {
            familyId,
            familyMemberId: memberId,
            inviteCode,
            expiresAt,
          },
        });
      } catch (e: any) {
        if (e?.code === 'P2002') {
          continue;
        }
        throw e;
      }
    }

    throw new BadRequestException('Failed to generate unique invite code');
  }
}