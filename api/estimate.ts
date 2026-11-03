const SYSTEM_PROMPT = `Tu es un assistant de journal alimentaire. Analyse uniquement les aliments et quantités fournis par l'utilisateur. Réponds en français.

Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, sans balises markdown.

Schéma exact :
{"items":[{"name":string,"quantity_g":number,"calories":number,"proteins_g":number,"carbs_g":number,"fats_g":number,"state":"raw"|"cooked"|"unknown","confidence":"high"|"medium"|"low","assumption":string}],"clarifying_questions":[string]}

Règles :
- Découpe la phrase en aliments distincts. Chaque aliment a ses propres valeurs pour la quantité indiquée.
- Si la quantité n'est pas précisée, estime une portion courante et écris-la dans assumption.
- N'invente pas de marque ni de valeurs de produit emballé.
- Distingue poids cru et poids cuit. Si ce n'est pas précisé et que cela change fortement les valeurs, mets state="unknown" et pose une question.
- Ce sont des estimations. Pas de conseil médical.
- Si le message ne décrit pas de repas, renvoie {"items":[],"clarifying_questions":["Pouvez-vous décrire ce que vous avez mangé ?"]}.`;

const MODEL = "openai/gpt-oss-20b";
const TRACKING = /^(utm_|gclid|gad_|gbraid|wbraid|fbclid|srsltid)/i;
const URL_RE = /https?:\/\/[^\s]+/i;

const num = (s: string) => Number(s.replace(",", "."));
const round1 = (v: number) => Math.round(v * 10) / 10;

function cleanUrl(raw: string): URL | null {
  try {
    const u = new URL(raw);
    if (!["http:", "https:"].includes(u.protocol)) return null;
    for (const key of [...u.searchParams.keys()]) {
      if (TRACKING.test(key)) u.searchParams.delete(key);
    }
    return u;
  } catch {
    return null;
  }
}

function plainText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ");
}

// Lit le tableau "pour 100 g" et la portion sur la page produit
function parseProductPage(html: string) {
  const text = plainText(html);
  const get = (re: RegExp) => {
    const m = text.match(re);
    return m ? num(m[1]) : null;
  };
  const kcal = get(/Énergie \(kcal\)\s*:\s*([\d.,]+)/i);
  const proteins = get(/Protéines? \(g\)\s*:\s*([\d.,]+)/i);
  const carbs = get(/Glucides \(g\)\s*:\s*([\d.,]+)/i);
  const fats = get(/Matières grasses \(g\)\s*:\s*([\d.,]+)/i);
  if (kcal === null || proteins === null || carbs === null || fats === null) return null;

  const portionMatch = text.match(/(\d+(?:[.,]\d+)?)\s*grammes\b/i);  const portion = portionMatch ? num(portionMatch[1]) : null;
  const title = (html.match(/<title>([^<]+)<\/title>/i)?.[1] ?? "").trim();
  return { title, per100: { kcal, proteins, carbs, fats }, portion };
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; suivi-nutrition/0.1)",
        "Accept-Language": "fr-FR,fr;q=0.9",
      },
      redirect: "follow",
    });
    return r.ok ? await r.text() : null;
  } catch {
    return null;
  }
}

function parseJson(text: string) {
  const clean = text.replace(/```json|```/g, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("pas de JSON");
  return JSON.parse(clean.slice(start, end + 1));
}

// Appel au modèle pour le texte libre (les autres aliments)
async function askModel(content: string) {
  let lastText = "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    const apiRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content },
        ],
        response_format: { type: "json_object" },
        max_tokens: 2500,
        temperature: 0.1,
      }),
    });
    if (!apiRes.ok) throw new Error(`IA ${apiRes.status}: ${await apiRes.text()}`);
    const data = await apiRes.json();
    lastText = data.choices?.[0]?.message?.content ?? "";
    try {
      return parseJson(lastText);
    } catch {
      // nouvelle tentative
    }
  }
  throw new Error(`Réponse IA mal formée: ${lastText.slice(0, 200)}`);
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).end();

  const description = req.body?.description;
  if (typeof description !== "string" || description.length === 0 || description.length > 1500) {
    return res.status(400).json({ error: "Description invalide" });
  }

  const items: any[] = [];
  const questions: string[] = [];
  let rest = description;

  try {
    const urlMatch = description.match(URL_RE);
    if (urlMatch) {
      rest = description.replace(urlMatch[0], " ");
      const u = cleanUrl(urlMatch[0]);
      const html = u ? await fetchHtml(u.toString()) : null;
      const product = html ? parseProductPage(html) : null;

      if (product) {
        // Quantité : celle écrite en grammes par l'utilisateur, sinon la portion de la page
        const userG = rest.match(/(\d+(?:[.,]\d+)?)\s*(?:g|grammes)\b/i);
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
      } else {
        questions.push("Je n'arrive pas à lire le tableau nutritionnel de ce site. Collez-le dans votre message, ou tapez les valeurs.");
      }
    }

    // Le reste du texte (autres aliments) passe par l'IA, sans la barre déjà traitée
    const restForModel = rest
      .replace(/j[’']ai mang[ée]/gi, " ")
      .replace(/(?:une?|1)\s*(?:barres?|portions?)/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (restForModel.replace(/[^a-zA-Zà-ÿ]/g, "").length >= 4) {
      const out = await askModel(restForModel);
      if (Array.isArray(out.items)) items.push(...out.items);
      if (Array.isArray(out.clarifying_questions)) questions.push(...out.clarifying_questions);
    }

    return res.status(200).json({ items, clarifying_questions: questions });
  } catch (e) {
    return res.status(502).json({ error: "Service IA indisponible", detail: (e as Error).message });
  }
}