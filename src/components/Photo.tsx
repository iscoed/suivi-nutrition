import { useState } from "react";
import type { FoodItem } from "../lib/types";

interface Props {
  onResult: (items: FoodItem[], questions: string[]) => void;
}

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

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const image = await resizeToJpeg(file);
      const quantity_g = Number(qty.replace(",", ".")) || undefined;
      const r = await fetch("/api/photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, quantity_g }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Photo indisponible");
      onResult(data.items ?? [], data.clarifying_questions ?? []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <h2 className="mb-2 font-semibold">Photo de l'emballage</h2>
      <p className="mb-4 text-sm text-gray-500">
        Photographiez le tableau nutritionnel. Indiquez la quantité mangée si elle n'est pas sur l'emballage.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="number"
          inputMode="decimal"
          placeholder="Quantité (g ou ml)"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          className="w-44 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
        />
        <label
          className={`cursor-pointer rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 ${
            busy ? "pointer-events-none opacity-50" : ""
          }`}
        >
          {busy ? "Lecture…" : "Prendre une photo"}
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} disabled={busy} />
        </label>
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </section>
  );
}