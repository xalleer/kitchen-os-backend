import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

/* ================== INTERFACES ================== */

export interface GenerateRecipeParams {
  productNames: string[];
  portions?: number;
  dietaryRestrictions?: string[];
  goal?: string;
  cuisine?: string;
}

export interface RecipeResponse {
  name: string;
  description: string;
  instructions: string[];
  cookingTime: number;
  servings: number;
  calories: number;
  ingredients: Array<{
    productName: string;
    amount: number;
    unit: string;
  }>;
  category?: string;
}

export interface MealPlanParams {
  familyMembers: Array<{
    name: string;
    allergies: string[];
    goal: string;
    eatsBreakfast: boolean;
    eatsLunch: boolean;
    eatsDinner: boolean;
    eatsSnack: boolean;
  }>;
  budgetLimit: number;
  daysCount?: number;
}

export interface MealPlanResponse {
  days: Array<{
    date: string;
    meals: Array<{
      type: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';
      recipe: RecipeResponse;
    }>;
  }>;
  estimatedCost: number;
}

/* ================== SERVICE ================== */

@Injectable()
export class AiService {
  private openai: OpenAI;

  constructor(private configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  /* ================== RECIPE ================== */

  async generateRecipe(params: GenerateRecipeParams): Promise<RecipeResponse> {
    const prompt = this.buildRecipePrompt(params);

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
    const prompt = `
Створи рецепт страви, яка використовує ці продукти, що скоро зіпсуються:
${expiringProducts.join(', ')}

Обов'язково використай УСІ ці продукти.

**ВАЖЛИВО:**
- amount: ТІЛЬКИ цілі або десяткові числа (наприклад: 100, 2.5, 0.5)
- НІКОЛИ не використовуй дроби як ½, ¼, ⅓ - тільки десяткові числа
- instructions: 6-8 детальних кроків
- кожен крок конкретний з температурою, часом, розмірами

Приклад ПРАВИЛЬНИХ amounts:
- 100 (не "100")
- 2.5 (не "2½" або "2 1/2")
- 0.5 (не "½")

Відповідь надай ТІЛЬКИ у форматі JSON:
{
  "name": "назва страви українською",
  "description": "короткий опис (1-2 речення)",
  "instructions": ["детальний крок 1", "детальний крок 2", "..."],
  "cookingTime": 30,
  "servings": 2,
  "calories": 450,
  "ingredients": [
    {
      "productName": "продукт",
      "amount": 100,
      "unit": "г"
    }
  ],
  "category": "категорія"
}
`;

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
    const prompt = this.buildMealPlanPrompt(params);

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

  /* ================== PROMPTS ================== */

  private buildRecipePrompt(params: GenerateRecipeParams): string {
    const {
      productNames,
      portions = 2,
      dietaryRestrictions = [],
      goal,
      cuisine,
    } = params;

    let prompt = `Створи рецепт страви з таких продуктів:
${productNames.join(', ')}

Кількість порцій: ${portions}.`;

    if (dietaryRestrictions.length) {
      prompt += `\nОбмеження/алергії: ${dietaryRestrictions.join(', ')}`;
    }

    if (goal) {
      prompt += `\nМета харчування: ${goal}`;
    }

    if (cuisine) {
      prompt += `\nКухня: ${cuisine}`;
    }

    prompt += `

**КРИТИЧНО ВАЖЛИВО:**
- amount: ТІЛЬКИ цілі або десяткові числа (100, 2.5, 0.5)
- ЗАБОРОНЕНО використовувати символи дробів: ½ ¼ ⅓ ¾ ⅛ ⅔
- Використовуй десяткові: 0.5 замість ½, 0.25 замість ¼, 0.33 замість ⅓
- instructions: 6-8 детальних кроків

Приклад ПРАВИЛЬНИХ amounts:
✓ "amount": 100
✓ "amount": 2.5
✓ "amount": 0.5

Приклад НЕПРАВИЛЬНИХ amounts (ЗАБОРОНЕНО):
✗ "amount": ½
✗ "amount": 2½
✗ "amount": "100"

Відповідь ТІЛЬКИ у форматі JSON:
{
  "name": "назва страви",
  "description": "короткий опис (1-2 речення)",
  "instructions": ["детальний крок 1", "детальний крок 2", "..."],
  "cookingTime": 30,
  "servings": 2,
  "calories": 450,
  "ingredients": [
    {
      "productName": "назва зі списку",
      "amount": 100,
      "unit": "г"
    }
  ],
  "category": "сніданок"
}`;

    return prompt;
  }

  private buildMealPlanPrompt(params: MealPlanParams): string {
    const { familyMembers, budgetLimit, daysCount = 7 } = params;

    const members = familyMembers
      .map(
        (m) =>
          `- ${m.name}: алергії [${m.allergies.join(', ') || 'немає'}], мета: ${m.goal}, їсть: ${[
            m.eatsBreakfast && 'сніданок',
            m.eatsLunch && 'обід',
            m.eatsDinner && 'вечеря',
            m.eatsSnack && 'перекус',
          ]
            .filter(Boolean)
            .join(', ')}`,
      )
      .join('\n');

    const dates: string[] = [];
    const today = new Date();
    for (let i = 0; i < daysCount; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date.toISOString().split('T')[0]);
    }

    return `
Створи план харчування на ${daysCount} днів для сім'ї.

Дати: ${dates.join(', ')}

Члени сім'ї:
${members}

Бюджет на весь період: ${budgetLimit} грн

**КРИТИЧНО ВАЖЛИВО ПРО ФОРМАТ:**
- amount: ТІЛЬКИ цілі або десяткові числа (100, 2.5, 0.5)
- ЗАБОРОНЕНО символи дробів: ½ ¼ ⅓ ¾ ⅛ ⅔
- Використовуй десяткові: 0.5 замість ½, 0.25 замість ¼
- JSON має бути ВАЛІДНИМ без спецсимволів

Приклад ПРАВИЛЬНОГО amount:
✓ "amount": 100
✓ "amount": 2.5
✓ "amount": 0.5

Приклад НЕПРАВИЛЬНОГО (ЗАБОРОНЕНО):
✗ "amount": ½
✗ "amount": 2½
✗ "amount": "пів склянки"

Вимоги:
- враховуй алергії ВСІХ членів сім'ї
- доступні продукти в Україні  
- не перевищуй бюджет
- створи різноманітне меню
- для кожного дня створи страви які їдять ВСІ члени сім'ї
- instructions: 5-7 детальних кроків
- description: 1 речення

Формат відповіді ТІЛЬКИ JSON (без markdown):
{
  "days": [
    {
      "date": "2026-01-12",
      "meals": [
        {
          "type": "BREAKFAST",
          "recipe": {
            "name": "Вівсянка з фруктами",
            "description": "Поживний сніданок з вівсяних пластівців.",
            "instructions": [
              "Доведіть до кипіння 400 мл молока, всипте 100 г вівсянки.",
              "Варіть 5-7 хвилин на слабкому вогні.",
              "Додайте мед та фрукти."
            ],
            "cookingTime": 15,
            "servings": ${familyMembers.length},
            "calories": 350,
            "ingredients": [
              {"productName": "Вівсянка", "amount": 100, "unit": "г"},
              {"productName": "Молоко", "amount": 400, "unit": "мл"}
            ],
            "category": "сніданок"
          }
        }
      ]
    }
  ],
  "estimatedCost": 1500
}

ВІДПОВІДЬ ТІЛЬКИ JSON БЕЗ ДОДАТКОВОГО ТЕКСТУ!`;
  }

  /* ================== PARSERS ================== */

  private parseRecipeResponse(text: string): RecipeResponse {
    const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    // Видаляємо символи дробів та замінюємо на десяткові
    const sanitizedText = this.sanitizeJsonText(cleanText);

    const json = sanitizedText.match(/\{[\s\S]*\}/);
    if (!json) throw new Error('Recipe JSON parse error');

    try {
      return JSON.parse(json[0]);
    } catch (error) {
      console.error('Failed to parse recipe JSON:', json[0].substring(0, 500));
      throw new Error(`Recipe parsing failed: ${error.message}`);
    }
  }

  private parseMealPlanResponse(text: string): MealPlanResponse {
    // Видаляємо markdown форматування
    const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    // Видаляємо символи дробів та замінюємо на десяткові
    const sanitizedText = this.sanitizeJsonText(cleanText);

    // Шукаємо JSON об'єкт
    let json = sanitizedText.match(/\{[\s\S]*\}/);
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
      const parsed = JSON.parse(jsonText);

      // Валідація структури
      if (!parsed.days || !Array.isArray(parsed.days)) {
        throw new Error('Invalid meal plan structure: missing days array');
      }

      // Видаляємо неповні дні
      parsed.days = parsed.days.filter(day => {
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
      console.error('❌ JSON Parse Error:', error.message);
      console.error('📄 Attempted to parse first 500 chars:', jsonText.substring(0, 500));
      throw new Error(`Meal plan parsing failed: ${error.message}`);
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
}