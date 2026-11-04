import { useState } from "react";
import type { FoodItem } from "../lib/types";

interface Product {
  name: string;
  serving_g: number | null;
  per100: { kcal: number; proteins: number; carbs: number; fats: number };
}

interface Props {
  onResult: (items: FoodItem[], questions: string[]) => void;
}

const round1 = (v: number) => Math.round(v * 10) / 10;

// Réduit la photo avant envoi : un téléphone produit des images lourdes
function resizeToJpeg(file: File, max = 1200): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = () => reject(new Error("Image illisible"));
    img.src = URL.createObjectURL(file);
  });
}

export default function Photo({ onResult }: Props) {
  const [qty, setQty] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [askQty, setAskQty] = useState("");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    setProduct(null);
    try {
      const image = await resizeToJpeg(file);
      const quantity_g = Number(qty.replace(",", ".")) || undefined;
      const r = await fetch("/api/photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, quantity_g }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(`${data.error ?? "Photo indisponible"} : ${String(data.detail ?? "").slice(0, 300)}`);

      if (data.product) {
        // Valeurs lues, quantité manquante : on la demande ici, sans reprendre la photo
        setProduct(data.product);
        setAskQty(data.product.serving_g ? String(data.product.serving_g) : "");
      } else {
        onResult(data.items ?? [], data.clarifying_questions ?? []);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function addProduct() {
    if (!product) return;
    const g = Number(askQty.replace(",", "."));
    if (!g || g <= 0) {
      setError("Entrez une quantité en grammes ou en ml.");
      return;
    }
    const k = g / 100;
    const p = product.per100;
    const item: FoodItem = {
      name: product.name || "Produit",
      quantity_g: g,
      calories: Math.round(p.kcal * k),
      proteins_g: round1(p.proteins * k),
      carbs_g: round1(p.carbs * k),
      fats_g: round1(p.fats * k),
      confidence: "high",
      assumption: `Photo de l'emballage (pour 100 g) × ${g}`,
    };
    setProduct(null);
    setError(null);
    onResult([item], []);
  }

  const buttonClass = `cursor-pointer rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 ${
    busy ? "pointer-events-none opacity-50" : ""
  }`;

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100 sm:p-5">
      <h2 className="mb-2 font-semibold">Photo de l'emballage</h2>
      <p className="mb-4 text-sm text-gray-500">
        Photographiez le tableau nutritionnel. Indiquez la quantité mangée si elle n'est pas sur l'emballage.
      </p>

      <div className="mb-3">
        <input
          type="number"
          inputMode="decimal"
          placeholder="Quantité (g ou ml)"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 sm:w-44"
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <label className={buttonClass}>
          Prendre une photo
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} disabled={busy} />
        </label>
        <label className={buttonClass}>
          Choisir dans la galerie
          <input type="file" accept="image/*" className="hidden" onChange={onFile} disabled={busy} />
        </label>
      </div>

      {busy && <p className="mt-3 text-sm text-gray-500">Lecture en cours…</p>}

      {product && (
        <div className="mt-4 rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200">
          <p className="text-sm font-medium text-amber-900">{product.name}</p>
          <p className="mb-3 text-sm text-amber-900">Quelle quantité avez-vous consommée (en grammes ou ml) ?</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              type="number"
              inputMode="decimal"
              value={askQty}
              onChange={(e) => setAskQty(e.target.value)}
              className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 sm:w-40"
            />
            <button onClick={addProduct} className="rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700">
              Ajouter à la liste
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </section>
  );
}