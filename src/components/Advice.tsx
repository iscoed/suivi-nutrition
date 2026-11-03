import { useState } from "react";
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

  // Le plan ne se lance qu'au clic, pour économiser le quota de l'IA
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

  const dinnerPending = pending.some((s) => s.key === "dinner");

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold">Plan de la journée</h2>
        <button
          onClick={() => ask(plans.length > 0)}
          disabled={loading || pending.length === 0}
          className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
        >
          {loading ? "Réflexion…" : plans.length > 0 ? "Alternatives" : "Proposer le plan"}
        </button>
      </div>

      {advice && (
        <p className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{advice}</p>
      )}
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="py-2 pr-2">Moment</th>
              <th className="py-2 pr-2">État</th>
              <th className="py-2">Propositions</th>
            </tr>
          </thead>
          <tbody>
            {slots.map((s) => {
              const plan = plans.find((p) => p.slot === s.key);
              return (
                <tr key={s.key} className="border-b border-gray-100 align-top">
                  <td className="py-3 pr-2 font-medium">
                    {s.label}
                    <div className="text-xs font-normal text-gray-400">{s.time}</div>
                  </td>
                  <td className="py-3 pr-2">
                    {s.done ? (
                      <div className="text-emerald-700">
                        ✔ Déjà mangé
                        <div className="text-xs text-gray-500">
                          {Math.round(s.eaten.calories)} kcal · P {Math.round(s.eaten.proteins)} g · G {Math.round(s.eaten.carbs)} g · L {Math.round(s.eaten.fats)} g
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400">À venir</span>
                    )}
                  </td>
                  <td className="py-3">
                    {s.done ? (
                      <span className="text-gray-300">—</span>
                    ) : plan && plan.options.length > 0 ? (
                      plan.options.map((o, i) => (
                        <div key={i} className="mb-2 rounded-xl bg-gray-50 p-3">
                          <p className="font-medium">{o.title}</p>
                          <p className="text-xs text-emerald-700">
                            {Math.round(o.calories)} kcal · P {o.proteins_g} g · G {o.carbs_g} g · L {o.fats_g} g
                          </p>
                          <p className="text-xs text-gray-500">
                            {o.foods.map((f) => `${f.name} ${f.quantity_g} g`).join(" · ")}
                          </p>
                        </div>
                      ))
                    ) : (
                      <span className="text-gray-300">{loading ? "…" : "—"}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {dinnerPending && (
        <ul className="mt-4 list-disc pl-5 text-xs text-gray-400">
          {DINNER_LIMITS.map((l) => <li key={l}>{l}</li>)}
        </ul>
      )}
    </section>
  );
}