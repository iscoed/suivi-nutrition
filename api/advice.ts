const SYSTEM_PROMPT = `Tu es un coach nutritionnel motivant, avec une touche d'humour de temps en temps. Tu écris en français.

Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, sans balises markdown.

Schéma exact :
{"advice":string,"plans":[{"slot":string,"options":[{"title":string,"foods":[{"name":string,"quantity_g":number}],"calories":number,"proteins_g":number,"carbs_g":number,"fats_g":number}]}]}

Règles :
- Tu reçois les moments à venir (slot = clé) et le reste total de la journée.
- Répartis le reste entre les moments à venir. La somme des calories proposées ne doit pas dépasser le reste total.
- Pour chaque moment à venir, propose 2 ou 3 options, avec leurs quantités et leurs valeurs calculées pour ces quantités.
- Les valeurs doivent être cohérentes (ex. 150 g de poulet cuit ≈ 165 kcal, 33 g de protéines).
- Équilibre protéines, glucides et lipides. Si les lipides restants sont faibles, propose des options maigres.
- Au dîner : riz 50 g max, poulet 100 g max, bœuf 80 g max, poisson 80 g max. Les légumes sont libres.
- Ne propose jamais de restriction. Si le reste est faible, dis-le dans advice avec de l'humour, sans conseiller de sauter un repas.
- "advice" : une phrase motivante ou drôle sur la journée.
- Ce sont des conseils généraux, pas un avis médical.`;

const MODEL = "openai/gpt-oss-20b";

function parseJson(text: string) {
  const clean = text.replace(/```json|```/g, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("pas de JSON");
  return JSON.parse(clean.slice(start, end + 1));
}

async function callGroq(context: string, temperature: number) {
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
        { role: "user", content: context },
      ],
      max_tokens: 4000,
      reasoning_effort: "low",
      temperature,
    }),
  });
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).end();

  const { slots, remaining, alternative } = req.body ?? {};
  if (!Array.isArray(slots) || !remaining) {
    return res.status(400).json({ error: "Données manquantes" });
  }
  if (slots.length === 0) {
    return res.status(200).json({ advice: "Journée complète, bravo !", plans: [] });
  }

  const context = `Moments à venir : ${JSON.stringify(slots)}
Reste total de la journée : ${JSON.stringify(remaining)}
${alternative ? "L'utilisateur veut des propositions différentes des précédentes." : ""}`;

  let lastText = "";
  for (const temperature of [alternative ? 0.9 : 0.5, 0.9]) {
    const apiRes = await callGroq(context, temperature);
    if (!apiRes.ok) {
      const detail = await apiRes.text();
      return res.status(502).json({ error: "Service IA indisponible", detail });
    }
    const data = await apiRes.json();
    lastText = data.choices?.[0]?.message?.content ?? "";
    try {
      const parsed = parseJson(lastText);
      if (Array.isArray(parsed.plans)) return res.status(200).json(parsed);
    } catch {
      // nouvelle tentative
    }
  }

  return res.status(200).json({
    advice: "Le coach fait une pause café. Cliquez sur Alternatives dans un instant.",
    plans: [],
    debug_raw: lastText.slice(0, 500),
  });
}