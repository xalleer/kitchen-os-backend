import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from './prisma.service';

interface AllergyData {
  name: string;
  slug: string;
}

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  private readonly defaultAllergies: AllergyData[] = [
    { name: 'Глютен', slug: 'gluten' },
    { name: 'Молочні продукти', slug: 'dairy' },
    { name: 'Яйця', slug: 'eggs' },
    { name: 'Горіхи', slug: 'nuts' },
    { name: 'Арахіс', slug: 'peanuts' },
    { name: 'Соя', slug: 'soy' },
    { name: 'Риба', slug: 'fish' },
    { name: 'Морепродукти', slug: 'shellfish' },
    { name: 'Пшениця', slug: 'wheat' },
    { name: 'Кунжут', slug: 'sesame' },
    { name: 'Гірчиця', slug: 'mustard' },
    { name: 'Селера', slug: 'celery' },
    { name: 'Люпин', slug: 'lupin' },
    { name: 'Молюски', slug: 'molluscs' },
    { name: 'Сульфіти', slug: 'sulfites' },
    { name: 'Лактоза', slug: 'lactose' },
    { name: 'Фруктоза', slug: 'fructose' },
    { name: 'Мед', slug: 'honey' },
    { name: 'Цитрусові', slug: 'citrus' },
    { name: 'Полуниця', slug: 'strawberry' },
  ];

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedAllergies();
  }

  private async seedAllergies() {
    try {
      const existingCount = await this.prisma.allergy.count();
      
      if (existingCount > 0) {
        this.logger.log(`✅ Allergies already seeded (${existingCount} items)`);
        return;
      }

      this.logger.log('🌱 Seeding allergies...');
      
      const result = await this.prisma.allergy.createMany({
        data: this.defaultAllergies,
        skipDuplicates: true,
      });

      this.logger.log(`✅ Seeded ${result.count} allergies`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ Failed to seed allergies: ${message}`);
    }
  }
}
