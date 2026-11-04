import { readFileSync } from "fs";
import { join } from "path";

interface DbFood { n: string; k: number; p: number; c: number; f: number }
interface Targets { kcal: number; p: number; c: number; f: number }
interface Found { label: string; food: DbFood }
interface Line { name: string; grams: number; kcal: number; p: number; c: number; f: number }
interface Option { title: string; foods: Line[]; kcal: number; p: number; c: number; f: number; error: number }

const STEP = 10;
const MAX_G = 300;
const MAX_FOODS = 8;
const MAX_IN_MEAL = 3;

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

// Écart entre le repas proposé et les cibles (plus le chiffre est petit, mieux c'est)
function errorOf(tot: Targets, t: Targets): number {
  let e = 0;
  if (t.kcal > 0) e += ((tot.kcal - t.kcal) / Math.max(t.kcal, 100)) ** 2;
  if (t.p > 0) e += ((tot.p - t.p) / Math.max(t.p, 5)) ** 2;
  if (t.c > 0) e += ((tot.c - t.c) / Math.max(t.c, 5)) ** 2;
  if (t.f > 0) e += ((tot.f - t.f) / Math.max(t.f, 3)) ** 2;
  return e;
}

function subsets<T>(arr: T[], maxSize: number): T[][] {
  const out: T[][] = [];
  const rec = (start: number, cur: T[]) => {
    if (cur.length) out.push([...cur]);
    if (cur.length === maxSize) return;
    for (let i = start; i < arr.length; i++) {
      cur.push(arr[i]);
      rec(i + 1, cur);
      cur.pop();
    }
  };
  rec(0, []);
  return out;
}

// Trouve les meilleures quantités (pas de 10 g) pour un groupe d'aliments
function bestForGroup(group: Found[], t: Targets): Option | null {
  const n = group.length;
  const steps: number[] = Array(n).fill(1);
  const maxSteps = MAX_G / STEP;
  let best = null as Option | null;

  const check = () => {
    const lines: Line[] = group.map((g, i) => {
      const grams = steps[i] * STEP;
      const k = grams / 100;
      return {
        name: g.label,
        grams,
        kcal: Math.round(g.food.k * k),
        p: r1(g.food.p * k),
        c: r1(g.food.c * k),
        f: r1(g.food.f * k),
      };
    });
    const tot = lines.reduce(
      (a, l) => ({ kcal: a.kcal + l.kcal, p: a.p + l.p, c: a.c + l.c, f: a.f + l.f }),
      { kcal: 0, p: 0, c: 0, f: 0 }
    );
    const error = errorOf(tot, t);
    if (!best || error < best.error) {
      best = {
        title: group.map((g) => g.label).join(" + "),
        foods: lines,
        kcal: tot.kcal,
        p: r1(tot.p),
        c: r1(tot.c),
        f: r1(tot.f),
        error,
      };
    }
  };

  const rec = (i: number) => {
    if (i === n) return check();
    for (let s = 1; s <= maxSteps; s++) {
      steps[i] = s;
      rec(i + 1);
    }
  };
  rec(0);
  return best;
}

export default function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).end();

  const fridge = String(req.body?.fridge ?? "");
  const raw = req.body?.target ?? {};
  const t: Targets = {
    kcal: Number(raw.kcal) || 0,
    p: Number(raw.p) || 0,
    c: Number(raw.c) || 0,
    f: Number(raw.f) || 0,
  };

  if (t.kcal <= 0 && t.p <= 0 && t.c <= 0 && t.f <= 0) {
    return res.status(200).json({
      message: "Indique au moins une cible (calories ou macros), sinon je ne sais pas quoi viser 😄",
      warnings: [],
      options: [],
    });
  }

  const warnings: string[] = [];

  // Cohérence : 1 g de protéines ou de glucides = 4 kcal, 1 g de lipides = 9 kcal
  const macroKcal = 4 * t.p + 4 * t.c + 9 * t.f;
  if (t.kcal > 0 && macroKcal > 0 && Math.abs(macroKcal - t.kcal) / t.kcal > 0.15) {
    warnings.push(
      `Petit souci de cohérence 😄 : ${t.p} g de protéines, ${t.c} g de glucides et ${t.f} g de lipides font environ ${Math.round(macroKcal)} kcal, et non ${t.kcal}. Tu veux garder ${t.kcal} kcal, ou on passe à ${Math.round(macroKcal)} ?`
    );
  }
  if (t.kcal > 0 && t.kcal < 200) {
    warnings.push("Moins de 200 kcal : ça ressemble plus à une collation qu'à un repas. Tu veux vraiment un repas aussi léger ?");
  }

  const names = fridge
    .split(/,|;|\n| et /i)
    .map((s) => s.trim())
    .filter((s) => s.length > 1)
    .slice(0, MAX_FOODS);

  if (names.length === 0) {
    return res.status(200).json({
      message: "Dis-moi ce qu'il y a dans ton frigo (séparé par des virgules), je ne cuisine pas dans le vide 😄",
      warnings,
      options: [],
    });
  }

  const found: Found[] = [];
  const unknown: string[] = [];
  for (const name of names) {
    const food = searchFood(name);
    if (food) found.push({ label: name, food });
    else unknown.push(name);
  }
  if (unknown.length) {
    warnings.push(`Je ne retrouve pas : ${unknown.join(", ")}. Essaie un nom plus simple (ex. « poulet », « riz »).`);
  }
  if (found.length === 0) {
    return res.status(200).json({ message: "Je n'ai rien reconnu dans ton frigo 😅", warnings, options: [] });
  }

  const all: Option[] = [];
  for (const group of subsets(found, MAX_IN_MEAL)) {
    const best = bestForGroup(group, t);
    if (best) all.push(best);
  }
  all.sort((a, b) => a.error - b.error);
  const top = all.slice(0, 3);

  const message =
    top[0].error <= 0.5
      ? "Voilà ce que ton frigo peut faire 😄"
      : "Ton frigo ne colle pas parfaitement à ces cibles. Voici le plus proche : tu peux augmenter ou diminuer une cible, ou ajouter un aliment.";

  return res.status(200).json({
    message,
    warnings,
    options: top.map(({ error, ...o }) => o),
  });
}