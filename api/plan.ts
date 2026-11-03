import { readFileSync } from "fs";
import { join } from "path";

interface DbFood { n: string; k: number; p: number; c: number; f: number }
type Kind = "breakfast" | "snack" | "lunch" | "dinner";
interface Ingredient { q: string; g: number }
interface Template { title: string; items: Ingredient[] }

const WEIGHT: Record<string, number> = { breakfast: 0.25, snack1: 0.1, lunch: 0.3, snack2: 0.1, dinner: 0.25 };

// Les noms (q) sont recherchés dans CIQUAL. Les grammages du dîner sont déjà aux plafonds.
const TEMPLATES: Record<Kind, Template[]> = {
  breakfast: [
    { title: "Porridge, lait et banane", items: [{ q: "avoine", g: 50 }, { q: "lait", g: 200 }, { q: "banane", g: 100 }] },
    { title: "Oeufs et pain complet", items: [{ q: "oeuf", g: 120 }, { q: "pain", g: 60 }] },
    { title: "Yaourt, myrtilles et amandes", items: [{ q: "yaourt nature", g: 200 }, { q: "myrtille", g: 80 }, { q: "amande", g: 15 }] },
    { title: "Fromage blanc et pomme", items: [{ q: "fromage blanc", g: 200 }, { q: "pomme", g: 120 }] },
  ],
  snack: [
    { title: "Yaourt et myrtilles", items: [{ q: "yaourt nature", g: 150 }, { q: "myrtille", g: 50 }] },
    { title: "Pomme et amandes", items: [{ q: "pomme", g: 150 }, { q: "amande", g: 20 }] },
    { title: "Fromage blanc et banane", items: [{ q: "fromage blanc", g: 150 }, { q: "banane", g: 100 }] },
    { title: "Oeuf et pomme", items: [{ q: "oeuf", g: 55 }, { q: "pomme", g: 120 }] },
  ],
  lunch: [
    { title: "Poulet, riz et brocoli", items: [{ q: "poulet", g: 150 }, { q: "riz", g: 120 }, { q: "brocoli", g: 150 }, { q: "huile d olive", g: 5 }] },
    { title: "Saumon, quinoa et épinards", items: [{ q: "saumon", g: 150 }, { q: "quinoa", g: 120 }, { q: "epinard", g: 100 }] },
    { title: "Thon, pâtes et salade", items: [{ q: "thon", g: 120 }, { q: "pates", g: 150 }, { q: "salade", g: 150 }] },
    { title: "Boeuf, pâtes et brocoli", items: [{ q: "boeuf", g: 120 }, { q: "pates", g: 150 }, { q: "brocoli", g: 150 }] },
  ],
  dinner: [
    { title: "Poisson, riz et haricots verts", items: [{ q: "poisson", g: 80 }, { q: "riz", g: 50 }, { q: "haricot vert", g: 200 }] },
    { title: "Poulet, patate douce et brocoli", items: [{ q: "poulet", g: 100 }, { q: "patate douce", g: 150 }, { q: "brocoli", g: 200 }] },
    { title: "Boeuf, quinoa et salade", items: [{ q: "boeuf", g: 80 }, { q: "quinoa", g: 50 }, { q: "salade", g: 200 }] },
    { title: "Thon, courgette et carotte", items: [{ q: "thon", g: 80 }, { q: "courgette", g: 200 }, { q: "carotte", g: 150 }] },
  ],
};

let FOODS: DbFood[] | null = null;
function loadFoods(): DbFood[] {
  if (!FOODS) FOODS = JSON.parse(readFileSync(join(process.cwd(), "src/data/foods.json"), "utf8"));
  return FOODS!;
}

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/œ/g, "oe")
    .replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const singular = (w: string) => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w);
const PREPARED = /prepar|preemball|appertis|salade|sandwich|pizza|tarte|brick|farci|composee|plat|recette|fait maison|aux |a base|surgele|conserve|perdu|pita|bagel/;

let INDEX: { food: DbFood; key: string; words: string[] }[] | null = null;
function index() {
  if (!INDEX) INDEX = loadFoods().map((f) => {
    const key = norm(f.n);
    return { food: f, key, words: key.split(" ").map(singular) };
  });
  return INDEX;
}

function searchFood(query: string): DbFood | null {
  const qWords = norm(query).split(" ").filter(Boolean).map(singular);
  if (qWords.length === 0) return null;
  const first = qWords[0];
  let best: { food: DbFood; score: number } | null = null;
  for (const x of index()) {
    if (!qWords.every((w) => x.words.includes(w))) continue;
    let score = x.words.length;
    if (x.words[0] === first) score -= 20;
    if (PREPARED.test(x.key)) score += 40;
    if (/\bcru\b|\bcrue\b|\bcuit\b|\bcuite\b/.test(x.key)) score -= 3;
    if (!best || score < best.score) best = { food: x.food, score };
  }
  return best ? best.food : null;
}

const r1 = (v: number) => Math.round(v * 10) / 10;
const round5 = (g: number) => Math.max(5, Math.round(g / 5) * 5);

function macros(food: DbFood, grams: number) {
  const k = grams / 100;
  return { kcal: food.k * k, p: food.p * k, c: food.c * k, f: food.f * k };
}

function kindOf(key: string): Kind {
  return key.startsWith("snack") ? "snack" : (key as Kind);
}

function build(t: Template, kind: Kind, targetKcal: number) {
  const found = t.items
    .map((i) => ({ i, food: searchFood(i.q) }))
    .filter((x): x is { i: Ingredient; food: DbFood } => x.food !== null);

  const base = found.reduce((s, x) => s + macros(x.food, x.i.g).kcal, 0);
  // Dîner : on ne dépasse jamais les grammages de base (qui sont déjà aux plafonds)
  const max = kind === "dinner" ? 1 : 1.5;
  const factor = base > 0 ? Math.min(max, Math.max(0.6, targetKcal / base)) : 1;

  const foods = found.map((x) => ({ name: x.food.n.split(",")[0], grams: round5(x.i.g * factor), food: x.food }));
  const tot = foods.reduce(
    (a, f) => {
      const m = macros(f.food, f.grams);
      return { kcal: a.kcal + m.kcal, p: a.p + m.p, c: a.c + m.c, f: a.f + m.f };
    },
    { kcal: 0, p: 0, c: 0, f: 0 }
  );

  return {
    title: t.title,
    foods: foods.map((f) => ({ name: f.name, grams: f.grams })),
    kcal: Math.round(tot.kcal),
    p: r1(tot.p),
    c: r1(tot.c),
    f: r1(tot.f),
  };
}

interface Template2 extends Template {}

export default function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).end();

  const { slots, remaining, offset } = req.body ?? {};
  if (!Array.isArray(slots) || !remaining) {
    return res.status(400).json({ error: "Données manquantes" });
  }
  const off = Number.isInteger(offset) && offset >= 0 ? offset : 0;
  const totalWeight = slots.reduce((s: number, x: any) => s + (WEIGHT[x.key] ?? 0.2), 0) || 1;

  const plans = slots.map((s: any) => {
    const kind = kindOf(s.key);
    const share = (WEIGHT[s.key] ?? 0.2) / totalWeight;
    const target = Math.max(0, Number(remaining.calories) || 0) * share;
    const list = TEMPLATES[kind];
    const options = [0, 1, 2].map((i) => build(list[(off + i) % list.length], kind, target));
    return { slot: s.key, options };
  });

  return res.status(200).json({ plans });
}