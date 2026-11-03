const SYSTEM_PROMPT = `Tu es un coach nutritionnel motivant, avec une touche d'humour de temps en temps. Tu proposes des repas équilibrés et concrets, en français.

Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, sans balises markdown.

Schéma exact :
{"advice":string,"suggestions":[{"title":string,"foods":[{"name":string,"quantity_g":number}],"reason":string}]}

Règles :
- Respecte les restes de la journée : ne propose pas plus que ce qui manque, et équilibre protéines, glucides et lipides.
- Quand un nutriment manque, propose des équivalences courantes (ex. 30 g de protéines : 200 g de poulet cuit, ou 4 œufs + 150 g de fromage blanc).
- Si c'est le dîner : riz 50 g max, poulet 100 g max, bœuf 80 g max, poisson 80 g max. Les légumes sont libres.
- Si beaucoup de lipides sont déjà consommés, propose une option plus maigre.
- Ne propose jamais de restriction : si le reste est faible, dis que la journée est bien remplie.
- Ton motivant et parfois drôle, sans jamais culpabiliser.
- Ce sont des conseils généraux, pas un avis médical.`;

const MODEL = "openai/gpt-oss-20b";
const FALLBACK = {
  advice: "Le coach fait une pause café. Réessayez dans un instant, ou cliquez sur Alternatives.",
  suggestions: [],
};

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
      response_format: { type: "json_object" },
      max_tokens: 1200,
      temperature,
    }),
  });
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).end();

  const { moment, remaining, dinner, alternative } = req.body ?? {};
  if (typeof moment !== "string" || !remaining) {
    return res.status(400).json({ error: "Données manquantes" });
  }

  const context = `Moment : ${moment}
Reste à consommer aujourd'hui : ${JSON.stringify(remaining)}
Dîner prévu : ${dinner ? "oui" : "non"}
${alternative ? "L'utilisateur demande une proposition différente de la précédente." : ""}`;

  // Deux tentatives, avec une température un peu plus haute pour la seconde
  for (const temperature of [0.4, 0.8]) {
    const apiRes = await callGroq(context, alternative ? 0.9 : temperature);
    if (!apiRes.ok) {
      const detail = await apiRes.text();
      // Erreur qui ne se règle pas en réessayant : on arrête
      if (apiRes.status !== 400 || !detail.includes("json_validate_failed")) {
        return res.status(502).json({ error: "Service IA indisponible", detail });
      }
      continue;
    }
    const data = await apiRes.json();
    try {
      return res.status(200).json(parseJson(data.choices?.[0]?.message?.content ?? ""));
    } catch {
      // On réessaie
    }
  }

  // Réponse de secours : l'écran reste utile même si l'IA ne répond pas
  return res.status(200).json(FALLBACK);
}