import { useState } from "react";
import { daySlots, DINNER_LIMITS } from "../lib/planning";

interface Suggestion {
  title: string;
  foods: { name: string; quantity_g: number }[];
  reason: string;
}

interface Props {
  remaining: { calories: number; proteins_g: number; carbs_g: number; fats_g: number };
}

export default function Advice({ remaining }: Props) {
  const slots = daySlots();
  const [moment, setMoment] = useState(slots[0].label);
  const [advice, setAdvice] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [askedAlt, setAskedAlt] = useState(false);

  const selected = slots.find((s) => s.label === moment) ?? slots[0];
  const isDinner = selected.kind === "dinner";

  async function ask(alternative: boolean) {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/advice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moment: `${selected.label} (${selected.time})`,
          remaining,
          dinner: isDinner,
          alternative,
        }),
      });
      if (!r.ok) throw new Error("Conseil indisponible, réessayez.");
      const data = await r.json();
      setAdvice(data.advice ?? null);
      setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
      setAskedAlt(alternative);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-3 rounded border p-3">
      <h2 className="font-semibold">Conseil du moment</h2>

      <div className="flex flex-wrap gap-2">
        {slots.map((s, i) => (
          <button
            key={i}
            onClick={() => setMoment(s.label)}
            className={`rounded-full border px-3 py-1 text-sm ${s.label === moment ? "bg-green-600 text-white" : ""}`}
          >
            {s.label} · {s.time}
          </button>
        ))}
      </div>

      {isDinner && (
        <ul className="list-disc pl-5 text-xs text-gray-600">
          {DINNER_LIMITS.map((l) => <li key={l}>{l}</li>)}
        </ul>
      )}

      <button onClick={() => ask(askedAlt)} disabled={loading} className="rounded bg-green-600 px-4 py-2 text-white disabled:opacity-50">
        {loading ? "Réflexion…" : advice ? "Alternatives" : "Proposer"}
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {advice && <p className="text-sm">{advice}</p>}

      {suggestions.map((s, i) => (
        <div key={i} className="rounded bg-gray-50 p-3 text-sm">
          <p className="font-semibold">{s.title}</p>
          <ul className="list-disc pl-5">
            {s.foods.map((f, j) => <li key={j}>{f.name} : {f.quantity_g} g</li>)}
          </ul>
          <p className="mt-1 text-xs text-gray-600">{s.reason}</p>
        </div>
      ))}
    </section>
  );
}