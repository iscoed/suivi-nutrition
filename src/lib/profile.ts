export type Sex = "homme" | "femme";
export type Goal = "perdre" | "maintenir" | "prendre";
export type Activity = 1.2 | 1.375 | 1.55 | 1.725;

export interface Profile {
  sex: Sex;
  age: number;
  height_cm: number;
  weight_kg: number;
  goal: Goal;
  activity: Activity;
}

export interface Goals {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

const KEY = "suivi-nutrition-profil";

// Estimation : métabolisme de base (Mifflin-St Jeor) x activité, puis ajustement selon l'objectif
export function computeGoals(p: Profile): Goals {
  const bmr = 10 * p.weight_kg + 6.25 * p.height_cm - 5 * p.age + (p.sex === "homme" ? 5 : -161);
  const tdee = bmr * p.activity;
  const adjust = p.goal === "perdre" ? -500 : p.goal === "prendre" ? 300 : 0;
  const calories = Math.round(tdee + adjust);

  const protein_g = Math.round(p.weight_kg * 1.8);
  const fat_g = Math.round((calories * 0.3) / 9);
  const carbs_g = Math.round((calories - protein_g * 4 - fat_g * 9) / 4);

  return { calories, protein_g, carbs_g, fat_g };
}

export function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Profile) : null;
  } catch {
    return null;
  }
}

export function saveProfile(p: Profile) {
  localStorage.setItem(KEY, JSON.stringify(p));
}