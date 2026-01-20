import { GenerateRecipeParams } from '../ai.types';

export function buildRecipePrompt(params: GenerateRecipeParams): string {
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

export function buildExpiringProductsRecipePrompt(expiringProducts: string[]): string {
  return `
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
}
