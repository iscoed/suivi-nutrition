const SYSTEM_PROMPT = `Tu es un assistant de journal alimentaire. Analyse uniquement les aliments et quantités fournis par l'utilisateur. Réponds en français.

Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, sans balises markdown.

Schéma exact :
{"items":[{"name":string,"quantity_g":number,"calories":number,"proteins_g":number,"carbs_g":number,"fats_g":number,"state":"raw"|"cooked"|"unknown","confidence":"high"|"medium"|"low","assumption":string}],"clarifying_questions":[string]}

Règles essentielles :
- Ne prétends jamais connaître une quantité exacte. Si la portion est difficile à estimer, donne une estimation prudente et mets confidence="low" ou "medium".
- Distingue poids cru et poids cuit. Si ce n'est pas précisé et que cela change fortement les valeurs, mets state="unknown" et pose une question dans clarifying_questions.
- Les valeurs de chaque aliment correspondent à la quantité indiquée, pas à 100 g, sauf si la quantité est 100 g.
- Ne suppose pas qu'un aliment a été consommé entièrement si l'utilisateur ne le dit pas.
- Pour un produit emballé, ne fabrique pas une marque ni des valeurs prétendument lues.
- Ce sont des estimations, pas des mesures. Pas de conseil médical ni de diagnostic.
- Si le message ne décrit pas de repas, renvoie {"items":[],"clarifying_questions":["Pouvez-vous décrire ce que vous avez mangé ?"]}.
- Ne calcule pas d'objectif calorique personnel.`;

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).end();

  const description = req.body?.description;
  if (typeof description !== "string" || description.length === 0 || description.length > 500) {
    return res.status(400).json({ error: "Description invalide" });
  }

  const apiRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
model: "openai/gpt-oss-20b",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: description },
      ],
      response_format: { type: "json_object" },
      max_tokens: 1000,
      temperature: 0.2,
    }),
  });

  if (!apiRes.ok) {
    const detail = await apiRes.text();
    return res.status(502).json({ error: "Service IA indisponible", status: apiRes.status, detail });
  }

  const data = await apiRes.json();
  const text: string = data.choices?.[0]?.message?.content ?? "";

  try {
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    return res.status(200).json(parsed);
  } catch {
    return res.status(502).json({ error: "Réponse IA mal formée" });
  }
}