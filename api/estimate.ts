const SYSTEM_PROMPT = `Tu es un assistant nutritionnel. Tu reçois la description d'un repas.
Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, sans balises markdown.

Schéma exact :
{"items":[{"name":string,"quantity_g":number,"calories":number,"proteins_g":number,"carbs_g":number,"fats_g":number,"confidence":"high"|"medium"|"low","assumption":string}]}

Règles :
- Valeurs pour la quantité indiquée, en kcal et en grammes.
- Si aucune quantité n'est donnée, estime une portion courante et écris-la dans "assumption".
- "confidence" est "low" pour les sauces, plats maison ou quantités floues.
- Si la description ne contient pas d'aliment, renvoie {"items":[]}.`;

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).end();

  const description = req.body?.description;
  if (typeof description !== "string" || description.length === 0 || description.length > 500) {
    return res.status(400).json({ error: "Description invalide" });
  }

  const model = "gemini-2.5-flash";
  const apiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY!,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: description }] }],
        generationConfig: { responseMimeType: "application/json", maxOutputTokens: 800 },
      }),
    }
  );

  if (!apiRes.ok) return res.status(502).json({ error: "Service IA indisponible" });

  const data = await apiRes.json();
  const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  try {
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    return res.status(200).json(parsed);
  } catch {
    return res.status(502).json({ error: "Réponse IA mal formée" });
  }
}