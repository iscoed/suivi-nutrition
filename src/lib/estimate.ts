import type { FoodItem } from "./types";

export interface EstimateOutput {
  items: FoodItem[];
  questions: string[];
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);

export async function estimateMeal(description: string): Promise<EstimateOutput> {
  const res = await fetch("/api/estimate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description }),
  });
  if (!res.ok) throw new Error("Estimation impossible, réessayez.");

  const data = await res.json();
  const list: any[] = Array.isArray(data?.items) ? data.items : [];
  const questions: string[] = Array.isArray(data?.clarifying_questions)
    ? data.clarifying_questions.filter((q: unknown) => typeof q === "string" && q.trim() !== "")
    : [];

  const items: FoodItem[] = list
    .filter((x) => typeof x?.name === "string" && x.name.trim() !== "")
    .map((x) => ({
      name: x.name,
      quantity_g: num(x.quantity_g),
      calories: num(x.calories),
      proteins_g: num(x.proteins_g),
      carbs_g: num(x.carbs_g),
      fats_g: num(x.fats_g),
      confidence: ["high", "medium", "low"].includes(x.confidence) ? x.confidence : "low",
      assumption: typeof x.assumption === "string" ? x.assumption : "",
    }));

  return { items, questions };
}