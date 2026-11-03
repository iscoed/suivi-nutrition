import { readFileSync } from "fs";
import { join } from "path";

interface DbFood { n: string; k: number; p: number; c: number; f: number }

const SYSTEM_PROMPT = `Tu es un assistant de journal alimentaire. Réponds en français.

Tu reçois une liste d'aliments que la base de référence ne connaît pas, ou dont la quantité n'est pas précise.
Pour chacun, estime les valeurs pour la quantité indiquée, ou pour une portion courante si aucune quantité n'est donnée, et écris cette portion dans assumption.

Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, sans balises markdown.

Schéma exact :
{"items":[{"name":string,"quantity_g":number,"calories":number,"proteins_g":number,"carbs_g":number,"fats_g":number,"state":"raw"|"cooked"|"unknown","confidence":"high"|"medium"|"low","assumption":string}],"clarifying_questions":[string]}

Règles :
- N'invente pas de marque ni de valeurs de produit emballé. Si tu ne connais pas le produit, mets confidence="low".
- Ce sont des estimations. Pas de conseil médical.`;

const MODEL = "openai/gpt-oss-20b";
const URL_RE = /https?:\/\/[^\s]+/i;
const TRACKING = /^(utm_|gclid|gad_|gbraid|wbraid|fbclid|srsltid)/i;
const NOISE = /j[’']ai mang[ée]|ce matin|ce midi|ce soir|le matin|à midi|midi|soir|environ|un peu d[e’']?|quelques?|une petite|un petit/gi;

const UNIT_G: Record<string, number> = {
  oeuf: 55, barre: 60, pomme: 150, banane: 120, yaourt: 125, tranche: 30, cuillere: 15,
};

// ---------- Base CIQUAL ----------
let FOODS: DbFood[] | null = null;
function loadFoods(): DbFood[] {
  if (!FOODS) {
    FOODS = JSON.parse(readFileSync(join(process.cwd(), "src/data/foods.json"), "utf8"));
  }
  return FOODS!;
}

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/œ/g, "oe")
    .replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

const singular = (w: string) => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w);

const PREPARED = /prepar|preemball|appertis|salade|sandwich|pizza|tarte|brick|farci|composee|plat|recette|fait maison|aux |a base|surgele|conserve/;

const RULES: Record<string, { must: string[]; forbid: string[]; prefer: string[] }> = {
  lait: {
    must: ["lait"],
    forbid: ["chevre", "brebis", "jument", "anesse", "poudre", "condense", "fermente", "beurre", "creme", "chocolat", "soja", "avoine", "amande", "coco", "riz", "bebe", "uht"],
    prefer: ["entier", "pasteurise", "vache"],
  },
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
  pain: {
    must: ["pain"],
    forbid: ["perdu", "bagel", "pita", "grille", "toast", "panini", "sandwich", "epice", "mie", "biscotte", "burger", "wrap", "tortilla", "brioche", "viennoiserie", "noix", "raisin", "chocolat", "fruit", "seigle", "campagne", "complet", "aux", "avec", "farine", "pate", "au ", "sans"],
    prefer: [],
  },
};

function searchFood(query: string): DbFood | null {
  const qWords = norm(query).split(" ").filter(Boolean).map(singular);
  if (qWords.length === 0) return null;
  const first = qWords[0];
  const index = loadFoods().map((f) => {
    const key = norm(f.n);
    return { food: f, key, words: key.split(" ").map(singular) };
  });

  const rule = RULES[first];
  if (rule && qWords.length === 1) {
    let best: { food: DbFood; score: number } | null = null;
    for (const x of index) {
      if (!rule.must.every((m) => x.key.includes(m))) continue;
      if (rule.forbid.some((f) => x.key.includes(f))) continue;
      let score = x.key.length;
      if (rule.prefer.some((p) => x.key.includes(p))) score -= 15;
      if (PREPARED.test(x.key)) score += 50;
      if (!best || score < best.score) best = { food: x.food, score };
    }
    if (best) return best.food;
  }

  let best: { food: DbFood; score: number } | null = null;
  for (const x of index) {
    if (!qWords.every((w) => x.words.includes(w))) continue;
    let score = x.words.length;
    if (x.words[0] === first) score -= 20;
    if (PREPARED.test(x.key)) score += 30;
    if (/\bcru\b|\bcrue\b|\bcuit\b|\bcuite\b/.test(x.key)) score -= 3;
    if (!best || score < best.score) best = { food: x.food, score };
  }
  return best ? best.food : null;
}

