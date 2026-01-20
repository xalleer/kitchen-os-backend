import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  GenerateRecipeParams,
  RecipeResponse,
  MealPlanParams,
  MealPlanResponse,
  ProductNormalizationParams,
  NormalizedProduct,
} from './ai.types';
import { buildRecipePrompt, buildExpiringProductsRecipePrompt } from './prompts/recipe.prompts';
import { buildMealPlanPrompt } from './prompts/meal-plan.prompts';
import { buildProductNormalizationPrompt } from './prompts/product-normalization.prompts';

export type {
  GenerateRecipeParams,
  RecipeResponse,
  MealPlanParams,
  MealPlanResponse,
  ProductNormalizationParams,
  NormalizedProduct,
} from './ai.types';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private openai: OpenAI;

  constructor(private configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  /* ================== RECIPE ================== */

  async generateRecipe(params: GenerateRecipeParams): Promise<RecipeResponse> {
    const prompt = buildRecipePrompt(params);

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 3000,
      temperature: 0.7,
    });

    const text = response.choices[0].message.content || '{}';
    return this.parseRecipeResponse(text);
  }

  async generateRecipeFromInventory(
    availableProducts: string[],
    portions: number = 2,
  ): Promise<RecipeResponse> {
    return this.generateRecipe({
      productNames: availableProducts,
      portions,
    });
  }

  async suggestRecipeForExpiringProducts(
    expiringProducts: string[],
  ): Promise<RecipeResponse> {
    const prompt = buildExpiringProductsRecipePrompt(expiringProducts);

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 3000,
      temperature: 0.7,
    });

    const text = response.choices[0].message.content || '{}';
    return this.parseRecipeResponse(text);
  }

  /* ================== MEAL PLAN ================== */

  async generateMealPlan(params: MealPlanParams): Promise<MealPlanResponse> {
    const prompt = buildMealPlanPrompt(params);

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 8000,
      temperature: 0.8,
    });

    const text = response.choices[0].message.content || '{}';
    console.log('🤖 AI Raw Response length:', text.length);

    const parsed = this.parseMealPlanResponse(text);
    console.log('📋 Parsed Meal Plan days:', parsed.days.length);

    return parsed;
  }

  /* ================== PARSERS ================== */

  private parseRecipeResponse(text: string): RecipeResponse {
    const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    // Видаляємо символи дробів та замінюємо на десяткові
    const sanitizedText = this.sanitizeJsonText(cleanText);

    const json = sanitizedText.match(/\{[\s\S]*\}/);
    if (!json) throw new Error('Recipe JSON parse error');

    try {
      return JSON.parse(json[0]) as RecipeResponse;
    } catch (error) {
      console.error('Failed to parse recipe JSON:', json[0].substring(0, 500));
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Recipe parsing failed: ${message}`);
    }
  }

  private parseMealPlanResponse(text: string): MealPlanResponse {
    // Видаляємо markdown форматування
    const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    // Видаляємо символи дробів та замінюємо на десяткові
    const sanitizedText = this.sanitizeJsonText(cleanText);

    // Шукаємо JSON об'єкт
    const json = sanitizedText.match(/\{[\s\S]*\}/);
    if (!json) {
      console.error('❌ Failed to find JSON in response');
      throw new Error('Meal plan JSON parse error: No JSON found');
    }

    let jsonText = json[0];

    // Перевіряємо чи JSON завершений
    const openBraces = (jsonText.match(/\{/g) || []).length;
    const closeBraces = (jsonText.match(/\}/g) || []).length;
    const openBrackets = (jsonText.match(/\[/g) || []).length;
    const closeBrackets = (jsonText.match(/\]/g) || []).length;

    // Якщо JSON не завершений, пробуємо його "закрити"
    if (openBraces !== closeBraces || openBrackets !== closeBrackets) {
      console.warn('⚠️ JSON appears incomplete, attempting to fix...');

      // Шукаємо останню валідну структуру "days"
      const daysMatch = jsonText.match(/"days"\s*:\s*\[([\s\S]*)/);
      if (daysMatch) {
        // Знаходимо останній повністю завершений day
        const daysContent = daysMatch[1];
        const lastCompleteDayIndex = daysContent.lastIndexOf('},\n    {');

        if (lastCompleteDayIndex > -1) {
          // Обрізаємо до останнього повного дня
          const fixedDaysContent = daysContent.substring(0, lastCompleteDayIndex + 1);
          jsonText = `{"days":[${fixedDaysContent}],"estimatedCost":0}`;
        }
      }
    }

    try {
      const parsed = JSON.parse(jsonText) as MealPlanResponse;

      // Валідація структури
      if (!parsed.days || !Array.isArray(parsed.days)) {
        throw new Error('Invalid meal plan structure: missing days array');
      }

      // Видаляємо неповні дні
      parsed.days = parsed.days.filter((day) => {
        if (!day.meals || !Array.isArray(day.meals) || day.meals.length === 0) {
          console.warn(`⚠️ Skipping invalid day: ${day.date}`);
          return false;
        }
        return true;
      });

      if (parsed.days.length === 0) {
        throw new Error('No valid days in meal plan');
      }

      console.log(`✅ Successfully parsed ${parsed.days.length} days`);
      return parsed;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ JSON Parse Error:', message);
      console.error('📄 Attempted to parse first 500 chars:', jsonText.substring(0, 500));
      throw new Error(`Meal plan parsing failed: ${message}`);
    }
  }

  /**
   * Очищає текст від символів дробів та інших проблемних символів
   */
  private sanitizeJsonText(text: string): string {
    let sanitized = text;

    // Замінюємо символи дробів на десяткові числа
    const fractionMap: { [key: string]: string } = {
      '½': '0.5',
      '¼': '0.25',
      '¾': '0.75',
      '⅓': '0.33',
      '⅔': '0.67',
      '⅛': '0.125',
      '⅜': '0.375',
      '⅝': '0.625',
      '⅞': '0.875',
      '⅕': '0.2',
      '⅖': '0.4',
      '⅗': '0.6',
      '⅘': '0.8',
      '⅙': '0.17',
      '⅚': '0.83',
    };

    // Замінюємо всі символи дробів
    for (const [fraction, decimal] of Object.entries(fractionMap)) {
      // Замінюємо окремі символи дробів
      sanitized = sanitized.replace(new RegExp(fraction, 'g'), decimal);

      // Замінюємо "number + fraction" на десяткове (наприклад "2½" -> "2.5")
      sanitized = sanitized.replace(
        new RegExp(`(\\d+)${fraction}`, 'g'),
        (match, num) => String(parseFloat(num) + parseFloat(decimal))
      );
    }

    // Видаляємо інші проблемні спецсимволи у значеннях amount
    sanitized = sanitized.replace(
      /"amount":\s*"([^"]+)"/g,
      (match, value) => {
        // Спробувати конвертувати текстові значення в числа
        const numMatch = value.match(/[\d.]+/);
        return numMatch ? `"amount": ${numMatch[0]}` : match;
      }
    );

    return sanitized;
  }

  /* ================== PRODUCT NORMALIZATION ================== */

  /**
   * Нормалізує список продуктів, видаляючи бренди та зайву інформацію
   * Обробляє продукти партіями для оптимізації
   */
  async normalizeProducts(
    products: ProductNormalizationParams[],
  ): Promise<NormalizedProduct[]> {
    if (products.length === 0) {
      return [];
    }

    // Обробляємо партіями по 50 продуктів для оптимізації
    const batchSize = 50;
    const batches: ProductNormalizationParams[][] = [];
    
    for (let i = 0; i < products.length; i += batchSize) {
      batches.push(products.slice(i, i + batchSize));
    }

    const normalizedProducts: NormalizedProduct[] = [];

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      this.logger.log(
        `🤖 Обробка партії ${i + 1}/${batches.length} (${batch.length} продуктів)...`,
      );

      try {
        const normalized = await this.normalizeProductsBatch(batch);
        normalizedProducts.push(...normalized);

        // Невелика затримка між партіями, щоб не перевищувати rate limits
        if (i < batches.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch (error: any) {
        this.logger.error(
          `❌ Помилка при обробці партії ${i + 1}: ${error.message}`,
        );
        // Продовжуємо з наступною партією
        continue;
      }
    }

    return normalizedProducts;
  }

  private async normalizeProductsBatch(
    products: ProductNormalizationParams[],
  ): Promise<NormalizedProduct[]> {
    const prompt = buildProductNormalizationPrompt(products);

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4000,
      temperature: 0.3, // Низька температура для більш консистентних результатів
    });

    const text = response.choices[0].message.content || '[]';
    const parsed = this.parseNormalizedProducts(text);
    return this.dedupeNormalizedProducts(parsed);
  }

  private parseNormalizedProducts(text: string): NormalizedProduct[] {
    // Очищаємо від markdown форматування
    const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    // Шукаємо JSON масив
    const jsonMatch = cleanText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('Не вдалося знайти JSON масив у відповіді AI');
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed)) {
        throw new Error('Відповідь AI не є масивом');
      }

      // Валідуємо структуру
      return parsed.map((item: any, index: number) => {
        if (!item.name || typeof item.name !== 'string') {
          throw new Error(
            `Невалідна структура продукту на позиції ${index}: відсутнє поле name`,
          );
        }

        if (!item.baseUnit || !['G', 'ML', 'PCS'].includes(item.baseUnit)) {
          throw new Error(
            `Невалідна одиниця вимірювання на позиції ${index}: ${item.baseUnit}`,
          );
        }

        return {
          name: this.canonicalizeProductName(String(item.name).trim()),
          category: item.category || 'Інше',
          baseUnit: item.baseUnit as 'G' | 'ML' | 'PCS',
          price:
            typeof item.price === 'number'
              ? item.price
              : Number.isFinite(Number(item.price))
                ? Number(item.price)
                : 0,
          caloriesPer100:
            typeof item.caloriesPer100 === 'number'
              ? item.caloriesPer100
              : Number.isFinite(Number(item.caloriesPer100))
                ? Number(item.caloriesPer100)
                : 0,
        };
      });
    } catch (error: any) {
      this.logger.error(`❌ Помилка парсингу нормалізованих продуктів: ${error.message}`);
      this.logger.error(`📄 Відповідь AI (перші 500 символів): ${cleanText.substring(0, 500)}`);
      throw new Error(`Помилка парсингу нормалізованих продуктів: ${error.message}`);
    }
  }

  private canonicalizeProductName(name: string): string {
    const cleaned = name
      .replace(/\s+/g, ' ')
      .replace(/\s*\([^)]*\)\s*/g, ' ')
      .replace(/\s*,\s*/g, ' ')
      .trim();

    const lower = cleaned.toLowerCase();

    const varietyWords = new Set([
      'голден',
      'гала',
      'фуджі',
      'ренет',
      'айдаред',
      'джонаголд',
      'мускат',
      'кишмиш',
    ]);

    const tokens = lower.split(' ').filter(Boolean);
    if (tokens.length >= 2 && varietyWords.has(tokens[tokens.length - 1])) {
      return cleaned
        .split(' ')
        .slice(0, -1)
        .join(' ')
        .trim();
    }

    const singularMap: Record<string, string> = {
      яблука: 'Яблуко',
      банани: 'Банан',
      апельсини: 'Апельсин',
      лимони: 'Лимон',
      помідори: 'Помідор',
      огірки: 'Огірок',
      яйця: 'Яйце',
    };

    if (singularMap[lower]) {
      return singularMap[lower];
    }

    return cleaned;
  }

  private dedupeNormalizedProducts(products: NormalizedProduct[]): NormalizedProduct[] {
    const byKey = new Map<string, NormalizedProduct>();

    for (const p of products) {
      const key = p.name.trim().toLowerCase();
      const existing = byKey.get(key);

      if (!existing) {
        byKey.set(key, p);
        continue;
      }

      const merged: NormalizedProduct = {
        ...existing,
        category: existing.category || p.category,
        baseUnit: existing.baseUnit || p.baseUnit,
        price: (existing.price && existing.price > 0 ? existing.price : p.price) || 0,
        caloriesPer100:
          (existing.caloriesPer100 && existing.caloriesPer100 > 0
            ? existing.caloriesPer100
            : p.caloriesPer100) || 0,
      };

      byKey.set(key, merged);
    }

    return Array.from(byKey.values());
  }
}