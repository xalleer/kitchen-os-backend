import { MealPlanParams } from '../ai.types';

export function buildMealPlanPrompt(params: MealPlanParams): string {
  const { familyMembers, budgetLimit, daysCount = 7, allowedProducts = [] } = params;

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

  const productsCatalog = allowedProducts
    .slice(0, 400)
    .map(
      (p) =>
        `- ${p.id} | ${p.name} | unit=${p.baseUnit} | price=${p.averagePrice ?? 0} | standardAmount=${p.standardAmount ?? 0}`,
    )
    .join('\n');

  return `
Створи план харчування на ${daysCount} днів для сім'ї.

Дати: ${dates.join(', ')}

Члени сім'ї:
${members}

Бюджет на весь період: ${budgetLimit} грн

ДОЗВОЛЕНІ ПРОДУКТИ (використовуй ТІЛЬКИ їх):
${productsCatalog || '- (список порожній)'}

**КРИТИЧНО ВАЖЛИВО ПРО ПРОДУКТИ:**
- Заборонено вигадувати нові продукти або використовувати продукти поза списком ДОЗВОЛЕНІ ПРОДУКТИ
- Кожен інгредієнт має посилатися на продукт зі списку. Використовуй "productId" (з каталогу) як основний ідентифікатор
- Поле "productName" залишай як назву з каталогу (має відповідати productId)
- Одиниця виміру інгредієнту має відповідати baseUnit продукту (G/ML/PCS)

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
              {"productId": "<id-from-catalog>", "productName": "Вівсянка", "amount": 100, "unit": "г"},
              {"productId": "<id-from-catalog>", "productName": "Молоко", "amount": 400, "unit": "мл"}
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
