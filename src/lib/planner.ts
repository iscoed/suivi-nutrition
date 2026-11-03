import { macros } from "./foods";

export type Kind = "breakfast" | "snack" | "lunch" | "dinner";
export interface Food { name: string; grams: number }
export interface Option { title: string; foods: Food[]; kcal: number; p: number; c: number; f: number }
export interface Plan { slot: string; options: Option[] }

// Chaque moment a 4 idées : 3 sont proposées, et « Alternatives » fait tourner la liste
const TEMPLATES: Record<Kind, { title: string; foods: Food[] }[]> = {
  breakfast: [
    { title: "Flocons d'avoine, lait et banane", foods: [{ name: "flocons d'avoine", grams: 60 }, { name: "lait demi-écrémé", grams: 200 }, { name: "banane", grams: 100 }] },
    { title: "Omelette et pain complet", foods: [{ name: "œuf", grams: 150 }, { name: "pain complet", grams: 60 }, { name: "avocat", grams: 50 }] },
    { title: "Yaourt grec, myrtilles et amandes", foods: [{ name: "yaourt grec 0%", grams: 200 }, { name: "myrtilles", grams: 80 }, { name: "amandes", grams: 15 }] },
    { title: "Porridge pomme et amandes", foods: [{ name: "flocons d'avoine", grams: 50 }, { name: "lait demi-écrémé", grams: 200 }, { name: "pomme", grams: 100 }, { name: "amandes", grams: 10 }] },
  ],
  snack: [
    { title: "Yaourt grec et myrtilles", foods: [{ name: "yaourt grec 0%", grams: 200 }, { name: "myrtilles", grams: 50 }] },
    { title: "Pomme et amandes", foods: [{ name: "pomme", grams: 150 }, { name: "amandes", grams: 20 }] },
    { title: "Fromage blanc et banane", foods: [{ name: "fromage blanc 0%", grams: 200 }, { name: "banane", grams: 100 }] },
    { title: "Pomme et fromage blanc", foods: [{ name: "pomme", grams: 150 }, { name: "fromage blanc 0%", grams: 150 }] },
  ],
  lunch: [
    { title: "Poulet, riz brun et brocoli", foods: [{ name: "poulet grillé", grams: 150 }, { name: "riz brun cuit", grams: 120 }, { name: "brocoli cuit", grams: 150 }, { name: "huile d'olive", grams: 5 }] },
    { title: "Saumon, quinoa et épinards", foods: [{ name: "saumon", grams: 150 }, { name: "quinoa cuit", grams: 120 }, { name: "épinards cuits", grams: 100 }, { name: "huile d'olive", grams: 5 }] },
    { title: "Thon, pâtes et salade", foods: [{ name: "thon égoutté", grams: 120 }, { name: "pâtes cuites", grams: 150 }, { name: "salade verte", grams: 150 }, { name: "huile d'olive", grams: 5 }] },
    { title: "Bœuf maigre, pâtes et légumes", foods: [{ name: "bœuf maigre", grams: 120 }, { name: "pâtes cuites", grams: 150 }, { name: "brocoli cuit", grams: 150 }, { name: "huile d'olive", grams: 5 }] },
  ],
  // Dîner : une seule source de protéines, et les plafonds de DINNER_LIMITS
  dinner: [
    { title: "Poisson blanc, riz et haricots verts", foods: [{ name: "poisson blanc", grams: 80 }, { name: "riz blanc cuit", grams: 50 }, { name: "haricots verts cuits", grams: 200 }] },
    { title: "Poulet, patate douce et brocoli", foods: [{ name: "poulet grillé", grams: 100 }, { name: "patate douce cuite", grams: 150 }, { name: "brocoli cuit", grams: 200 }] },
    { title: "Bœuf maigre, quinoa et salade", foods: [{ name: "bœuf maigre", grams: 80 }, { name: "quinoa cuit", grams: 50 }, { name: "salade verte", grams: 200 }] },
    { title: "Thon, patate douce et haricots verts", foods: [{ name: "thon égoutté", grams: 80 }, { name: "patate douce cuite", grams: 150 }, { name: "haricots verts cuits", grams: 200 }] },
  ],
};

const SLOT_WEIGHT: Record<string, number> = { breakfast: 0.25, snack1: 0.1, lunch: 0.3, snack2: 0.1, dinner: 0.25 };

function kindOf(key: string): Kind {
  return key.startsWith("snack") ? "snack" : (key as Kind);
}

function sum(foods: Food[]) {
  return foods.reduce(
    (a, f) => {
      const m = macros(f.name, f.grams);
      return { kcal: a.kcal + m.kcal, p: a.p + m.p, c: a.c + m.c, f: a.f + m.f };
    },
    { kcal: 0, p: 0, c: 0, f: 0 }
  );
}

export function buildPlans(
  slots: { key: string }[],
  remaining: { calories: number },
  offset: number
): Plan[] {
  const totalWeight = slots.reduce((s, x) => s + (SLOT_WEIGHT[x.key] ?? 0.2), 0) || 1;

  return slots.map((s) => {
    const kind = kindOf(s.key);
    const share = (SLOT_WEIGHT[s.key] ?? 0.2) / totalWeight;
    const targetKcal = Math.max(0, remaining.calories) * share;
    const list = TEMPLATES[kind];

    const options: Option[] = [0, 1, 2].map((i) => {
      const t = list[(offset + i) % list.length];
      const base = sum(t.foods);
      let factor = base.kcal > 0 ? targetKcal / base.kcal : 1;
      factor = Math.min(kind === "dinner" ? 1 : 1.2, Math.max(0.5, factor));

      const foods = t.foods.map((f) => ({ name: f.name, grams: Math.round((f.grams * factor) / 5) * 5 }));
      return { title: t.title, foods, ...sum(foods) };
    });

    return { slot: s.key, options };
  });
}