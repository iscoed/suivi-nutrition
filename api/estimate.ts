const SYSTEM_PROMPT = `Tu es un assistant de journal alimentaire. Analyse uniquement les aliments et quantités fournis par l'utilisateur. Réponds en français.

Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, sans balises markdown.

Schéma exact :
{"items":[{"name":string,"quantity_g":number,"calories":number,"proteins_g":number,"carbs_g":number,"fats_g":number,"state":"raw"|"cooked"|"unknown","confidence":"high"|"medium"|"low","assumption":string}],"clarifying_questions":[string]}

Règles essentielles :
- Découpe la phrase en aliments distincts. Chaque aliment a ses propres valeurs.
- Si l'utilisateur donne les valeurs d'un produit (ex. barre protéinée avec ses valeurs pour 100 g ou par barre), utilise ces valeurs et calcule pour la quantité indiquée.
- Ne prétends jamais connaître une quantité exacte. Si la portion est estimée, mets confidence="low" ou "medium".
- Distingue poids cru et poids cuit. Si ce n'est pas précisé et que cela change fortement les valeurs, mets state="unknown" et pose une question dans clarifying_questions.
- Les valeurs correspondent à la quantité indiquée, pas à 100 g, sauf si la quantité est 100 g.
- Ce sont des estimations. Pas de conseil médical.
- Si le message ne décrit pas de repas, renvoie {"items":[],"clarifying_questions":["Pouvez-vous décrire ce que vous avez mangé ?"]}.`;

const MODEL = "openai/gpt-oss-20b";

async function callGroq(description: string) {
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
        { role: "user", content: description },
      ],
      response_format: { type: "json_object" },
      max_tokens: 2500,
      temperature: 0.1,
    }),
  });
  return apiRes;
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

  // Deux tentatives : si le modèle renvoie un JSON invalide, on réessaie une fois
  let lastDetail = "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    const apiRes = await callGroq(description);

    if (!apiRes.ok) {
      lastDetail = await apiRes.text();
      // Erreur qui ne se règle pas en réessayant : on arrête tout de suite
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