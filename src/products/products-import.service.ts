import { Injectable, Logger } from '@nestjs/common';
import { ProductsService } from './products.service';
import { AiService, ProductNormalizationParams } from '../ai/ai.service';
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

@Injectable()
export class ProductsImportService {
  private readonly logger = new Logger(ProductsImportService.name);

  constructor(
    private readonly productsService: ProductsService,
    private readonly aiService: AiService,
  ) {}

  async importProductsFromJson(): Promise<{
    success: boolean;
    created: number;
    updated: number;
    total: number;
    error?: string;
  }> {
    try {
      // Шлях до JSON файлу
      const jsonPath = path.join(process.cwd(), 'example', 'atb_products.json');

      if (!fs.existsSync(jsonPath)) {
        this.logger.error(`Файл ${jsonPath} не знайдено!`);
        return {
          success: false,
          created: 0,
          updated: 0,
          total: 0,
          error: 'JSON файл не знайдено. Спочатку запустіть Python скрипт для парсингу продуктів.',
        };
      }

      this.logger.log('📦 Завантаження продуктів з JSON...');
      const fileContent = fs.readFileSync(jsonPath, 'utf-8');
      const parsedData = JSON.parse(fileContent);

      // Перевіряємо формат даних (новий формат: { products: [], byCategory: {} } або старий: [])
      let products: ImportedProduct[] = [];
      
      if (Array.isArray(parsedData)) {
        // Старий формат - просто масив
        this.logger.warn('⚠️ Знайдено старий формат JSON (масив). Очікується новий формат з об\'єктом.');
        return {
          success: false,
          created: 0,
          updated: 0,
          total: 0,
          error: 'JSON файл містить старий формат або порожній. Будь ласка, запустіть Python скрипт для парсингу продуктів: cd example && python atb.py',
        };
      } else if (parsedData && typeof parsedData === 'object' && 'products' in parsedData) {
        // Новий формат
        products = parsedData.products || [];
      } else {
        return {
          success: false,
          created: 0,
          updated: 0,
          total: 0,
          error: 'Невірний формат JSON файлу. Очікується об\'єкт з полем "products". Запустіть Python скрипт: cd example && python atb.py',
        };
      }

      if (products.length === 0) {
        this.logger.error('JSON файл порожній або не містить продуктів!');
        return {
          success: false,
          created: 0,
          updated: 0,
          total: 0,
          error: 'JSON файл не містить продуктів. Будь ласка, запустіть Python скрипт для парсингу продуктів: cd example && python atb.py',
        };
      }

      this.logger.log(`📊 Знайдено ${products.length} продуктів для імпорту`);

      // Використовуємо AI для нормалізації продуктів
      this.logger.log('🤖 Запуск AI нормалізації продуктів...');
      
      const productsToNormalize: ProductNormalizationParams[] = products.map(
        (product) => ({
          originalTitle: product.originalTitle || product.name,
          category: product.category || 'Інше',
        }),
      );

      let normalizedProducts;
      try {
        normalizedProducts = await this.aiService.normalizeProducts(
          productsToNormalize,
        );
        this.logger.log(
          `✅ AI нормалізація завершена: ${normalizedProducts.length} продуктів оброблено`,
        );
      } catch (error: any) {
        this.logger.error(
          `❌ Помилка AI нормалізації: ${error.message}. Використовую оригінальні назви.`,
        );
        // Fallback до оригінальних даних
        normalizedProducts = products.map((product) => ({
          name: product.name.trim(),
          category: product.category || 'Інше',
          baseUnit: product.baseUnit,
        }));
      }

      // Формуємо дані для імпорту
      const productsToImport = normalizedProducts.map((product, index) => {
  const originalPrice = products[index]?.price;
  const normalizedPrice = product.price;

  const price =
    typeof normalizedPrice === 'number' && Number.isFinite(normalizedPrice) && normalizedPrice > 0
      ? normalizedPrice
      : typeof originalPrice === 'number' && Number.isFinite(originalPrice) && originalPrice > 0
        ? originalPrice
        : undefined;

  return {
    name: product.name.trim(),
    category: product.category || 'Інше',
    baseUnit: product.baseUnit as Unit,
    caloriesPer100:
      typeof product.caloriesPer100 === 'number'
        ? product.caloriesPer100
        : undefined,
    averagePrice: price || 0, // ⭐ ВИПРАВЛЕНО
    standardAmount: undefined,
    image: undefined,
  };
});

      this.logger.log('🔄 Імпорт продуктів у базу даних...');
      const result = await this.productsService.seedProducts(productsToImport);

      this.logger.log('✅ Імпорт завершено!');
      this.logger.log(`   - Створено: ${result.created}`);
      this.logger.log(`   - Оновлено: ${result.updated}`);
      this.logger.log(`   - Всього: ${result.total}`);

      return {
        success: true,
        created: result.created,
        updated: result.updated,
        total: result.total,
      };
    } catch (error: any) {
      this.logger.error(`❌ Помилка при імпорті: ${error.message}`, error.stack);
      return {
        success: false,
        created: 0,
        updated: 0,
        total: 0,
        error: error.message,
      };
    }
  }
}
