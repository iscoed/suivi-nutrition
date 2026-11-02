import type { EstimateResult, FoodItem } from "./types";

const isNum = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0;

function isFoodItem(x: any): x is FoodItem {
  return (
    typeof x?.name === "string" &&
    isNum(x.quantity_g) && isNum(x.calories) &&
    isNum(x.proteins_g) && isNum(x.carbs_g) && isNum(x.fats_g) &&
    ["high", "medium", "low"].includes(x.confidence) &&
    typeof x.assumption === "string"
  );
}

export async function estimateMeal(description: string): Promise<FoodItem[]> {
  const res = await fetch("/api/estimate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description }),
  });
  if (!res.ok) throw new Error("Estimation impossible, réessayez.");

  const data: EstimateResult = await res.json();
  return (data.items ?? []).filter(isFoodItem);
}