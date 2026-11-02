import { useState } from "react";
import { estimateMeal } from "./lib/estimate";
import type { FoodItem } from "./lib/types";

export default function App() {
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleEstimate() {
    setLoading(true);
    setError(null);
    try {
      setItems(await estimateMeal(description));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function updateItem(index: number, field: keyof FoodItem, value: string) {
    setItems(items.map((item, i) =>
      i === index ? { ...item, [field]: field === "name" || field === "assumption" || field === "confidence" ? value : Number(value) } : item
    ));
  }

  const total = items.reduce(
    (acc, it) => ({
      calories: acc.calories + it.calories,
      proteins: acc.proteins + it.proteins_g,
      carbs: acc.carbs + it.carbs_g,
      fats: acc.fats + it.fats_g,
    }),
    { calories: 0, proteins: 0, carbs: 0, fats: 0 }
  );

  return (
    <main className="mx-auto max-w-2xl p-4 space-y-6">
      <h1 className="text-2xl font-bold">Suivi nutrition</h1>

      <section className="space-y-2">
        <textarea
          className="w-full rounded border p-3"
          rows={3}
          placeholder="Ex. 150 g de poulet grillé, 200 g de riz cuit, une cuillère d'huile d'olive"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <button
          onClick={handleEstimate}
          disabled={loading || !description.trim()}
          className="rounded bg-green-600 px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? "Estimation..." : "Estimer"}
        </button>
        {error && <p className="text-red-600">{error}</p>}
      </section>

      {items.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold">Vérifiez avant d'enregistrer</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="p-1">Aliment</th>
                  <th className="p-1">g</th>
                  <th className="p-1">kcal</th>
                  <th className="p-1">P</th>
                  <th className="p-1">G</th>
                  <th className="p-1">L</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr
                    key={i}
                    className={`border-b ${it.confidence === "low" ? "bg-orange-50" : ""}`}
                  >
                    <td className="p-1">
                      <input className="w-full" value={it.name} onChange={(e) => updateItem(i, "name", e.target.value)} />
                      <div className="text-xs text-gray-500">{it.assumption}</div>
                    </td>
                    <td className="p-1"><input className="w-16" type="number" value={it.quantity_g} onChange={(e) => updateItem(i, "quantity_g", e.target.value)} /></td>
                    <td className="p-1"><input className="w-16" type="number" value={it.calories} onChange={(e) => updateItem(i, "calories", e.target.value)} /></td>
                    <td className="p-1"><input className="w-14" type="number" value={it.proteins_g} onChange={(e) => updateItem(i, "proteins_g", e.target.value)} /></td>
                    <td className="p-1"><input className="w-14" type="number" value={it.carbs_g} onChange={(e) => updateItem(i, "carbs_g", e.target.value)} /></td>
                    <td className="p-1"><input className="w-14" type="number" value={it.fats_g} onChange={(e) => updateItem(i, "fats_g", e.target.value)} /></td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="p-1">Total</td>
                  <td></td>
                  <td className="p-1">{Math.round(total.calories)}</td>
                  <td className="p-1">{Math.round(total.proteins)}</td>
                  <td className="p-1">{Math.round(total.carbs)}</td>
                  <td className="p-1">{Math.round(total.fats)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}