export type Confidence = "high" | "medium" | "low";

export interface FoodItem {
  name: string;
  quantity_g: number;
  calories: number;
  proteins_g: number;
  carbs_g: number;
  fats_g: number;
  confidence: Confidence;
  assumption: string;
}

export interface EstimateResult {
  items: FoodItem[];
}