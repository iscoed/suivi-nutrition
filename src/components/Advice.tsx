import { useEffect, useState } from "react";
import { DINNER_LIMITS } from "../lib/planning";

export interface SlotStatus {
  key: string;
  label: string;
  time: string;
  done: boolean;
  eaten: { calories: number; proteins: number; carbs: number; fats: number };
}

interface Option {
  title: string;
  foods: { name: string; quantity_g: number }[];
  calories: number;
  proteins_g: number;
  carbs_g: number;
  fats_g: number;
}
interface Plan { slot: string; options: Option[]; }

interface Props {
  slots: SlotStatus[];
  remaining: { calories: number; proteins_g: number; carbs_g: number; fats_g: number };
}

export default function Advice({ slots, remaining }: Props) {
  const [advice, setAdvice] = useState("");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pending = slots.filter((s) => !s.done);
  const pendingKey = pending.map((s) => s.key).join(",");
  const remainingKey = JSON.stringify(remaining);

  async function ask(alternative: boolean) {
    if (pending.length === 0) {
      setPlans([]);
      setAdvice("Journée complète, bravo ! Rien d'autre à prévoir.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/advice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slots: pending.map((s) => ({ key: s.key, label: s.label, time: s.time })),
          remaining,
          alternative,
        }),
      });
      const text = await r.text();
      if (!r.ok) throw new Error(`Conseil indisponible : ${text.slice(0, 200)}`);
      const data = JSON.parse(text);
      setAdvice(data.advice ?? "");
      setPlans(Array.isArray(data.plans) ? data.plans : []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    ask(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingKey, remainingKey]);

  const dinnerPending = pending.some((s) => s.key === "dinner");

  return (
    <section className="space-y-3 rounded border p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Plan de la journée</h2>
        <button
          onClick={() => ask(true)}
          disabled={loading || pending.length === 0}
          className="rounded-full bg-green-600 px-4 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {loading ? "Réflexion…" : "Alternatives"}
        </button>
      </div>

      {advice && <p className="text-sm">{advice}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-2 pr-2">Moment</th>
              <th className="py-2 pr-2">État</th>
              <th className="py-2">Propositions</th>
            </tr>
          </thead>
          <tbody>
            {slots.map((s) => {
              const plan = plans.find((p) => p.slot === s.key);
              return (
                <tr key={s.key} className="border-b align-top">
                  <td className="py-2 pr-2 font-medium">
                    {s.label}
                    <div className="text-xs font-normal text-gray-500">{s.time}</div>
                  </td>
                  <td className="py-2 pr-2">
                    {s.done ? (
                      <div className="text-green-700">
                        ✔ Déjà mangé
                        <div className="text-xs text-gray-600">
                          {Math.round(s.eaten.calories)} kcal · P {Math.round(s.eaten.proteins)} g · G {Math.round(s.eaten.carbs)} g · L {Math.round(s.eaten.fats)} g
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-500">À venir</span>
                    )}
                  </td>
                  <td className="py-2">
                    {s.done ? (
                      <span className="text-gray-400">—</span>
                    ) : plan && plan.options.length > 0 ? (
                      plan.options.map((o, i) => (
                        <div key={i} className="mb-2 rounded bg-gray-50 p-2">
                          <p className="font-medium">{o.title}</p>
                          <p className="text-xs text-gray-700">
                            {Math.round(o.calories)} kcal · P {o.proteins_g} g · G {o.carbs_g} g · L {o.fats_g} g
                          </p>
                          <p className="text-xs text-gray-600">
                            {o.foods.map((f) => `${f.name} ${f.quantity_g} g`).join(" · ")}
                          </p>
                        </div>
                      ))
                    ) : (
                      <span className="text-gray-400">{loading ? "…" : "—"}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {dinnerPending && (
        <ul className="list-disc pl-5 text-xs text-gray-500">
          {DINNER_LIMITS.map((l) => <li key={l}>{l}</li>)}
        </ul>
      )}
    </section>
  );
}