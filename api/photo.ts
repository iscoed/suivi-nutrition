const PROMPT = `Tu lis une photo d'emballage alimentaire. Réponds en français, UNIQUEMENT avec un objet JSON valide, sans texte autour.

Schéma : {"name":string,"serving_g":number|null,"per100":{"kcal":number,"proteins":number,"carbs":number,"fats":number}|null,"readable":boolean}

- name : nom du produit tel qu'écrit (marque + nom).
- serving_g : poids ou volume d'une portion ou d'une unité, si indiqué (ex. "240 ml", "60 g"), sinon null.
- per100 : valeurs pour 100 g ou 100 ml. Si le tableau ne donne que "par portion", convertis en pour 100 g avec serving_g. Sinon null.
- readable : false si la photo est floue ou ne contient pas de tableau nutritionnel.
N'invente jamais de chiffre.`;

const MODEL = "qwen/qwen3.8-27b";
const round1 = (v: number) => Math.round(v * 10) / 10;

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).end();

  const { image, quantity_g } = req.body ?? {};
  if (typeof image !== "string" || image.length < 100) {
    return res.status(400).json({ error: "Photo manquante" });
  }
  const dataUrl = image.startsWith("data:") ? image : `data:image/jpeg;base64,${image}`;

  const body = JSON.stringify({
    model: MODEL,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: PROMPT },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 800,
    temperature: 0.1,
  });

  // Saturation temporaire : on réessaie jusqu'à 3 fois
  let apiRes: Response | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    apiRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY ?? ""}`,
      },
      body,
    });
    if (apiRes.status !== 500 && apiRes.status !== 503 && apiRes.status !== 429) break;
    await new Promise((r) => setTimeout(r, attempt * 2000));
  }

  if (!apiRes || !apiRes.ok) {
    return res.status(502).json({
      error: "Service photo indisponible",
      detail: apiRes ? (await apiRes.text()).slice(0, 300) : "Aucune réponse",
    });
  }

  const data = await apiRes.json();
  const text: string = data.choices?.[0]?.message?.content ?? "";
  let info: any;
  try {
    info = JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch {
    return res.status(502).json({ error: "Réponse photo mal formée", detail: text.slice(0, 200) });
  }

  if (!info.readable || !info.per100) {
    return res.status(200).json({
      items: [],
      clarifying_questions: ["Je n'arrive pas à lire le tableau nutritionnel. Reprenez la photo de plus près, en bonne lumière."],
    });
  }

  const qty = Number(quantity_g) || info.serving_g;
  if (!qty) {
    // On renvoie les valeurs lues, pour que l'écran calcule dès que la quantité est saisie
    return res.status(200).json({
      items: [],
      clarifying_questions: ["Quelle quantité avez-vous consommée (en grammes ou ml) ?"],
      product: { name: info.name || "Produit", serving_g: null, per100: info.per100 },
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