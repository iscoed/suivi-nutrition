const PROMPT = `Tu lis une photo d'emballage alimentaire. Réponds en français, UNIQUEMENT avec un objet JSON valide, sans texte autour.

Schéma : {"name":string,"serving_g":number|null,"per100":{"kcal":number,"proteins":number,"carbs":number,"fats":number}|null,"readable":boolean}

- name : nom du produit tel qu'écrit (marque + nom).
- serving_g : poids ou volume d'une portion ou d'une unité, si indiqué (ex. "240 ml", "60 g"), sinon null.
- per100 : valeurs pour 100 g ou 100 ml. Si le tableau donne seulement "par portion", convertis en pour 100 g avec serving_g. Sinon null.
- readable : false si la photo est floue ou ne contient pas de tableau nutritionnel.
N'invente jamais de chiffre.`;

const round1 = (v: number) => Math.round(v * 10) / 10;

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).end();

  const { image, quantity_g } = req.body ?? {};
  if (typeof image !== "string" || image.length < 100) {
    return res.status(400).json({ error: "Photo manquante" });
  }
  const base64 = image.includes(",") ? image.split(",")[1] : image;

  const apiRes = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY ?? "",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: PROMPT }, { inlineData: { mimeType: "image/jpeg", data: base64 } }],
          },
        ],
        generationConfig: { responseMimeType: "application/json", maxOutputTokens: 800, temperature: 0.1 },
      }),
    }
  );
  if (!apiRes.ok) {
    return res.status(502).json({ error: "Service photo indisponible", detail: await apiRes.text() });
  }

  const data = await apiRes.json();
  const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  let info: any;
  try {
    info = JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch {
    return res.status(502).json({ error: "Réponse photo mal formée" });
  }

  if (!info.readable || !info.per100) {
    return res.status(200).json({
      items: [],
      clarifying_questions: ["Je n'arrive pas à lire le tableau nutritionnel. Reprenez la photo de plus près, en bonne lumière."],
    });
  }

  // La quantité saisie par l'utilisateur est prioritaire, sinon la portion de l'emballage
  const qty = Number(quantity_g) || info.serving_g;
  if (!qty) {
    return res.status(200).json({
      items: [],
      clarifying_questions: ["Quelle quantité avez-vous consommée (en grammes ou ml) ?"],
    });
  }

  const f = qty / 100;
  const p = info.per100;
  return res.status(200).json({
    items: [
      {
        name: info.name || "Produit",
        quantity_g: qty,
        calories: Math.round(p.kcal * f),
        proteins_g: round1(p.proteins * f),
        carbs_g: round1(p.carbs * f),
        fats_g: round1(p.fats * f),
        state: "unknown",
        confidence: "high",
        assumption: `Photo de l'emballage (pour 100 g) × ${qty}`,
      },
    ],
    clarifying_questions: [],
  });
}