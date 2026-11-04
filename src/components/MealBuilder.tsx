import { useState } from "react";
import type { FoodItem } from "../lib/types";

interface Line { name: string; grams: number; kcal: number; p: number; c: number; f: number }
interface Option { title: string; foods: Line[]; kcal: number; p: number; c: number; f: number }
interface Result { message: string; warnings: string[]; options: Option[] }

interface Props {
  onPick: (items: FoodItem[]) => void;
}

const field = "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500";
const label = "mb-1 block text-xs font-medium text-gray-600";

export default function MealBuilder({ onPick }: Props) {
  const [fridge, setFridge] = useState("");
  const [kcal, setKcal] = useState("");
  const [p, setP] = useState("");
  const [c, setC] = useState("");
  const [f, setF] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function propose() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await fetch("/api/meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fridge,
          target: {
            kcal: Number(kcal.replace(",", ".")) || 0,
            p: Number(p.replace(",", ".")) || 0,
            c: Number(c.replace(",", ".")) || 0,
            f: Number(f.replace(",", ".")) || 0,
          },
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Proposition indisponible");
      setResult(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function pick(o: Option) {
    const items: FoodItem[] = o.foods.map((l) => ({
      name: l.name,
      quantity_g: l.grams,
      calories: l.kcal,
      proteins_g: l.p,
      carbs_g: l.c,
      fats_g: l.f,
      confidence: "high" as const,
      assumption: "Repas proposé à partir de votre frigo (CIQUAL)",
    }));
    onPick(items);
  }

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100 sm:p-5">
      <h2 className="mb-1 font-semibold">Composer un repas</h2>
      <p className="mb-4 text-sm text-gray-500">
        Dites ce que vous avez dans le frigo, et les macros visées. Laissez vide ce qui ne compte pas.
      </p>

      <label className={label}>Ce qu'il y a dans le frigo</label>
      <textarea
        className={`${field} mb-4`}
        rows={2}
        placeholder="ex. poulet, riz, brocoli, œufs, yaourt"
        value={fridge}
        onChange={(e) => setFridge(e.target.value)}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label className={label}>Calories (kcal)</label>
          <input className={field} inputMode="decimal" value={kcal} onChange={(e) => setKcal(e.target.value)} />
        </div>
        <div>
          <label className={label}>Protéines (g)</label>
          <input className={field} inputMode="decimal" value={p} onChange={(e) => setP(e.target.value)} />
        </div>
        <div>
          <label className={label}>Glucides (g)</label>
          <input className={field} inputMode="decimal" value={c} onChange={(e) => setC(e.target.value)} />
        </div>
        <div>
          <label className={label}>Lipides (g)</label>
          <input className={field} inputMode="decimal" value={f} onChange={(e) => setF(e.target.value)} />
        </div>
      </div>

      <button
        onClick={propose}
        disabled={loading || !fridge.trim()}
        className="w-full rounded-full bg-emerald-600 px-5 py-3 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 sm:w-auto sm:py-2.5"
      >
        {loading ? "Je cuisine…" : "Proposer un repas"}
      </button>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {result && (
        <div className="mt-5 space-y-3">
          <p className="text-sm font-medium text-gray-800">{result.message}</p>

          {result.warnings.map((w, i) => (
            <p key={i} className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{w}</p>
          ))}

          {result.options.map((o, i) => (
            <div key={i} className="rounded-xl bg-gray-50 p-4">
              <p className="font-medium">Option {i + 1} · {o.title}</p>
              <p className="text-xs text-emerald-700">
                {Math.round(o.kcal)} kcal · P {o.p} g · G {o.c} g · L {o.f} g
              </p>
              <ul className="mt-1 text-xs text-gray-600">
                {o.foods.map((l, j) => (
                  <li key={j}>{l.name} : {l.grams} g</li>
                ))}
              </ul>
              <button
                onClick={() => pick(o)}
                className="mt-3 rounded-full border border-emerald-600 px-4 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
              >
                Ajouter à la liste
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}