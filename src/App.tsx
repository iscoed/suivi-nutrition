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

// Champ numérique : la valeur est enregistrée quand on quitte le champ (évite les recalculs à chaque frappe)
function NumInput({ value, onCommit, className = "w-16" }: { value: number; onCommit: (n: number) => void; className?: string }) {
  const [draft, setDraft] = useState(String(value));
  return (
    <input
      key={value}
      className={`${className} rounded border p-1 text-right`}
      inputMode="decimal"
      defaultValue={String(value)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => {
        const n = parseNum(draft || e.target.value);
        onCommit(n);
      }}
    />
  );
}

function Stat({ label, eaten, goal, unit }: { label: string; eaten: number; goal: number; unit: string }) {
  const left = Math.round(goal - eaten);
  const pct = goal > 0 ? Math.min(100, (eaten / goal) * 100) : 0;
  const over = eaten > goal;
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span className="font-semibold">{label}</span>
        <span>{Math.round(eaten)} / {goal} {unit}</span>
      </div>
      <div className="h-2 w-full rounded bg-gray-200">
        <div className={`h-2 rounded ${over ? "bg-red-500" : "bg-green-600"}`} style={{ width: `${pct}%` }} />
      </div>
      <p className={`text-xs ${over ? "text-red-600" : "text-gray-600"}`}>
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
    <main className="mx-auto max-w-2xl space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Suivi nutrition</h1>
        <button onClick={() => setEditing(true)} className="text-sm text-green-700 underline">
          Modifier mon profil
        </button>
      </div>

      <section className="rounded border p-3 text-sm">
        <p>Poids actuel : <b>{profile.weight_kg} kg</b> · Objectif : <b>{profile.target_weight_kg} kg</b>
          {diffKg > 0 && ` (${diffKg} kg à perdre)`}
          {diffKg < 0 && ` (${Math.abs(diffKg)} kg à prendre)`}
          {diffKg === 0 && " (objectif atteint)"}
        </p>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold">Journée du</h2>
          <input type="date" className="rounded border p-1" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <Stat label="Calories" eaten={eaten.calories} goal={goals.calories} unit="kcal" />
        <Stat label="Protéines" eaten={eaten.proteins} goal={goals.protein_g} unit="g" />
        <Stat label="Glucides" eaten={eaten.carbs} goal={goals.carbs_g} unit="g" />
        <Stat label="Lipides" eaten={eaten.fats} goal={goals.fat_g} unit="g" />
        <p className="text-xs text-gray-500">Objectifs estimés, à ajuster selon votre ressenti.</p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Ajouter ce que vous avez mangé</h2>
        <textarea
          className="w-full rounded border p-3"
          rows={4}
          placeholder="Ex. ce matin 4 oeufs, 170 g de riz basmati et un peu d'huile d'olive ; midi 40 g de poulet"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <button
          onClick={analyze}
          disabled={loading || !description.trim()}
          className="rounded bg-green-600 px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? "Analyse..." : "Analyser"}
        </button>
        {error && <p className="text-red-600">{error}</p>}
      </section>

      {questions.length > 0 && (
        <section className="rounded border border-yellow-400 bg-yellow-50 p-3 text-sm">
          <p className="font-semibold">Précisions demandées :</p>
          <ul className="list-disc pl-5">
            {questions.map((q, i) => <li key={i}>{q}</li>)}
          </ul>
          <p className="mt-1 text-xs">Modifiez votre texte ci-dessus avec ces précisions, puis cliquez sur Analyser.</p>
        </section>
      )}

      {pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold">À vérifier avant d'enregistrer</h2>
          <EntryTable
            rows={pending}
            onName={(i, v) => updatePending(i, { name: v })}
            onQty={(i, v) => rescalePending(i, v)}
            onField={(i, field, v) => updatePending(i, { [field]: v } as Partial<FoodItem>)}
            onDelete={(i) => removePending(i)}
          />
          <p className="text-sm">
            Total : {Math.round(pendingTotal.calories)} kcal · P {Math.round(pendingTotal.proteins)} g · G {Math.round(pendingTotal.carbs)} g · L {Math.round(pendingTotal.fats)} g
          </p>
          <button onClick={addToJournal} className="rounded bg-green-600 px-4 py-2 text-white">
            Ajouter au journal du {date}
          </button>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-semibold">Journal du {date}</h2>
        {dayEntries.length === 0 && <p className="text-sm text-gray-500">Rien d'enregistré pour ce jour.</p>}
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
          <tr className="border-b text-left">
            <th className="p-1">Aliment</th>
            <th className="p-1">g</th>
            <th className="p-1">kcal</th>
            <th className="p-1">P</th>
            <th className="p-1">G</th>
            <th className="p-1">L</th>
            <th className="p-1"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const id = withIds ? (r as Entry).id : undefined;
            return (
              <tr key={id ?? i} className={`border-b align-top ${r.confidence === "low" ? "bg-orange-50" : ""}`}>
                <td className="p-1">
                  <input className="w-full rounded border p-1" value={r.name} onChange={(e) => onName(i, e.target.value, id)} />
                  {r.assumption && <div className="text-xs text-gray-500">{r.assumption}</div>}
                </td>
                <td className="p-1"><NumInput value={r.quantity_g} onCommit={(v) => onQty(i, v, id)} /></td>
                <td className="p-1"><NumInput value={Math.round(r.calories)} onCommit={(v) => onField(i, "calories", v, id)} /></td>
                <td className="p-1"><NumInput className="w-14" value={r.proteins_g} onCommit={(v) => onField(i, "proteins_g", v, id)} /></td>
                <td className="p-1"><NumInput className="w-14" value={r.carbs_g} onCommit={(v) => onField(i, "carbs_g", v, id)} /></td>
                <td className="p-1"><NumInput className="w-14" value={r.fats_g} onCommit={(v) => onField(i, "fats_g", v, id)} /></td>
                <td className="p-1">
                  <button onClick={() => onDelete(i, id)} className="text-red-600 underline">Supprimer</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}