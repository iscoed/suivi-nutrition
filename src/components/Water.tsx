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
  const pct = Math.min(100, (total / goal) * 100);
  const left = Math.max(0, goal - total);
  const comment =
    total >= goal
      ? "Objectif d'eau atteint, bravo !"
      : total >= goal / 2
      ? `Déjà la moitié, encore ${left} ml. Un verre à chaque pause.`
      : `Il reste ${left} ml. Un grand verre pour commencer ?`;

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold">Eau</h2>
        <span className="text-sm text-gray-500">
          <b className="text-sky-600">{total}</b> / {goal} ml
        </span>
      </div>

      <div className="mb-3 h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: `${pct}%` }} />
      </div>

      <div className="mb-3 flex gap-2">
        <button
          onClick={() => run(() => addWater(date, 250))}
          className="rounded-full bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700 ring-1 ring-sky-200 hover:bg-sky-100"
        >
          +250 ml
        </button>
        <button
          onClick={() => run(() => addWater(date, 500))}
          className="rounded-full bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700 ring-1 ring-sky-200 hover:bg-sky-100"
        >
          +500 ml
        </button>
      </div>

      <p className="text-sm text-gray-600">{comment}</p>

      {items.length > 0 && (
        <ul className="mt-4 divide-y divide-gray-100 text-sm">
          {items.map((i) => (
            <li key={`${i.id}:${i.ml}`} className="flex items-center gap-3 py-2">
              <input
                type="number"
                defaultValue={i.ml}
                onBlur={(e) => {
                  const v = Number(e.target.value);
                  if (v > 0 && v !== i.ml) run(() => updateWater(i.id, v));
                }}
                className="w-24 rounded-lg border border-gray-200 px-2 py-1 text-right outline-none focus:border-sky-500"
              />
              <span className="text-gray-500">ml</span>
              <button onClick={() => run(() => deleteWater(i.id))} className="ml-auto text-xs font-medium text-red-500 hover:text-red-700">
                Supprimer
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </section>
  );
}