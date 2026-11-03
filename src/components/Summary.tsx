import { useEffect, useState } from "react";

interface Props {
  remaining: { calories: number; proteins_g: number; carbs_g: number; fats_g: number };
  sex: "homme" | "femme";
  dinnerPlanned: boolean;
}

interface Suggestion { macro: string; label: string; grams: number; kcal: number; p: number; c: number; f: number }

const r0 = (v: number) => Math.round(v).toLocaleString("fr-FR");

export default function Summary({ remaining, sex, dinnerPlanned }: Props) {
  const [message, setMessage] = useState("");
  const [items, setItems] = useState<Suggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remaining, sex, dinnerPlanned, hour: new Date().getHours() }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Bilan indisponible");
      setMessage(data.message);
      setItems(data.suggestions ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining.calories, remaining.proteins_g, remaining.carbs_g, remaining.fats_g]);

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Bilan de la journée</h2>
        <button onClick={load} disabled={loading} className="text-sm text-emerald-700 underline disabled:opacity-50">
          {loading ? "Calcul…" : "Actualiser"}
        </button>
      </div>

      <p className="mb-3 text-sm text-gray-700">
        Il reste <b>{r0(remaining.calories)} kcal</b> · P {r0(remaining.proteins_g)} g · G {r0(remaining.carbs_g)} g · L {r0(remaining.fats_g)} g
      </p>

      {message && <p className="mb-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{message}</p>}
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {items.length > 0 && (
        <ul className="space-y-2 text-sm">
          {items.map((s, i) => (
            <li key={i} className="rounded-xl bg-gray-50 p-3">
              <span className="font-medium">{s.label} {s.grams} g</span>
              <span className="ml-2 text-xs text-gray-500">
                {r0(s.kcal)} kcal · P {r0(s.p)} g · G {r0(s.c)} g · L {r0(s.f)} g · pour compléter les {s.macro.toLowerCase()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}