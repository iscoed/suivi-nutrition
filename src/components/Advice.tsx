import { useState } from "react";
import { buildPlans } from "../lib/planner";
import { DINNER_LIMITS } from "../lib/planning";

export interface SlotStatus {
  key: string;
  label: string;
  time: string;
  done: boolean;
  eaten: { calories: number; proteins: number; carbs: number; fats: number };
}

interface Props {
  slots: SlotStatus[];
  remaining: { calories: number; proteins_g: number; carbs_g: number; fats_g: number };
}

const r1 = (v: number) => (Math.round(v * 10) / 10).toLocaleString("fr-FR");
const r0 = (v: number) => Math.round(v).toLocaleString("fr-FR");

export default function Advice({ slots, remaining }: Props) {
  // -1 = plan pas encore demandé ; sinon, décalage pour « Alternatives »
  const [offset, setOffset] = useState(-1);

  const pending = slots.filter((s) => !s.done);
  const plans = offset >= 0 ? buildPlans(pending, remaining, offset) : [];
  const dinnerPending = pending.some((s) => s.key === "dinner");

  function next() {
    setOffset(offset < 0 ? 0 : offset + 1);
  }

  const message =
    pending.length === 0
      ? "Journée complète, bravo ! Rien d'autre à prévoir."
      : remaining.calories < 100
      ? "Vous êtes presque au bout de votre objectif : rien d'obligatoire à ajouter."
      : `Il reste ${r0(remaining.calories)} kcal et ${r0(remaining.proteins_g)} g de protéines à répartir.`;

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold">Plan de la journée</h2>
        <button
          onClick={next}
          disabled={pending.length === 0}
          className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
        >
          {offset < 0 ? "Proposer le plan" : "Alternatives"}
        </button>
      </div>

      <p className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{message}</p>

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
                          {r0(s.eaten.calories)} kcal · P {r1(s.eaten.proteins)} g · G {r1(s.eaten.carbs)} g · L {r1(s.eaten.fats)} g
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400">À venir</span>
                    )}
                  </td>
                  <td className="py-3">
                    {s.done ? (
                      <span className="text-gray-300">—</span>
                    ) : plan ? (
                      plan.options.map((o, i) => (
                        <div key={i} className="mb-2 rounded-xl bg-gray-50 p-3">
                          <p className="font-medium">{o.title}</p>
                          <p className="text-xs text-emerald-700">
                            {r0(o.kcal)} kcal · P {r1(o.p)} g · G {r1(o.c)} g · L {r1(o.f)} g
                          </p>
                          <p className="text-xs text-gray-500">
                            {o.foods.map((f) => `${f.name} : ${f.grams} g`).join(" · ")}
                          </p>
                        </div>
                      ))
                    ) : (
                      <span className="text-gray-300">—</span>
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