const round1 = (v: number) => Math.round(v * 10) / 10;
const num = (s: string) => Number(s.replace(",", "."));

function macrosFor(food: DbFood, grams: number) {
  const k = grams / 100;
  return { calories: Math.round(food.k * k), proteins_g: round1(food.p * k), carbs_g: round1(food.c * k), fats_g: round1(food.f * k) };
}

// ---------- Découpage de la phrase ----------
function parseSegment(raw: string): { name: string; grams: number | null } | null {
  const s = raw.replace(NOISE, " ").replace(/\s+/g, " ").trim();
  if (!s) return null;
  let grams: number | null = null;
  let name = s;
  const gMatch = s.match(/(\d+(?:[.,]\d+)?)\s*(?:g|gr|grammes?)\b/i);
  const countMatch = s.match(/^(\d+(?:[.,]\d+)?)\s+([^\d].*)$/);
  if (gMatch) {
    grams = num(gMatch[1]);
    name = s.replace(gMatch[0], " ");
  } else if (countMatch) {
    const qty = num(countMatch[1]);
    const word = norm(countMatch[2]).split(" ")[0];
    const unit = UNIT_G[word] ?? UNIT_G[word.replace(/s$/, "")];
    name = countMatch[2];
    if (unit) grams = qty * unit;
  }
  name = name.replace(/\b(de|du|des|d|la|le|les|un|une|à)\b/gi, " ").replace(/['’]/g, " ").replace(/\s+/g, " ").trim();
  return { name, grams };
}

// ---------- Page produit ----------
function cleanUrl(raw: string): URL | null {
  try {
    const u = new URL(raw);
    if (!["http:", "https:"].includes(u.protocol)) return null;
    for (const key of [...u.searchParams.keys()]) if (TRACKING.test(key)) u.searchParams.delete(key);
    return u;
  } catch { return null; }
}

function plainText(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"').replace(/\s+/g, " ");
}

function parseProductPage(html: string) {
  const text = plainText(html);
  const grab = (re: RegExp) => {
    const m = text.match(re);
    return m ? num(m[1]) : null;
  };

  // Format tableau : "Énergie (kcal) : 370" ; format fiche : "Énergie 58 kcal"
  const kcal = grab(/Énergie \(kcal\)\s*:\s*([\d.,]+)/i) ?? grab(/Énergie\s+([\d.,]+)\s*kcal/i);
  const proteins = grab(/Protéines? \(g\)\s*:\s*([\d.,]+)/i) ?? grab(/Protéines?\s+([\d.,]+)\s*g\b/i);
  const carbs = grab(/Glucides \(g\)\s*:\s*([\d.,]+)/i) ?? grab(/Glucides\s+([\d.,]+)\s*g\b/i);
  const fats = grab(/Matières grasses \(g\)\s*:\s*([\d.,]+)/i) ?? grab(/Matières grasses\s+([\d.,]+)\s*g\b/i);
  if (kcal === null || proteins === null || carbs === null || fats === null) return null;

  // Quantité du produit : "Contenance 240 ml", sinon "60 grammes" dans le tableau
  const contenance = text.match(/Contenance\s+(\d+(?:[.,]\d+)?)\s*(?:ml|g)\b/i);
  const idx = text.search(/Valeurs nutritionnelles/i);
  const after = idx >= 0 ? text.slice(idx) : text;
  const portionGrammes =
    [...after.matchAll(/(\d+(?:[.,]\d+)?)\s*grammes\b/gi)]
      .map((m) => num(m[1]))
      .find((v) => v !== 100) ?? null;
  const portion = contenance ? num(contenance[1]) : portionGrammes;

  const title = (text.match(/Boisson|Barre|Protéine|Snack/i) ? "" : "") ||
    (html.match(/<title>([^<]+)<\/title>/i)?.[1] ?? "").trim();
  return { title, per100: { kcal, proteins, carbs, fats }, portion };
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; suivi-nutrition/0.1)", "Accept-Language": "fr-FR,fr;q=0.9" }, redirect: "follow" });
    return r.ok ? await r.text() : null;
  } catch { return null; }
}

