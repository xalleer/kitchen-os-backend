// src/products/data/basic-products.catalog.ts

interface BasicProduct {
  name: string;
  category: string;
  baseUnit: 'G' | 'ML' | 'PCS';
  averagePrice: number;
  caloriesPer100: number;
  standardAmount?: number;
  image?: string;
}

export const BASIC_PRODUCTS_CATALOG: BasicProduct[] = [
  // ==================== МОЛОЧНІ ПРОДУКТИ ====================
  { 
    name: 'Молоко', 
    category: 'Молочні', 
    baseUnit: 'ML', 
    averagePrice: 35, 
    caloriesPer100: 60, 
    standardAmount: 1000 
  },
  { 
    name: 'Кефір', 
    category: 'Молочні', 
    baseUnit: 'ML', 
    averagePrice: 30, 
    caloriesPer100: 56, 
    standardAmount: 1000 
  },
  { 
    name: 'Сметана', 
    category: 'Молочні', 
    baseUnit: 'G', 
    averagePrice: 45, 
    caloriesPer100: 206, 
    standardAmount: 400 
  },
  { 
    name: 'Йогурт', 
    category: 'Молочні', 
    baseUnit: 'G', 
    averagePrice: 25, 
    caloriesPer100: 59, 
    standardAmount: 250 
  },
  { 
    name: 'Сир твердий', 
    category: 'Молочні', 
    baseUnit: 'G', 
    averagePrice: 180, 
    caloriesPer100: 356, 
    standardAmount: 200 
  },
  { 
    name: 'Сир кисломолочний', 
    category: 'Молочні', 
    baseUnit: 'G', 
    averagePrice: 50, 
    caloriesPer100: 169, 
    standardAmount: 300 
  },
  { 
    name: 'Масло вершкове', 
    category: 'Молочні', 
    baseUnit: 'G', 
    averagePrice: 150, 
    caloriesPer100: 717, 
    standardAmount: 200 
  },

  // ==================== М'ясО ТА ПТИЦЯ ====================
  { 
    name: 'Курка філе', 
    category: "М'ясо", 
    baseUnit: 'G', 
    averagePrice: 120, 
    caloriesPer100: 110, 
    standardAmount: 500 
  },
  { 
    name: 'Курка ціла', 
    category: "М'ясо", 
    baseUnit: 'G', 
    averagePrice: 80, 
    caloriesPer100: 190, 
    standardAmount: 1500 
  },
  { 
    name: 'Курка стегно', 
    category: "М'ясо", 
    baseUnit: 'G', 
    averagePrice: 90, 
    caloriesPer100: 211, 
    standardAmount: 500 
  },
  { 
    name: 'Свинина', 
    category: "М'ясо", 
    baseUnit: 'G', 
    averagePrice: 140, 
    caloriesPer100: 242, 
    standardAmount: 500 
  },
  { 
    name: 'Яловичина', 
    category: "М'ясо", 
    baseUnit: 'G', 
    averagePrice: 160, 
    caloriesPer100: 250, 
    standardAmount: 500 
  },
  { 
    name: 'Фарш', 
    category: "М'ясо", 
    baseUnit: 'G', 
    averagePrice: 110, 
    caloriesPer100: 254, 
    standardAmount: 500 
  },
  { 
    name: 'Ковбаса варена', 
    category: "М'ясо", 
    baseUnit: 'G', 
    averagePrice: 130, 
    caloriesPer100: 257, 
    standardAmount: 300 
  },
  { 
    name: 'Сосиски', 
    category: "М'ясо", 
    baseUnit: 'G', 
    averagePrice: 100, 
    caloriesPer100: 266, 
    standardAmount: 400 
  },

  // ==================== РИБА ====================
  { 
    name: 'Філе риби', 
    category: 'Риба', 
    baseUnit: 'G', 
    averagePrice: 130, 
    caloriesPer100: 96, 
    standardAmount: 400 
  },
  { 
    name: 'Сьомга', 
    category: 'Риба', 
    baseUnit: 'G', 
    averagePrice: 280, 
    caloriesPer100: 208, 
    standardAmount: 300 
  },
  { 
    name: 'Оселедець', 
    category: 'Риба', 
    baseUnit: 'G', 
    averagePrice: 60, 
    caloriesPer100: 158, 
    standardAmount: 300 
  },
  { 
    name: 'Минтай', 
    category: 'Риба', 
    baseUnit: 'G', 
    averagePrice: 90, 
    caloriesPer100: 79, 
    standardAmount: 500 
  },

  // ==================== ЯЙЦЯ ====================
  { 
    name: 'Яйце', 
    category: 'Яйця', 
    baseUnit: 'PCS', 
    averagePrice: 4, 
    caloriesPer100: 155, 
    standardAmount: 10 
  },

  // ==================== ОВОЧІ ====================
  { 
    name: 'Картопля', 
    category: 'Овочі', 
    baseUnit: 'G', 
    averagePrice: 15, 
    caloriesPer100: 77, 
    standardAmount: 1000 
  },
  { 
    name: 'Морква', 
    category: 'Овочі', 
    baseUnit: 'G', 
    averagePrice: 12, 
    caloriesPer100: 41, 
    standardAmount: 500 
  },
  { 
    name: 'Цибуля', 
    category: 'Овочі', 
    baseUnit: 'G', 
    averagePrice: 18, 
    caloriesPer100: 40, 
    standardAmount: 500 
  },
  { 
    name: 'Часник', 
    category: 'Овочі', 
    baseUnit: 'G', 
    averagePrice: 80, 
    caloriesPer100: 149, 
    standardAmount: 100 
  },
  { 
    name: 'Помідор', 
    category: 'Овочі', 
    baseUnit: 'G', 
    averagePrice: 45, 
    caloriesPer100: 18, 
    standardAmount: 500 
  },
  { 
    name: 'Огірок', 
    category: 'Овочі', 
    baseUnit: 'G', 
    averagePrice: 40, 
    caloriesPer100: 15, 
    standardAmount: 500 
  },
  { 
    name: 'Перець болгарський', 
    category: 'Овочі', 
    baseUnit: 'G', 
    averagePrice: 55, 
    caloriesPer100: 27, 
    standardAmount: 500 
  },
  { 
    name: 'Капуста', 
    category: 'Овочі', 
    baseUnit: 'G', 
    averagePrice: 12, 
    caloriesPer100: 25, 
    standardAmount: 1000 
  },
  { 
    name: 'Буряк', 
    category: 'Овочі', 
    baseUnit: 'G', 
    averagePrice: 15, 
    caloriesPer100: 43, 
    standardAmount: 500 
  },
  { 
    name: 'Кабачок', 
    category: 'Овочі', 
    baseUnit: 'G', 
    averagePrice: 25, 
    caloriesPer100: 17, 
    standardAmount: 500 
  },
  { 
    name: 'Баклажан', 
    category: 'Овочі', 
    baseUnit: 'G', 
    averagePrice: 35, 
    caloriesPer100: 25, 
    standardAmount: 500 
  },

  // ==================== ФРУКТИ ====================
  { 
    name: 'Яблуко', 
    category: 'Фрукти', 
    baseUnit: 'G', 
    averagePrice: 25, 
    caloriesPer100: 52, 
    standardAmount: 500 
  },
  { 
    name: 'Банан', 
    category: 'Фрукти', 
    baseUnit: 'G', 
    averagePrice: 35, 
    caloriesPer100: 89, 
    standardAmount: 500 
  },
  { 
    name: 'Апельсин', 
    category: 'Фрукти', 
    baseUnit: 'G', 
    averagePrice: 40, 
    caloriesPer100: 47, 
    standardAmount: 500 
  },
  { 
    name: 'Лимон', 
    category: 'Фрукти', 
    baseUnit: 'PCS', 
    averagePrice: 15, 
    caloriesPer100: 29, 
    standardAmount: 5 
  },
  { 
    name: 'Груша', 
    category: 'Фрукти', 
    baseUnit: 'G', 
    averagePrice: 30, 
    caloriesPer100: 57, 
    standardAmount: 500 
  },
  { 
    name: 'Виноград', 
    category: 'Фрукти', 
    baseUnit: 'G', 
    averagePrice: 60, 
    caloriesPer100: 69, 
    standardAmount: 500 
  },

  // ==================== КРУПИ ТА МАКАРОНИ ====================
  { 
    name: 'Рис', 
    category: 'Крупи', 
    baseUnit: 'G', 
    averagePrice: 35, 
    caloriesPer100: 365, 
    standardAmount: 1000 
  },
  { 
    name: 'Гречка', 
    category: 'Крупи', 
    baseUnit: 'G', 
    averagePrice: 40, 
    caloriesPer100: 343, 
    standardAmount: 1000 
  },
  { 
    name: 'Вівсянка', 
    category: 'Крупи', 
    baseUnit: 'G', 
    averagePrice: 30, 
    caloriesPer100: 342, 
    standardAmount: 500 
  },
  { 
    name: 'Макарони', 
    category: 'Крупи', 
    baseUnit: 'G', 
    averagePrice: 25, 
    caloriesPer100: 371, 
    standardAmount: 500 
  },
  { 
    name: 'Манка', 
    category: 'Крупи', 
    baseUnit: 'G', 
    averagePrice: 20, 
    caloriesPer100: 333, 
    standardAmount: 500 
  },
  { 
    name: 'Перлова крупа', 
    category: 'Крупи', 
    baseUnit: 'G', 
    averagePrice: 18, 
    caloriesPer100: 352, 
    standardAmount: 500 
  },

  // ==================== ХЛІБОБУЛОЧНІ ====================
  { 
    name: 'Хліб білий', 
    category: 'Хлібобулочні', 
    baseUnit: 'PCS', 
    averagePrice: 25, 
    caloriesPer100: 265, 
    standardAmount: 1 
  },
  { 
    name: 'Хліб чорний', 
    category: 'Хлібобулочні', 
    baseUnit: 'PCS', 
    averagePrice: 22, 
    caloriesPer100: 259, 
    standardAmount: 1 
  },
  { 
    name: 'Батон', 
    category: 'Хлібобулочні', 
    baseUnit: 'PCS', 
    averagePrice: 20, 
    caloriesPer100: 260, 
    standardAmount: 1 
  },
  { 
    name: 'Булка', 
    category: 'Хлібобулочні', 
    baseUnit: 'PCS', 
    averagePrice: 15, 
    caloriesPer100: 339, 
    standardAmount: 1 
  },

  // ==================== БОРОШНО ТА ВИПІЧКА ====================
  { 
    name: 'Борошно', 
    category: 'Випічка', 
    baseUnit: 'G', 
    averagePrice: 18, 
    caloriesPer100: 364, 
    standardAmount: 1000 
  },
  { 
    name: 'Цукор', 
    category: 'Випічка', 
    baseUnit: 'G', 
    averagePrice: 22, 
    caloriesPer100: 387, 
    standardAmount: 1000 
  },
  { 
    name: 'Сіль', 
    category: 'Випічка', 
    baseUnit: 'G', 
    averagePrice: 8, 
    caloriesPer100: 0, 
    standardAmount: 1000 
  },
  { 
    name: 'Дріжджі', 
    category: 'Випічка', 
    baseUnit: 'G', 
    averagePrice: 12, 
    caloriesPer100: 325, 
    standardAmount: 100 
  },

  // ==================== ОЛІЇ ТА СОУСИ ====================
  { 
    name: 'Олія соняшникова', 
    category: 'Олії', 
    baseUnit: 'ML', 
    averagePrice: 55, 
    caloriesPer100: 884, 
    standardAmount: 1000 
  },
  { 
    name: 'Олія оливкова', 
    category: 'Олії', 
    baseUnit: 'ML', 
    averagePrice: 120, 
    caloriesPer100: 884, 
    standardAmount: 500 
  },
  { 
    name: 'Майонез', 
    category: 'Соуси', 
    baseUnit: 'G', 
    averagePrice: 35, 
    caloriesPer100: 680, 
    standardAmount: 400 
  },
  { 
    name: 'Кетчуп', 
    category: 'Соуси', 
    baseUnit: 'ML', 
    averagePrice: 30, 
    caloriesPer100: 112, 
    standardAmount: 500 
  },
  { 
    name: 'Гірчиця', 
    category: 'Соуси', 
    baseUnit: 'G', 
    averagePrice: 25, 
    caloriesPer100: 162, 
    standardAmount: 200 
  },
  { 
    name: 'Соєвий соус', 
    category: 'Соуси', 
    baseUnit: 'ML', 
    averagePrice: 40, 
    caloriesPer100: 53, 
    standardAmount: 250 
  },

  // ==================== КОНСЕРВАЦІЯ ====================
  { 
    name: 'Томатна паста', 
    category: 'Консервація', 
    baseUnit: 'G', 
    averagePrice: 28, 
    caloriesPer100: 67, 
    standardAmount: 250 
  },
  { 
    name: 'Горошок консервований', 
    category: 'Консервація', 
    baseUnit: 'G', 
    averagePrice: 30, 
    caloriesPer100: 69, 
    standardAmount: 400 
  },
  { 
    name: 'Кукурудза консервована', 
    category: 'Консервація', 
    baseUnit: 'G', 
    averagePrice: 35, 
    caloriesPer100: 119, 
    standardAmount: 400 
  },
  { 
    name: 'Огірки консервовані', 
    category: 'Консервація', 
    baseUnit: 'G', 
    averagePrice: 40, 
    caloriesPer100: 11, 
    standardAmount: 500 
  },

  // ==================== НАПОЇ ====================
  { 
    name: 'Вода', 
    category: 'Напої', 
    baseUnit: 'ML', 
    averagePrice: 12, 
    caloriesPer100: 0, 
    standardAmount: 1500 
  },
  { 
    name: 'Сік', 
    category: 'Напої', 
    baseUnit: 'ML', 
    averagePrice: 40, 
    caloriesPer100: 45, 
    standardAmount: 1000 
  },
  { 
    name: 'Чай', 
    category: 'Напої', 
    baseUnit: 'G', 
    averagePrice: 60, 
    caloriesPer100: 0, 
    standardAmount: 100 
  },
  { 
    name: 'Кава', 
    category: 'Напої', 
    baseUnit: 'G', 
    averagePrice: 150, 
    caloriesPer100: 0, 
    standardAmount: 200 
  },

  // ==================== СПЕЦІЇ ТА ЗЕЛЕНЬ ====================
  { 
    name: 'Перець чорний', 
    category: 'Спеції', 
    baseUnit: 'G', 
    averagePrice: 15, 
    caloriesPer100: 251, 
    standardAmount: 50 
  },
  { 
    name: 'Лавровий лист', 
    category: 'Спеції', 
    baseUnit: 'G', 
    averagePrice: 10, 
    caloriesPer100: 313, 
    standardAmount: 10 
  },
  { 
    name: 'Кріп', 
    category: 'Зелень', 
    baseUnit: 'G', 
    averagePrice: 20, 
    caloriesPer100: 43, 
    standardAmount: 100 
  },
  { 
    name: 'Петрушка', 
    category: 'Зелень', 
    baseUnit: 'G', 
    averagePrice: 20, 
    caloriesPer100: 36, 
    standardAmount: 100 
  },
  { 
    name: 'Базилік', 
    category: 'Зелень', 
    baseUnit: 'G', 
    averagePrice: 25, 
    caloriesPer100: 23, 
    standardAmount: 50 
  },
];