import { useState } from "react";
import { estimateMeal } from "./lib/estimate";
import type { FoodItem } from "./lib/types";
import { computeGoals, loadProfile, saveProfile, type Profile } from "./lib/profile";
import Onboarding from "./components/Onboarding";

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(() => loadProfile());
  const [editing, setEditing] = useState(false);

  const [description, setDescription] = useState("");
  const [items, setItems] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!profile || editing) {
    return (
      <Onboarding
        initial={profile ?? undefined}
        onDone={(p) => {
          saveProfile(p);
          setProfile(p);
          setEditing(false);
        }}
      />
    );
  }

  const goals = computeGoals(profile);

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
    const textFields = ["name", "assumption", "confidence"];
    setItems(items.map((it, i) =>
      i === index ? { ...it, [field]: textFields.includes(field) ? value : Number(value) } : it
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
    <main className="mx-auto max-w-2xl space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Suivi nutrition</h1>
        <button onClick={() => setEditing(true)} className="text-sm text-green-700 underline">
          Modifier mon profil
        </button>
      </div>

      <section className="rounded border p-3">
        <h2 className="mb-2 font-semibold">Vos objectifs estimés</h2>
        <p className="text-sm">
          {goals.calories} kcal · Protéines {goals.protein_g} g · Glucides {goals.carbs_g} g · Lipides {goals.fat_g} g
        </p>
        <p className="mt-1 text-xs text-gray-500">Estimation indicative, à ajuster selon votre ressenti.</p>
      </section>

      <section className="space-y-2">
        <textarea
          className="w-full rounded border p-3"
          rows={3}
          placeholder="Ex. 150 g de poulet grillé, 200 g de riz cuit"
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
                  <tr key={i} className={`border-b ${it.confidence === "low" ? "bg-orange-50" : ""}`}>
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
                  <td className="p-1">Total du repas</td>
                  <td></td>
                  <td className="p-1">{Math.round(total.calories)}</td>
                  <td className="p-1">{Math.round(total.proteins)}</td>
                  <td className="p-1">{Math.round(total.carbs)}</td>
                  <td className="p-1">{Math.round(total.fats)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-sm">
            Ce repas représente environ {Math.round((total.calories / goals.calories) * 100)} % de votre objectif calorique du jour.
          </p>
        </section>
      )}
    </main>
  );
}