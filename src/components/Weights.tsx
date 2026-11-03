import { useEffect, useState } from "react";
import { loadWeights, movingAverage, saveWeight, type WeightPoint } from "../lib/weights";

export default function Weights({ date }: { date: string }) {
  const [points, setPoints] = useState<WeightPoint[]>([]);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setPoints(await loadWeights());
  }

  useEffect(() => {
    refresh().catch((e) => setError((e as Error).message));
  }, []);

  async function save() {
    const kg = Number(value.replace(",", "."));
    if (!Number.isFinite(kg) || kg < 30 || kg > 300) {
      setError("Entrez un poids entre 30 et 300 kg.");
      return;
    }
    try {
      await saveWeight(date, kg);
      setValue("");
      setError(null);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const last7 = points.slice(-7);
  const avg = movingAverage(points);
  const min = Math.min(...last7.map((p) => p.kg), 0);
  const max = Math.max(...last7.map((p) => p.kg), 1);
  const range = max - min || 1;
  const today = points.find((p) => p.date === date);

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <h2 className="mb-4 font-semibold">Poids</h2>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          className="w-28 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          inputMode="decimal"
          placeholder="ex. 78.4"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <span className="text-sm text-gray-500">kg pour le {date}</span>
        <button onClick={save} className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
          Enregistrer
        </button>
      </div>

      <div className="flex flex-wrap gap-6 text-sm">
        <span>Dernière pesée : <b>{points.length ? `${points[points.length - 1].kg} kg` : "—"}</b></span>
        <span>Moyenne 7 jours : <b>{avg ?? "—"} kg</b></span>
        {today && <span className="text-gray-500">Aujourd'hui : {today.kg} kg</span>}
      </div>

      {last7.length > 1 && (
        <div className="mt-5 flex h-28 items-end gap-2">
          {last7.map((p) => (
            <div key={p.date} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t-lg bg-emerald-400"
                style={{ height: `${10 + ((p.kg - min) / range) * 90}%` }}
                title={`${p.date} : ${p.kg} kg`}
              />
              <span className="text-[10px] text-gray-400">{p.date.slice(5)}</span>
            </div>
          ))}
        </div>
      )}

      {points.length < 3 && (
        <p className="mt-3 text-xs text-gray-400">Pesez-vous quelques jours de suite : la tendance devient lisible après 3 pesées.</p>
      )}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </section>
  );
}