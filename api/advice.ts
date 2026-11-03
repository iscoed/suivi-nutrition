const SYSTEM_PROMPT = `Tu es un coach nutritionnel motivant, avec une touche d'humour de temps en temps. Tu proposes des repas équilibrés et concrets, en français.

Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, sans balises markdown.

Schéma exact :
{"advice":string,"suggestions":[{"title":string,"foods":[{"name":string,"quantity_g":number}],"reason":string}]}

Règles :
- Respecte les restes de la journée : ne propose pas plus que ce qui manque, et équilibre protéines, glucides, lipides.
- Propose des équivalences courantes quand un nutriment manque (ex. 30 g de protéines : 200 g de poulet cuit, ou 4 œufs + 150 g de fromage blanc).
- Si c'est le dîner, applique strictement : riz 50 g max, poulet 100 g max, bœuf 80 g max, poisson 80 g max. Les légumes sont libres.
- Si l'utilisateur a déjà beaucoup de lipides pour le moment, propose une option plus maigre.
- Ne descends jamais en dessous du seuil minimal de calories donné : si le reste est faible, dis que la journée est bien remplie et ne propose pas de restriction.
- Ton motivant et parfois drôle, sans jamais culpabiliser.
- Ce sont des conseils généraux, pas un avis médical.`;

const MODEL = "openai/gpt-oss-20b";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).end();

  const { moment, remaining, dinner, alternative } = req.body ?? {};
  if (typeof moment !== "string" || !remaining) {
    return res.status(400).json({ error: "Données manquantes" });
  }

  const context = `Moment : ${moment}
Reste à consommer aujourd'hui : ${JSON.stringify(remaining)}
Dîner prévu : ${dinner ? "oui" : "non"}
${alternative ? "L'utilisateur demande une autre proposition, différente de la précédente." : ""}`;

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
        { role: "user", content: context },
      ],
      response_format: { type: "json_object" },
      max_tokens: 1500,
      temperature: 0.7,
    }),
  });

  if (!apiRes.ok) {
    const detail = await apiRes.text();
    return res.status(502).json({ error: "Service IA indisponible", detail });
  }

  const data = await apiRes.json();
  const text: string = data.choices?.[0]?.message?.content ?? "";
  try {
    const clean = text.replace(/```json|```/g, "").trim();
    return res.status(200).json(JSON.parse(clean.slice(clean.indexOf("{"), clean.lastIndexOf("}") + 1)));
  } catch {
    return res.status(502).json({ error: "Réponse IA mal formée" });
  }
}