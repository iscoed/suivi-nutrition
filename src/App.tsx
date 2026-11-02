import { useState } from "react";
import { estimateMeal } from "./lib/estimate";
import type { FoodItem } from "./lib/types";
import { computeGoals, loadProfile, saveProfile, type Profile } from "./lib/profile";
import {
  addEntries, deleteEntry, loadEntries, newId, rescale, todayKey, totals, updateEntry, type Entry,
} from "./lib/journal";
import Onboarding from "./components/Onboarding";

const parseNum = (v: string) => {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

const card = "rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200";
const input = "rounded-lg border border-gray-300 bg-white px-3 py-2 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200";
const btnPrimary = "rounded-full bg-emerald-600 px-5 py-2.5 font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50";

function NumInput({ value, onCommit, className = "w-16" }: { value: number; onCommit: (n: number) => void; className?: string }) {
  const [draft, setDraft] = useState(String(value));
  return (
    <input
      key={value}
      className={`${className} rounded-md border border-gray-300 px-2 py-1 text-right outline-none focus:border-emerald-500`}
      inputMode="decimal"
      defaultValue={String(value)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => onCommit(parseNum(draft || e.target.value))}
    />
  );
}

function Stat({ label, eaten, goal, unit, color }: { label: string; eaten: number; goal: number; unit: string; color: string }) {
  const left = Math.round(goal - eaten);
  const pct = goal > 0 ? Math.min(100, (eaten / goal) * 100) : 0;
  const over = eaten > goal;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="text-sm text-gray-500">
          <b className="text-gray-900">{Math.round(eaten)}</b> / {goal} {unit}
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full rounded-full transition-all ${over ? "bg-red-500" : color}`} style={{ width: `${pct}%` }} />
      </div>
      <p className={`text-xs ${over ? "text-red-600" : "text-gray-500"}`}>
        {over ? `Dépassé de ${Math.abs(left)} ${unit}` : `Il reste ${left} ${unit}`}
      </p>
    </div>
  );
}

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(() => loadProfile());
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(todayKey());
  const [entries, setEntries] = useState<Entry[]>(() => loadEntries());

  const [description, setDescription] = useState("");
  const [pending, setPending] = useState<FoodItem[]>([]);
  const [questions, setQuestions] = useState<string[]>([]);
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
  const dayEntries = entries.filter((e) => e.date === date);
  const eaten = totals(dayEntries);
  const pendingTotal = totals(pending.map((p) => ({ ...p, date: "" }) as Entry));
  const diffKg = Math.round((profile.weight_kg - profile.target_weight_kg) * 10) / 10;

  async function analyze() {
    setLoading(true);
    setError(null);
    setQuestions([]);
    try {
      const out = await estimateMeal(description);
      setPending(out.items);
      setQuestions(out.questions);
      if (out.items.length === 0) setError("Aucun aliment reconnu. Précisez votre repas.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function addToJournal() {
    if (pending.length === 0) return;
    const list: Entry[] = pending.map((p) => ({ ...p, id: newId(), date }));
    setEntries(addEntries(list));
    setPending([]);
    setQuestions([]);
    setDescription("");
  }

  function updatePending(i: number, patch: Partial<FoodItem>) {
    setPending(pending.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }

  function rescalePending(i: number, qty: number) {
    setPending(pending.map((p, idx) => (idx === i ? rescale(p, qty) : p)));
  }

  function removePending(i: number) {
    setPending(pending.filter((_, idx) => idx !== i));
  }

  function editEntry(id: string, patch: Partial<Entry>) {
    setEntries(updateEntry(id, patch));
  }

  function rescaleEntry(e: Entry, qty: number) {
    setEntries(updateEntry(e.id, rescale(e, qty)));
  }

  function removeEntry(id: string) {
    setEntries(deleteEntry(id));
  }

  return (
    <div className="min-h-screen pb-16">
      <header className="bg-gradient-to-r from-emerald-600 to-teal-500 px-4 pb-10 pt-8 text-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Suivi nutrition</h1>
            <p className="text-sm text-emerald-100">
              {profile.weight_kg} kg · objectif {profile.target_weight_kg} kg
              {diffKg > 0 && ` · ${diffKg} kg à perdre`}
              {diffKg < 0 && ` · ${Math.abs(diffKg)} kg à prendre`}
              {diffKg === 0 && " · objectif atteint"}
            </p>
          </div>
          <button onClick={() => setEditing(true)} className="rounded-full bg-white/20 px-3 py-1.5 text-sm hover:bg-white/30">
            Profil
          </button>
        </div>
      </header>

      <main className="mx-auto -mt-6 max-w-2xl space-y-5 px-4">
        <section className={card}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Ma journée</h2>
            <input type="date" className={input} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-4">
            <Stat label="Calories" eaten={eaten.calories} goal={goals.calories} unit="kcal" color="bg-emerald-500" />
            <Stat label="Protéines" eaten={eaten.proteins} goal={goals.protein_g} unit="g" color="bg-sky-500" />
            <Stat label="Glucides" eaten={eaten.carbs} goal={goals.carbs_g} unit="g" color="bg-amber-500" />
            <Stat label="Lipides" eaten={eaten.fats} goal={goals.fat_g} unit="g" color="bg-rose-400" />
          </div>
          <p className="mt-4 text-xs text-gray-400">Objectifs estimés, à ajuster selon votre ressenti.</p>
        </section>

        <section className={card}>
          <h2 className="mb-3 font-semibold">Ajouter ce que vous avez mangé</h2>
          <textarea
            className={`${input} w-full`}
            rows={4}
            placeholder="Ex. ce matin 4 œufs, 170 g de riz basmati et un peu d'huile d'olive ; midi 40 g de poulet"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="mt-3 flex items-center gap-3">
            <button onClick={analyze} disabled={loading || !description.trim()} className={btnPrimary}>
              {loading ? "Analyse en cours…" : "Analyser"}
            </button>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          {questions.length > 0 && (
            <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
              <p className="font-semibold">Précisions demandées</p>
              <ul className="mt-1 list-disc pl-5">
                {questions.map((q, i) => <li key={i}>{q}</li>)}
              </ul>
            </div>
          )}
        </section>

        {pending.length > 0 && (
          <section className={card}>
            <h2 className="mb-3 font-semibold">À vérifier avant d'enregistrer</h2>
            <EntryTable
              rows={pending}
              onName={(i, v) => updatePending(i, { name: v })}
              onQty={(i, v) => rescalePending(i, v)}
              onField={(i, field, v) => updatePending(i, { [field]: v } as Partial<FoodItem>)}
              onDelete={(i) => removePending(i)}
            />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gray-50 p-3 text-sm">
              <span>
                Total : <b>{Math.round(pendingTotal.calories)} kcal</b> · P {Math.round(pendingTotal.proteins)} g · G {Math.round(pendingTotal.carbs)} g · L {Math.round(pendingTotal.fats)} g
              </span>
              <button onClick={addToJournal} className={btnPrimary}>Ajouter au journal</button>
            </div>
          </section>
        )}

        <section className={card}>
          <h2 className="mb-3 font-semibold">Repas du {date}</h2>
          {dayEntries.length === 0 && <p className="text-sm text-gray-400">Rien d'enregistré pour ce jour.</p>}
          {dayEntries.length > 0 && (
            <EntryTable
              rows={dayEntries}
              onName={(_, v, id) => editEntry(id!, { name: v })}
              onQty={(_, v, id) => rescaleEntry(dayEntries.find((e) => e.id === id)!, v)}
              onField={(_, field, v, id) => editEntry(id!, { [field]: v } as Partial<Entry>)}
              onDelete={(_, id) => removeEntry(id!)}
              withIds
            />
          )}
        </section>
      </main>
    </div>
  );
}

interface TableProps {
  rows: (FoodItem | Entry)[];
  onName: (i: number, v: string, id?: string) => void;
  onQty: (i: number, v: number, id?: string) => void;
  onField: (i: number, field: "calories" | "proteins_g" | "carbs_g" | "fats_g", v: number, id?: string) => void;
  onDelete: (i: number, id?: string) => void;
  withIds?: boolean;
}

function EntryTable({ rows, onName, onQty, onField, onDelete, withIds }: TableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
            <th className="py-2 pr-2">Aliment</th>
            <th className="px-1 py-2 text-right">g</th>
            <th className="px-1 py-2 text-right">kcal</th>
            <th className="px-1 py-2 text-right">P</th>
            <th className="px-1 py-2 text-right">G</th>
            <th className="px-1 py-2 text-right">L</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const id = withIds ? (r as Entry).id : undefined;
            return (
              <tr key={id ?? i} className={`border-b border-gray-100 align-top ${r.confidence === "low" ? "bg-amber-50" : ""}`}>
                <td className="py-2 pr-2">
                  <input className="w-full rounded-md border border-transparent px-1 py-0.5 hover:border-gray-300 focus:border-emerald-500 outline-none" value={r.name} onChange={(e) => onName(i, e.target.value, id)} />
                  {r.assumption && <div className="px-1 text-xs text-gray-400">{r.assumption}</div>}
                </td>
                <td className="px-1 py-2"><NumInput value={r.quantity_g} onCommit={(v) => onQty(i, v, id)} /></td>
                <td className="px-1 py-2"><NumInput value={Math.round(r.calories)} onCommit={(v) => onField(i, "calories", v, id)} /></td>
                <td className="px-1 py-2"><NumInput className="w-14" value={r.proteins_g} onCommit={(v) => onField(i, "proteins_g", v, id)} /></td>
                <td className="px-1 py-2"><NumInput className="w-14" value={r.carbs_g} onCommit={(v) => onField(i, "carbs_g", v, id)} /></td>
                <td className="px-1 py-2"><NumInput className="w-14" value={r.fats_g} onCommit={(v) => onField(i, "fats_g", v, id)} /></td>
                <td className="py-2 pl-2">
                  <button onClick={() => onDelete(i, id)} className="text-xs font-medium text-red-500 hover:text-red-700">Supprimer</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}