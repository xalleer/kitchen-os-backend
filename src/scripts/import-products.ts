import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ProductsService } from '../products/products.service';
import * as fs from 'fs';
import * as path from 'path';
import { Unit } from '@prisma/client';

interface ImportedProduct {
  name: string;
  category: string;
  baseUnit: 'G' | 'ML' | 'PCS';
  originalTitle?: string;
  price?: number;
}

interface ImportData {
  products: ImportedProduct[];
  byCategory?: Record<string, ImportedProduct[]>;
}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const productsService = app.get(ProductsService);

  // Шлях до JSON файлу
  const jsonPath = path.join(__dirname, '../../example/atb_products.json');
  
  if (!fs.existsSync(jsonPath)) {
    console.error(`❌ Файл ${jsonPath} не знайдено!`);
    console.log('Спочатку запустіть Python скрипт для парсингу продуктів.');
    await app.close();
    process.exit(1);
  }

  console.log('📦 Завантаження продуктів з JSON...');
  const fileContent = fs.readFileSync(jsonPath, 'utf-8');
  const parsedData = JSON.parse(fileContent);

  // Перевіряємо формат даних (новий формат: { products: [], byCategory: {} } або старий: [])
  let products: ImportedProduct[] = [];
  
  if (Array.isArray(parsedData)) {
    // Старий формат - просто масив
    console.error('❌ JSON файл містить старий формат або порожній!');
    console.log('💡 Будь ласка, запустіть Python скрипт для парсингу продуктів:');
    console.log('   cd example && python atb.py');
    await app.close();
    process.exit(1);
  } else if (parsedData && typeof parsedData === 'object' && 'products' in parsedData) {
    // Новий формат
    products = (parsedData as ImportData).products || [];
  } else {
    console.error('❌ Невірний формат JSON файлу!');
    console.log('💡 Очікується об\'єкт з полем "products". Запустіть Python скрипт:');
    console.log('   cd example && python atb.py');
    await app.close();
    process.exit(1);
  }

  if (products.length === 0) {
    console.error('❌ JSON файл порожній або не містить продуктів!');
    console.log('💡 Будь ласка, запустіть Python скрипт для парсингу продуктів:');
    console.log('   cd example && python atb.py');
    await app.close();
    process.exit(1);
  }

  console.log(`📊 Знайдено ${products.length} продуктів для імпорту`);

  // Формуємо дані для імпорту
  const productsToImport = products.map((product) => ({
    name: product.name.trim(),
    category: product.category || undefined,
    baseUnit: product.baseUnit as Unit,
    price: typeof product.price === 'number' ? product.price : undefined,
    caloriesPer100: undefined, // Можна додати пізніше
    standardAmount: undefined, // Можна додати пізніше
    image: undefined, // Можна додати пізніше
  }));

  console.log('\n🔄 Імпорт продуктів у базу даних...');
  try {
    const result = await productsService.seedProducts(productsToImport);
    console.log('\n✅ Імпорт завершено!');
    console.log(`   - Створено: ${result.created}`);
    console.log(`   - Пропущено (вже існують): ${result.skipped}`);
    console.log(`   - Всього: ${result.total}`);
  } catch (error) {
    console.error('\n❌ Помилка при імпорті:', error);
    await app.close();
    process.exit(1);
  }

  await app.close();
  process.exit(0);
}

bootstrap();
