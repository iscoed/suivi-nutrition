const MODEL = "openai/gpt-oss-20b";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).end();

  const { question, context } = req.body ?? {};
  if (typeof question !== "string" || !question.trim() || question.length > 500) {
    return res.status(400).json({ error: "Question invalide" });
  }

  const minKcal = context?.sex === "homme" ? 1500 : 1200;
  const system = `Tu es le coach de l'application "Suivi nutrition". Tu réponds en français, de façon courte, claire et motivante, avec une touche d'humour légère de temps en temps.

Règles :
- Tu parles nutrition, repas, macros, eau et suivi du poids uniquement. Pour tout autre sujet, dis poliment que tu ne peux répondre qu'à ces questions.
- Tu ne donnes jamais d'avis médical. Pour un symptôme, une maladie ou un médicament, conseille de consulter un médecin ou un diététicien.
- Tu ne proposes jamais de descendre sous ${minKcal} kcal par jour, ni de sauter un repas, ni de restriction extrême.
- Ce sont des conseils généraux, pas une prescription.

Contexte de l'utilisateur (ne le répète pas en entier, utilise-le seulement si c'est utile) :
${JSON.stringify(context ?? {})}`;

  const apiRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY ?? ""}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: question },
      ],
      max_tokens: 1500,
      reasoning_effort: "low",
      temperature: 0.5,
    }),
  });

  if (apiRes.status === 429) {
    return res.status(429).json({ error: "Le coach est très sollicité en ce moment. Réessayez dans quelques minutes." });
  }
  if (!apiRes.ok) {
    return res.status(502).json({ error: "Le coach est indisponible", detail: (await apiRes.text()).slice(0, 200) });
  }

  const data = await apiRes.json();
  const answer: string = (data.choices?.[0]?.message?.content ?? "").trim();
  if (!answer) {
    return res.status(502).json({ error: "Le coach n'a pas su répondre. Reformulez votre question." });
  }
  return res.status(200).json({ answer });
}