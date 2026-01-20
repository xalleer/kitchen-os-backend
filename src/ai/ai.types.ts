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

export interface ProductNormalizationParams {
  originalTitle: string;
  category: string;
}

export interface NormalizedProduct {
  name: string;
  category: string;
  baseUnit: 'G' | 'ML' | 'PCS';
  price?: number;
  caloriesPer100?: number;
}
