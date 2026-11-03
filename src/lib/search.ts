import foods from "../data/foods.json";

export interface DbFood { n: string; k: number; p: number; c: number; f: number }

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/œ/g, "oe")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const singular = (w: string) => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w);

// Plats préparés : évités quand on cherche un aliment simple
const PREPARED = /prepar|preemball|appertis|salade|sandwich|pizza|tarte|brick|farci|composee|plat|recette|fait maison|aux |a base|surgele|conserve/;

// Règles pour les mots du quotidien
// must : mots obligatoires · forbid : mots interdits · prefer : mots préférés
const RULES: Record<string, { must: string[]; forbid: string[]; prefer: string[] }> = {
  amande: {
    must: ["amande"],
    forbid: ["grillee", "salee", "poudre", "pate", "lait", "huile", "sucree", "chocolat", "nougat", "dragee", "farine", "caramel", "enrobee", "torrefiee", "beurre"],
    prefer: ["crue", "cru", "nature", "douce"],
  },
  banane: {
    must: ["banane"],
    forbid: ["plantain", "seche", "nectar", "frite", "chips", "puree", "confiture"],
    prefer: ["crue", "cru", "chair"],
  },
  lait: {
    must: ["lait"],
    forbid: ["chevre", "brebis", "jument", "anesse", "poudre", "condense", "fermente", "beurre", "creme", "chocolat", "soja", "avoine", "amande", "coco", "riz", "bebe", "uht"],
    prefer: ["entier", "pasteurise", "vache"],
  },
   pain: {
    must: ["pain"],
    forbid: ["perdu", "bagel", "pita", "grille", "toast", "panini", "sandwich", "epice", "mie", "biscotte", "burger", "wrap", "tortilla", "brioche", "viennoiserie", "noix", "raisin", "chocolat", "fruit", "seigle", "campagne", "complet", "aux", "avec", "farine", "pate", "au ", "sans"],
    prefer: [],
  },
};

const INDEX = (foods as DbFood[]).map((f) => {
  const key = norm(f.n);
  return { food: f, key, words: key.split(" ").map(singular) };
});

export function searchFood(query: string): DbFood | null {
  const qWords = norm(query).split(" ").filter(Boolean).map(singular);
  if (qWords.length === 0) return null;
  const first = qWords[0];

  // 1. Règle dédiée, si le mot est un mot du quotidien seul
  const rule = RULES[first];
  if (rule && qWords.length === 1) {
    let best: { food: DbFood; score: number } | null = null;
    for (const x of INDEX) {
      if (!rule.must.every((m) => x.key.includes(m))) continue;
      if (rule.forbid.some((f) => x.key.includes(f))) continue;
      let score = x.key.length;
      if (rule.prefer.some((p) => x.key.includes(p))) score -= 15;
      if (PREPARED.test(x.key)) score += 50;
      if (!best || score < best.score) best = { food: x.food, score };
    }
    if (best) return best.food;
  }

  // 2. Recherche générale : aliment simple, qui commence par le mot
  let best: { food: DbFood; score: number } | null = null;
  for (const x of INDEX) {
    if (!qWords.every((w) => x.words.includes(w))) continue;
    let score = x.words.length;
    if (x.words[0] === first) score -= 20;
    if (PREPARED.test(x.key)) score += 30;
    if (/\bcru\b|\bcrue\b|\bcuit\b|\bcuite\b/.test(x.key)) score -= 3;
    if (!best || score < best.score) best = { food: x.food, score };
  }
  return best ? best.food : null;
}

export function macrosFor(food: DbFood, grams: number) {
  const k = grams / 100;
  return {
    calories: Math.round(food.k * k),
    proteins_g: Math.round(food.p * k * 10) / 10,
    carbs_g: Math.round(food.c * k * 10) / 10,
    fats_g: Math.round(food.f * k * 10) / 10,
  };
}