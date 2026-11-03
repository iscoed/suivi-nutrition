import { readFileSync } from "fs";
import { join } from "path";

interface DbFood { n: string; k: number; p: number; c: number; f: number }

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

// Aliments qui apportent surtout une macro : utilisés pour combler le manque
const SOURCES = {
  proteins: [
    { q: "poulet", label: "Poulet" },
    { q: "oeuf", label: "Oeufs" },
    { q: "fromage blanc", label: "Fromage blanc 0 %" },
    { q: "thon", label: "Thon" },
    { q: "yaourt nature", label: "Yaourt grec" },
  ],
  carbs: [
    { q: "riz", label: "Riz cuit" },
    { q: "pomme", label: "Pomme" },
    { q: "banane", label: "Banane" },
    { q: "avoine", label: "Flocons d'avoine" },
  ],
  fats: [
    { q: "amande", label: "Amandes" },
    { q: "huile d olive", label: "Huile d'olive" },
    { q: "avocat", label: "Avocat" },
  ],
};

// Quantité qui apporte environ 'target' grammes de la macro visée
function gramsFor(food: DbFood, macro: "p" | "c" | "f", target: number): number {
  const per100 = food[macro];
  if (per100 <= 0) return 0;
  return Math.max(10, Math.min(300, Math.round((target / per100) * 100 / 5) * 5));
}

export default function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).end();

  const { remaining, sex, dinnerPlanned, hour } = req.body ?? {};
  if (!remaining) return res.status(400).json({ error: "Données manquantes" });

  const minKcal = sex === "homme" ? 1500 : 1200;
  const kcalLeft = Number(remaining.calories) || 0;
  const pLeft = Number(remaining.proteins_g) || 0;
  const cLeft = Number(remaining.carbs_g) || 0;
  const fLeft = Number(remaining.fats_g) || 0;

  const lateInDay = Number(hour) >= 19;
  const suggestions: { macro: string; label: string; grams: number; kcal: number; p: number; c: number; f: number }[] = [];

  const pick = (list: { q: string; label: string }[], macro: "p" | "c" | "f", target: number, name: string) => {
    if (target < 5) return;
    for (const src of list) {
      const food = searchFood(src.q);
      if (!food) continue;
      const g = gramsFor(food, macro, target);
      const k = g / 100;
      suggestions.push({
        macro: name,
        label: src.label,
        grams: g,
        kcal: Math.round(food.k * k),
        p: r1(food.p * k),
        c: r1(food.c * k),
        f: r1(food.f * k),
      });
      return;
    }
  };

  pick(SOURCES.proteins, "p", pLeft, "Protéines");
  pick(SOURCES.carbs, "c", cLeft, "Glucides");
  pick(SOURCES.fats, "f", fLeft, "Lipides");

  let message: string;
  if (kcalLeft <= 0 && pLeft <= 0) {
    message = "Vos objectifs sont atteints aujourd'hui. Bravo, vous pouvez vous arrêter là.";
  } else if (lateInDay) {
    message = kcalLeft < 100
      ? "Journée bien remplie. Rien d'obligatoire à ajouter."
      : "Il reste peu de temps dans la journée : une petite collation suffit à compléter.";
  } else if (kcalLeft < minKcal - 900) {
    // Garde-fou : on ne propose jamais de restriction sous le seuil
    message = "Vous êtes déjà proche de votre objectif. Ajoutez seulement ce qui vous fait plaisir et qui reste équilibré.";
  } else {
    message = "Pour finir la journée, voici de quoi compléter vos macros.";
  }

  if (dinnerPlanned === false && pLeft > 20) {
    message += " Pas de dîner prévu ? Une collation protéinée fera l'affaire.";
  }

  return res.status(200).json({ message, suggestions, kcal_left: Math.round(kcalLeft) });
}