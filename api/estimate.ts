const SYSTEM_PROMPT = `Tu es un assistant de journal alimentaire. Analyse uniquement les aliments et quantités fournis par l'utilisateur. Réponds en français.

Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, sans balises markdown.

Schéma exact :
{"items":[{"name":string,"quantity_g":number,"calories":number,"proteins_g":number,"carbs_g":number,"fats_g":number,"state":"raw"|"cooked"|"unknown","confidence":"high"|"medium"|"low","assumption":string}],"clarifying_questions":[string]}

Règles essentielles :
- Découpe la phrase en aliments distincts. Chaque aliment a ses propres valeurs.
- Si l'utilisateur donne les valeurs d'un produit, utilise ces valeurs et calcule pour la quantité indiquée.
- Ne prétends jamais connaître une quantité exacte. Si la portion est estimée, mets confidence="low" ou "medium".
- Distingue poids cru et poids cuit. Si ce n'est pas précisé et que cela change fortement les valeurs, mets state="unknown" et pose une question dans clarifying_questions.
- Les valeurs correspondent à la quantité indiquée, pas à 100 g, sauf si la quantité est 100 g.
- Si un "Contenu de la page produit" est fourni, utilise uniquement ce contenu pour le nom du produit et ses valeurs. N'invente jamais de valeurs : si elles ne figurent pas dans le contenu, mets 0, confidence="low" et demande dans clarifying_questions de coller le tableau nutritionnel.
- Si l'utilisateur ne précise pas la quantité d'un produit, prends la portion indiquée sur la page et écris-la dans assumption.
- Les valeurs des pages produit sont souvent pour 100 g ou pour une portion : calcule pour la quantité réellement mangée et indique la base utilisée dans assumption.
- Ce sont des estimations. Pas de conseil médical.
- Si le message ne décrit pas de repas, renvoie {"items":[],"clarifying_questions":["Pouvez-vous décrire ce que vous avez mangé ?"]}.`;

const MODEL = "openai/gpt-oss-20b";

const TRACKING = /^(utm_|gclid|gad_|gbraid|wbraid|fbclid)/i;
const URL_RE = /https?:\/\/[^\s]+/i;

function cleanUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (!["http:", "https:"].includes(u.protocol)) return null;
    for (const key of [...u.searchParams.keys()]) {
      if (TRACKING.test(key)) u.searchParams.delete(key);
    }
    return u.toString();
  } catch {
    return null;
  }
}

function htmlToText(html: string): string {
  const jsonLd = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((m) => m[1])
    .join("\n");
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ");
  return (jsonLd + "\n" + body).slice(0, 8000);
}

async function fetchProductPage(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; suivi-nutrition/0.1)",
        "Accept-Language": "fr-FR,fr;q=0.9",
      },
      redirect: "follow",
    });
    if (!r.ok) return null;
    return htmlToText(await r.text());
  } catch {
    return null;
  }
}

async function callGroq(content: string) {
  return fetch("https://api.groq.com/openai/v1/chat/completions", {
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
}

function parseJson(text: string) {
  const clean = text.replace(/```json|```/g, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("pas de JSON");
  return JSON.parse(clean.slice(start, end + 1));
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).end();

  const description = req.body?.description;
  if (typeof description !== "string" || description.length === 0 || description.length > 1500) {
    return res.status(400).json({ error: "Description invalide" });
  }

  // Si la phrase contient un lien, on lit la page produit et on l'ajoute au contexte
  let content = description;
  const found = description.match(URL_RE);
  if (found) {
    content = description.replace(found[0], "[lien produit]");
    const clean = cleanUrl(found[0]);
    if (clean) {
      const pageText = await fetchProductPage(clean);
      content += pageText
        ? `\n\nContenu de la page produit (${clean}) :\n${pageText}`
        : `\n\nLe lien produit n'a pas pu être lu. Demande à l'utilisateur de coller le tableau nutritionnel dans clarifying_questions.`;
    }
  }

  let lastDetail = "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    const apiRes = await callGroq(content);

    if (!apiRes.ok) {
      lastDetail = await apiRes.text();
      if (apiRes.status !== 400 || !lastDetail.includes("json_validate_failed")) {
        return res.status(502).json({ error: "Service IA indisponible", status: apiRes.status, detail: lastDetail });
      }
      continue;
    }

    const data = await apiRes.json();
    const text: string = data.choices?.[0]?.message?.content ?? "";
    try {
      return res.status(200).json(parseJson(text));
    } catch {
      lastDetail = text;
    }
  }

  return res.status(502).json({ error: "Réponse IA mal formée", detail: lastDetail.slice(0, 300) });
}