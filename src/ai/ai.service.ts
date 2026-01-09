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

    const response = await this.openai.responses.create({
      model: 'gpt-4o-mini',
      input: prompt,
      max_output_tokens: 2000,
    });

    const text = response.output_text;
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

Відповідь надай ТІЛЬКИ у форматі JSON:
{
  "name": "назва страви українською",
  "description": "короткий опис",
  "instructions": ["крок 1", "крок 2"],
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

    const response = await this.openai.responses.create({
      model: 'gpt-4o-mini',
      input: prompt,
      max_output_tokens: 2000,
    });

    return this.parseRecipeResponse(response.output_text);
  }

  /* ================== MEAL PLAN ================== */

  async generateMealPlan(params: MealPlanParams): Promise<MealPlanResponse> {
    const prompt = this.buildMealPlanPrompt(params);

    const response = await this.openai.responses.create({
      model: 'gpt-4.1',
      input: prompt,
      max_output_tokens: 4000,
    });

    return this.parseMealPlanResponse(response.output_text);
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

Відповідь ТІЛЬКИ у форматі JSON:
{
  "name": "назва",
  "description": "опис",
  "instructions": ["крок 1", "крок 2"],
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
          `- ${m.name}: алергії [${m.allergies.join(', ')}], мета: ${m.goal}, їсть: ${
            [
              m.eatsBreakfast && 'сніданок',
              m.eatsLunch && 'обід',
              m.eatsDinner && 'вечеря',
              m.eatsSnack && 'перекус',
            ]
              .filter(Boolean)
              .join(', ')
          }`,
      )
      .join('\n');

    return `
Створи план харчування на ${daysCount} днів.

Сімʼя:
${members}

Бюджет: ${budgetLimit} грн

Вимоги:
- враховуй алергії
- доступні продукти в Україні
- не перевищуй бюджет
- підлаштовуй під цілі кожного

Формат відповіді ТІЛЬКИ JSON:
{
  "days": [...],
  "estimatedCost": число
}`;
  }

  /* ================== PARSERS ================== */

  private parseRecipeResponse(text: string): RecipeResponse {
    const json = text.match(/\{[\s\S]*\}/);
    if (!json) throw new Error('Recipe JSON parse error');
    return JSON.parse(json[0]);
  }

  private parseMealPlanResponse(text: string): MealPlanResponse {
    const json = text.match(/\{[\s\S]*\}/);
    if (!json) throw new Error('Meal plan JSON parse error');
    return JSON.parse(json[0]);
  }
}
