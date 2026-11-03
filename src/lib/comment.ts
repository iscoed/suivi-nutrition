import type { FoodItem } from "./types";

interface Totals {
  calories: number;
  proteins: number;
  carbs: number;
  fats: number;
}

const pick = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

export function mealComment(t: Totals, label: string): string {
  const parts: string[] = [];

  if (t.proteins >= 25) parts.push(pick(["Belle dose de protéines, vos muscles vous remercient.", "Super apport en protéines, c'est du solide !"]));
  else if (t.proteins >= 10) parts.push(pick(["Un peu de protéines, ça peut monter au prochain repas.", "Protéines correctes, pensez à en ajouter demain matin."]));
  else parts.push(pick(["Peu de protéines dans ce repas, à compléter.", "Très peu de protéines : une source maigre au prochain repas aiderait."]));

  if (t.fats >= 25) parts.push(pick(["Beaucoup de lipides : rien de grave, mais à surveiller au prochain repas.", "Repas bien gras, on équilibre le suivant avec du maigre."]));
  else if (t.fats <= 5) parts.push(pick(["Repas très maigre en lipides, pensez à une petite source de bonnes graisses.", "Peu de lipides : une cuillère d'huile ou quelques amandes arrangeraient ça."]));

  if (t.carbs >= 80) parts.push(pick(["Pas mal de glucides : parfait si vous êtes actif aujourd'hui.", "Beaucoup de glucides, l'énergie est là !"]));
  else if (t.carbs <= 10) parts.push(pick(["Peu de glucides, idéal si vous cherchez un repas léger.", "Quasiment pas de glucides : ajoutez une portion de fruit ou de céréales si besoin."]));

  if (t.calories >= 900) parts.push(pick(["Repas copieux, une collation légère suffira ensuite.", "Gros repas : on se calme sur la suite."]));

  if (parts.length === 1) parts.push(pick(["Repas équilibré, continuez comme ça !", "Bon équilibre, bravo !"]));

  return `${label} : ${parts.join(" ")}`;
}

export function sumItems(items: { calories: number; proteins_g: number; carbs_g: number; fats_g: number }[]): Totals {
  return items.reduce(
    (a, i) => ({
      calories: a.calories + i.calories,
      proteins: a.proteins + i.proteins_g,
      carbs: a.carbs + i.carbs_g,
      fats: a.fats + i.fats_g,
    }),
    { calories: 0, proteins: 0, carbs: 0, fats: 0 }
  );
}

export type { FoodItem };