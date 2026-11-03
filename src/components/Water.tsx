import { useEffect, useState } from "react";
import { addWater, deleteWater, loadWaterEntries, updateWater, waterGoalMl, type WaterEntry } from "../lib/water";
import type { Profile } from "../lib/profile";

export default function Water({ date, profile }: { date: string; profile: Profile }) {
  const goal = waterGoalMl(profile);
  const [items, setItems] = useState<WaterEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setItems(await loadWaterEntries(date));
  }

  useEffect(() => {
    refresh().catch((e) => setError((e as Error).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  async function run(action: () => Promise<void>) {
    try {
      await action();
      await refresh();
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const total = items.reduce((s, i) => s + i.ml, 0);
  const left = Math.max(0, goal - total);
  const comment =
    total >= goal
      ? "Objectif d'eau atteint, bravo !"
      : total >= goal / 2
      ? `Déjà la moitié, encore ${left} ml. Un verre à chaque pause.`
      : `Il reste ${left} ml. Un grand verre pour commencer ?`;

  return (
    <section className="space-y-3 rounded border p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Eau</h2>
        <span className="text-sm"><b>{total}</b> / {goal} ml</span>
      </div>
      <div className="flex gap-2">
        <button onClick={() => run(() => addWater(date, 250))} className="rounded-full border px-3 py-1 text-sm">+250 ml</button>
        <button onClick={() => run(() => addWater(date, 500))} className="rounded-full border px-3 py-1 text-sm">+500 ml</button>
      </div>
      <p className="text-sm text-gray-700">{comment}</p>

      {items.length > 0 && (
        <ul className="space-y-2 text-sm">
          {items.map((i) => (
            <li key={`${i.id}:${i.ml}`} className="flex items-center gap-2">
              <input
                type="number"
                defaultValue={i.ml}
                onBlur={(e) => {
                  const v = Number(e.target.value);
                  if (v > 0 && v !== i.ml) run(() => updateWater(i.id, v));
                }}
                className="w-24 rounded border p-1 text-right"
              />
              <span>ml</span>
              <button onClick={() => run(() => deleteWater(i.id))} className="text-red-600 underline">Supprimer</button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </section>
  );
}