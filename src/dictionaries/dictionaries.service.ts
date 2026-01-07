import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAllergiesDto } from './dto/create-dictionary.dto';

@Injectable()
export class DictionariesService {
  constructor(private prisma: PrismaService) {}


  async addAllergies(dto: CreateAllergiesDto) {
    const result = await this.prisma.allergy.createMany({
      data: dto.allergies,
      skipDuplicates: true,
    });
    return { message: `Added ${result.count} allergies` };
  }

  async getAllergies() {
    return this.prisma.allergy.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true
      }
    });
  }

}