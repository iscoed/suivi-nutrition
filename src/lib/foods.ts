export interface Nutri { kcal: number; p: number; c: number; f: number }

export const FOODS: Record<string, Nutri> = {
  "poulet grillé": { kcal: 165, p: 31, c: 0, f: 3.6 },
  "poisson blanc": { kcal: 82, p: 18, c: 0, f: 0.7 },
  "saumon": { kcal: 206, p: 22, c: 0, f: 12 },
  "thon égoutté": { kcal: 116, p: 26, c: 0, f: 1 },
  "bœuf maigre": { kcal: 200, p: 27, c: 0, f: 10 },
  "œuf": { kcal: 143, p: 12.6, c: 0.7, f: 9.5 },
  "yaourt grec 0%": { kcal: 59, p: 10, c: 3.6, f: 0.4 },
  "fromage blanc 0%": { kcal: 46, p: 8, c: 4, f: 0.2 },
  "lait demi-écrémé": { kcal: 46, p: 3.3, c: 4.8, f: 1.6 },
  "flocons d'avoine": { kcal: 379, p: 13, c: 67, f: 7 },
  "pain complet": { kcal: 247, p: 13, c: 41, f: 3.4 },
  "riz blanc cuit": { kcal: 130, p: 2.7, c: 28, f: 0.3 },
  "riz brun cuit": { kcal: 112, p: 2.6, c: 23, f: 0.9 },
  "quinoa cuit": { kcal: 120, p: 4.4, c: 21, f: 1.9 },
  "pâtes cuites": { kcal: 131, p: 5, c: 25, f: 1.1 },
  "patate douce cuite": { kcal: 86, p: 1.6, c: 20, f: 0.1 },
  "banane": { kcal: 89, p: 1.1, c: 23, f: 0.3 },
  "pomme": { kcal: 52, p: 0.3, c: 14, f: 0.2 },
  "myrtilles": { kcal: 57, p: 0.7, c: 14, f: 0.3 },
  "amandes": { kcal: 579, p: 21, c: 22, f: 50 },
  "avocat": { kcal: 160, p: 2, c: 9, f: 15 },
  "brocoli cuit": { kcal: 35, p: 2.4, c: 7, f: 0.4 },
  "haricots verts cuits": { kcal: 35, p: 1.9, c: 7, f: 0.2 },
  "épinards cuits": { kcal: 23, p: 3, c: 3.8, f: 0.3 },
  "salade verte": { kcal: 15, p: 1.4, c: 2.2, f: 0.2 },
  "huile d'olive": { kcal: 884, p: 0, c: 0, f: 100 },
};

export function macros(name: string, grams: number) {
  const n = FOODS[name];
  if (!n) return { kcal: 0, p: 0, c: 0, f: 0 };
  const k = grams / 100;
  return { kcal: n.kcal * k, p: n.p * k, c: n.c * k, f: n.f * k };
}

