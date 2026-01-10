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
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 3000, // Збільшили для детальних інструкцій
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

**ВАЖЛИВО ПРО ІНСТРУКЦІЇ:**
- instructions: 6-8 детальних кроків
- кожен крок конкретний з температурою, часом, розмірами
- приклад: "Розігрійте духовку до 180°C. Наріжте картоплю кубиками 2см."

Приклад інструкцій:
[
  "Розігрійте духовку до 180°C.",
  "Почистіть картоплю, наріжте кубиками 2см.",
  "Розігріту сковороду обсмажте цибулю 3-4 хвилини.",
  "Додайте м'ясо, смажте 7-10 хвилин до рум'яної скорінки.",
  "Викладіть інгредієнти в форму для запікання.",
  "Запікайте 25-30 хвилин.",
  "Дайте постояти 5 хвилин перед подачею."
]

Відповідь надай ТІЛЬКИ у форматі JSON:
{
  "name": "назва страви українською",
  "description": "короткий опис (1-2 речення)",
  "instructions": ["детальний крок 1", "детальний крок 2", "..."],
  "cookingTime": хвилини,
  "servings": порції,
  "calories": калорій,
  "ingredients": [
    {
      "productName": "продукт",
      "amount": число,
      "unit": "г/мл/шт"
    }
  ],
  "category": "категорія"
}
`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 3000, // Збільшили для детальних інструкцій
      temperature: 0.7,
    });

    const text = response.choices[0].message.content || '{}';
    return this.parseRecipeResponse(text);
  }

  /* ================== MEAL PLAN ================== */

  async generateMealPlan(params: MealPlanParams): Promise<MealPlanResponse> {
    const prompt = this.buildMealPlanPrompt(params);

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 8000, // Збільшили ліміт
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

**ВАЖЛИВО ПРО ІНСТРУКЦІЇ:**
- instructions: 6-8 детальних кроків
- кожен крок конкретний з температурою, часом, розмірами
- приклад: "Розігрійте духовку до 180°C. Наріжте картоплю кубиками 2см."
- приклад: "Обсмажте цибулю на середньому вогні 5 хвилин до золотистого кольору."

Приклад інструкцій:
[
  "Почистіть картоплю, наріжте кубиками 2см. Моркву - кружальцями.",
  "Розігрійте 2 ст.л. олії на середньому вогні 1 хвилину.",
  "Додайте цибулю, обсмажте 3-4 хвилини до прозорості.",
  "Покладіть моркву, смажте 5 хвилин до м'якості.",
  "Додайте картоплю і 500 мл окропу, посоліть.",
  "Варіть під кришкою 20 хвилин на слабкому вогні.",
  "Подавайте гарячим з зеленню."
]

Відповідь ТІЛЬКИ у форматі JSON:
{
  "name": "назва страви",
  "description": "короткий опис (1-2 речення)",
  "instructions": ["детальний крок 1", "детальний крок 2", "..."],
  "cookingTime": хвилини,
  "servings": порції,
  "calories": калорій,
  "ingredients": [
    {
      "productName": "назва зі списку",
      "amount": число,
      "unit": "г/мл/шт"
    }
  ],
  "category": "сніданок/обід/вечеря/десерт"
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

Вимоги:
- враховуй алергії ВСІХ членів сім'ї
- доступні продукти в Україні  
- не перевищуй бюджет
- створи різноманітне меню
- для кожного дня створи страви які їдять ВСІ члени сім'ї (спільний стіл)
- якщо хтось не їсть певний прийом їжі, не додавай його для цього дня

**ВАЖЛИВО ПРО ІНСТРУКЦІЇ:**
- instructions має містити 5-7 детальних кроків
- кожен крок конкретний: вказуй температуру, час, розміри
- приклад: "Розігрійте сковороду на середньому вогні 2 хвилини, додайте 2 ст.л. олії"
- приклад: "Наріжте цибулю кубиками 1см, обсмажте 5 хвилин до золотистого кольору"
- description: 1 речення

Формат відповіді ТІЛЬКИ JSON (без markdown):
{
  "days": [
    {
      "date": "2026-01-10",
      "meals": [
        {
          "type": "BREAKFAST",
          "recipe": {
            "name": "Вівсянка з фруктами і горіхами",
            "description": "Поживний сніданок з вівсяних пластівців з додаванням свіжих фруктів та горіхів.",
            "instructions": [
              "Доведіть до кипіння 400 мл молока, всипте 100 г вівсянки.",
              "Варіть 5-7 хвилин на слабкому вогні, помішуючи.",
              "Додайте 1 ч.л. меду, щіпку солі.",
              "Наріжте банан та яблуко тонкими скибочками.",
              "Подрібніть 30 г горіхів.",
              "Викладіть кашу в тарілки, прикрасьте фруктами і горіхами."
            ],
            "cookingTime": 15,
            "servings": ${familyMembers.length},
            "calories": 350,
            "ingredients": [
              {"productName": "Вівсянка", "amount": 100, "unit": "г"},
              {"productName": "Молоко", "amount": 400, "unit": "мл"},
              {"productName": "Банан", "amount": 1, "unit": "шт"},
              {"productName": "Яблуко", "amount": 1, "unit": "шт"},
              {"productName": "Горіхи", "amount": 30, "unit": "г"},
              {"productName": "Мед", "amount": 20, "unit": "г"}
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
    const json = cleanText.match(/\{[\s\S]*\}/);
    if (!json) throw new Error('Recipe JSON parse error');
    return JSON.parse(json[0]);
  }

  private parseMealPlanResponse(text: string): MealPlanResponse {
    // Видаляємо markdown форматування
    const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    // Шукаємо JSON об'єкт
    let json = cleanText.match(/\{[\s\S]*\}/);
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
}