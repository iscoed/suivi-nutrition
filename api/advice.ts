const SYSTEM_PROMPT = `Tu es un coach nutritionnel motivant, avec une touche d'humour de temps en temps. Tu écris en français.

Réponds UNIQUEMENT avec les lignes suivantes, sans rien d'autre :
CONSEIL: une phrase d'encouragement ou d'analyse.
PROPOSITION: titre court | aliment 1 : quantité g ; aliment 2 : quantité g | raison courte
PROPOSITION: titre court | aliment 1 : quantité g ; aliment 2 : quantité g | raison courte

Règles :
- Ne propose pas plus que ce qui reste dans la journée, et équilibre protéines, glucides et lipides.
- Quand un nutriment manque, propose des équivalences courantes (ex. 30 g de protéines : 200 g de poulet cuit, ou 4 œufs + 150 g de fromage blanc).
- Au dîner : riz 50 g max, poulet 100 g max, bœuf 80 g max, poisson 80 g max. Les légumes sont libres.
- Si beaucoup de lipides sont déjà consommés, propose une option plus maigre.
- Ne propose jamais de restriction. Si le reste est faible, dis que la journée est bien remplie.
- Ce sont des conseils généraux, pas un avis médical.`;

const MODEL = "openai/gpt-oss-20b";

function parseText(text: string) {
  const advice = text.match(/CONSEIL\s*:\s*(.+)/i)?.[1]?.trim() ?? "";
  const suggestions = [...text.matchAll(/PROPOSITION\s*\d*\s*:\s*(.+)/gi)].map((m) => {
    const [title = "Proposition", foods = "", reason = ""] = m[1].split("|").map((s) => s.trim());
    const items = foods
      .split(";")
      .map((f) => f.trim())
      .filter(Boolean)
      .map((f) => {
        const [name, qty] = f.split(":").map((s) => s.trim());
        return {
          name: name || f,
          quantity_g: Number((qty ?? "").replace(/[^\d.,]/g, "").replace(",", ".")) || 0,
        };
      });
    return { title, foods: items, reason };
  });
  if (!advice && suggestions.length === 0) throw new Error("format inattendu");
  return { advice, suggestions };
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

  const { moment, remaining, dinner, alternative } = req.body ?? {};
  if (typeof moment !== "string" || !remaining) {
    return res.status(400).json({ error: "Données manquantes" });
  }

  const context = `Moment : ${moment}
Reste à consommer aujourd'hui : ${JSON.stringify(remaining)}
Dîner prévu : ${dinner ? "oui" : "non"}
${alternative ? "L'utilisateur demande une proposition différente de la précédente." : ""}`;

  let lastText = "";
  for (const temperature of [0.5, 0.9]) {
    const apiRes = await callGroq(context, temperature);
    if (!apiRes.ok) {
      const detail = await apiRes.text();
      return res.status(502).json({ error: "Service IA indisponible", detail });
    }
    const data = await apiRes.json();
    lastText = data.choices?.[0]?.message?.content ?? "";
    try {
      return res.status(200).json(parseText(lastText));
    } catch {
      // Nouvelle tentative
    }
  }

  return res.status(200).json({
    advice: "Le coach fait une pause café. Réessayez dans un instant, ou cliquez sur Alternatives.",
    suggestions: [],
    debug_raw: lastText.slice(0, 500),
  });
}