// ---------- IA (aliments absents uniquement) ----------
function parseJson(text: string) {
  const clean = text.replace(/```json|```/g, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("pas de JSON");
  return JSON.parse(clean.slice(start, end + 1));
}

async function askModel(content: string) {
  let lastText = "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    const apiRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content }],
        response_format: { type: "json_object" },
        max_tokens: 2000,
        temperature: 0.1,
      }),
    });
    if (!apiRes.ok) throw new Error(`IA ${apiRes.status}: ${await apiRes.text()}`);
    const data = await apiRes.json();
    lastText = data.choices?.[0]?.message?.content ?? "";
    try { return parseJson(lastText); } catch { /* nouvelle tentative */ }
  }
  throw new Error(`Réponse IA mal formée: ${lastText.slice(0, 200)}`);
}

// ---------- Route ----------
export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).end();

  const description = req.body?.description;
  if (typeof description !== "string" || !description.trim() || description.length > 1500) {
    return res.status(400).json({ error: "Description invalide" });
  }

  const items: any[] = [];
  const questions: string[] = [];
  let text = description;

  try {
    const urlMatch = description.match(URL_RE);
    if (urlMatch) {
      text = description.replace(urlMatch[0], " , ");
      const u = cleanUrl(urlMatch[0]);
      const html = u ? await fetchHtml(u.toString()) : null;
      const product = html ? parseProductPage(html) : null;
      if (product) {
        const userG = text.match(/(\d+(?:[.,]\d+)?)\s*(?:g|gr|grammes?)\b/i);
        const qty = userG ? num(userG[1]) : product.portion;
        if (!qty) {
          questions.push("Quelle quantité avez-vous mangée (en grammes ou en nombre de barres) ?");
        } else {
          const f = qty / 100;
          const p = product.per100;
          items.push({
            name: product.title || "Produit",
            quantity_g: qty,
            calories: Math.round(p.kcal * f),
            proteins_g: round1(p.proteins * f),
            carbs_g: round1(p.carbs * f),
            fats_g: round1(p.fats * f),
            state: "unknown",
            confidence: "high",
            assumption: `Valeurs de la page produit (pour 100 g) × ${qty} g`,
          });
        }
      } else if (u) {
        questions.push("Je n'arrive pas à lire le tableau nutritionnel de ce site. Collez-le dans votre message, ou tapez les valeurs.");
      }
    }

    const segments = text
      .split(/,|;|\bet\b|\+|\n|\bpuis\b|\bavec\b/i)
      .map(parseSegment)
      .filter((s): s is { name: string; grams: number | null } => s !== null);

    const unmatched: string[] = [];
    for (const seg of segments) {
      const letters = seg.name.replace(/[^a-zA-Zà-ÿ]/g, "");
      if (letters.length < 3 || /^(ca|ce|cela|ça)$/i.test(seg.name)) continue;

      const food = seg.grams !== null ? searchFood(seg.name) ?? searchFood(seg.name.split(" ")[0]) : null;
      if (food && seg.grams !== null) {
        const m = macrosFor(food, seg.grams);
        items.push({
          name: seg.name,
          quantity_g: seg.grams,
          calories: m.calories,
          proteins_g: m.proteins_g,
          carbs_g: m.carbs_g,
          fats_g: m.fats_g,
          state: "unknown",
          confidence: "high",
          assumption: `CIQUAL : ${food.n}`,
        });
      } else {
        unmatched.push(seg.grams !== null ? `${seg.grams} g de ${seg.name}` : seg.name);
      }
    }

    if (unmatched.length > 0) {
      const out = await askModel("Aliments à estimer :\n" + unmatched.map((u) => `- ${u}`).join("\n"));
      if (Array.isArray(out.items)) items.push(...out.items);
      if (Array.isArray(out.clarifying_questions)) questions.push(...out.clarifying_questions);
    }

    return res.status(200).json({ items, clarifying_questions: questions });
  } catch (e) {
    return res.status(502).json({ error: "Service IA indisponible", detail: (e as Error).message });
  }
}