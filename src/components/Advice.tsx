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
  foods: { name: string; grams: number }[];
  kcal: number;
  p: number;
  c: number;
  f: number;
}
interface Plan { slot: string; options: Option[] }

interface Props {
  slots: SlotStatus[];
  remaining: { calories: number; proteins_g: number; carbs_g: number; fats_g: number };
}

const r1 = (v: number) => (Math.round(v * 10) / 10).toLocaleString("fr-FR");
const r0 = (v: number) => Math.round(v).toLocaleString("fr-FR");

export default function Advice({ slots, remaining }: Props) {
  const [offset, setOffset] = useState(-1);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pending = slots.filter((s) => !s.done);

  async function run(nextOffset: number) {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slots: pending.map((s) => ({ key: s.key })),
          remaining,
          offset: nextOffset,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Plan indisponible");
      setPlans(data.plans ?? []);
      setOffset(nextOffset);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const message =
    pending.length === 0
      ? "Journée complète, bravo ! Rien d'autre à prévoir."
      : remaining.calories < 100
      ? "Vous êtes presque au bout de votre objectif : rien d'obligatoire à ajouter."
      : `Il reste ${r0(remaining.calories)} kcal et ${r0(remaining.proteins_g)} g de protéines à répartir.`;

  return (
    <section className="space-y-4">
      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-semibold">Plan de la journée</h2>
          <button
            onClick={() => run(offset < 0 ? 0 : offset + 1)}
            disabled={loading || pending.length === 0}
            className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
          >
            {loading ? "Calcul…" : offset < 0 ? "Proposer" : "Alternatives"}
          </button>
        </div>
        <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{message}</p>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>

      {slots.map((s) => {
        const plan = plans.find((p) => p.slot === s.key);
        const isDinner = s.key === "dinner";
        return (
          <div key={s.key} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-gray-900">{s.label}</p>
                <p className="text-xs text-gray-400">{s.time}</p>
              </div>
              {s.done ? (
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">✔ Mangé</span>
              ) : (
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500">À venir</span>
              )}
            </div>

            {s.done && (
              <p className="mt-2 text-xs text-gray-500">
                {r0(s.eaten.calories)} kcal · P {r1(s.eaten.proteins)} g · G {r1(s.eaten.carbs)} g · L {r1(s.eaten.fats)} g
              </p>
            )}

            {!s.done && plan && (
              <div className="mt-3 space-y-2">
                {plan.options.map((o, i) => (
                  <div key={i} className="rounded-xl bg-gray-50 p-3">
                    <p className="text-sm font-medium">{o.title}</p>
                    <p className="text-xs font-medium text-emerald-700">
                      {r0(o.kcal)} kcal · P {r1(o.p)} g · G {r1(o.c)} g · L {r1(o.f)} g
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {o.foods.map((f) => `${f.name} ${f.grams} g`).join(" · ")}
                    </p>
                  </div>
                ))}
                {isDinner && (
                  <ul className="list-disc pl-5 text-[11px] text-gray-400">
                    {DINNER_LIMITS.map((l) => <li key={l}>{l}</li>)}
                  </ul>
                )}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}