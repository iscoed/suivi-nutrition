import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import Auth from "./components/Auth";
import Onboarding from "./components/Onboarding";
import Advice, { type SlotStatus } from "./components/Advice";
import Water from "./components/Water";
import { estimateMeal } from "./lib/estimate";
import type { FoodItem } from "./lib/types";
import { computeGoals, type Profile } from "./lib/profile";
import { newId, rescale, todayKey, totals, type Entry } from "./lib/journal";
import { mealComment, sumItems } from "./lib/comment";
import { daySlots } from "./lib/planning";
import {
  loadCloudProfile, saveCloudProfile, loadCloudEntries, insertCloudEntries,
  updateCloudEntry, deleteCloudEntry,
} from "./lib/cloud";

const parseNum = (v: string) => {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

function NumInput({ value, onCommit, className = "w-16" }: { value: number; onCommit: (n: number) => void; className?: string }) {
  return (
    <input
      key={value}
      className={`${className} rounded border p-1 text-right`}
      inputMode="decimal"
      defaultValue={String(value)}
      onBlur={(e) => onCommit(parseNum(e.target.value))}
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
  const [session, setSession] = useState<boolean | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(todayKey());
  const [entries, setEntries] = useState<Entry[]>([]);

  const [description, setDescription] = useState("");
  const [slot, setSlot] = useState<string>("breakfast");
  const [pending, setPending] = useState<FoodItem[]>([]);
  const [questions, setQuestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastComment, setLastComment] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    (async () => {
      setProfile(await loadCloudProfile());
      setEntries(await loadCloudEntries());
      setLoaded(true);
    })().catch((e) => setError((e as Error).message));
  }, [session]);

  if (session === null) return <p className="p-6">Chargement…</p>;
  if (!session) return <Auth />;
  if (!loaded) return <p className="p-6">Chargement de vos données…</p>;

  if (!profile || editing) {
    return (
      <Onboarding
        initial={profile ?? undefined}
        onDone={async (p) => {
          await saveCloudProfile(p);
          setProfile(p);
          setEditing(false);
        }}
      />
    );
  }

  const dayDate = new Date(date + "T12:00:00");
  const daySlotList = daySlots(dayDate);
  const goals = computeGoals(profile);
  const dayEntries = entries.filter((e) => e.date === date);
  const eaten = totals(dayEntries);
  const pendingTotal = totals(pending.map((p) => ({ ...p, date: "" }) as Entry));
  const diffKg = Math.round((profile.weight_kg - profile.target_weight_kg) * 10) / 10;
  const remaining = {
    calories: Math.max(0, Math.round(goals.calories - eaten.calories)),
    proteins_g: Math.max(0, Math.round(goals.protein_g - eaten.proteins)),
    carbs_g: Math.max(0, Math.round(goals.carbs_g - eaten.carbs)),
    fats_g: Math.max(0, Math.round(goals.fat_g - eaten.fats)),
  };
  const slotStatus: SlotStatus[] = daySlotList.map((s) => {
    const list = dayEntries.filter((e) => e.slot === s.key);
    return { key: s.key, label: s.label, time: s.time, done: list.length > 0, eaten: totals(list) };
  });

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

  async function addToJournal() {
    if (pending.length === 0) return;
    const list: Entry[] = pending.map((p) => ({ ...p, id: newId(), date, slot }));
    try {
      await insertCloudEntries(list);
      setEntries([...entries, ...list]);
      setLastComment(mealComment(sumItems(list), list.length === 1 ? list[0].name : "Ce repas"));
      setPending([]);
      setQuestions([]);
      setDescription("");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function editEntry(id: string, patch: Partial<Entry>) {
    setEntries(entries.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    await updateCloudEntry(id, patch);
  }

  async function rescaleEntry(e: Entry, qty: number) {
    const r = rescale(e, qty);
    setEntries(entries.map((x) => (x.id === e.id ? r : x)));
    await updateCloudEntry(e.id, { quantity_g: r.quantity_g, calories: r.calories, proteins_g: r.proteins_g, carbs_g: r.carbs_g, fats_g: r.fats_g });
  }

  async function removeEntry(id: string) {
    setEntries(entries.filter((e) => e.id !== id));
    await deleteCloudEntry(id);
  }

  function updatePending(i: number, patch: Partial<FoodItem>) {
    setPending(pending.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }

  function rescalePending(i: number, qty: number) {
    setPending(pending.map((p, idx) => (idx === i ? rescale(p, qty) : p)));
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Suivi nutrition</h1>
        <div className="flex gap-3">
          <button onClick={() => setEditing(true)} className="text-sm text-green-700 underline">Profil</button>
          <button onClick={() => supabase.auth.signOut()} className="text-sm text-gray-500 underline">Déconnexion</button>
        </div>
      </div>

      <section className="rounded border p-3 text-sm">
        <p>Poids actuel : <b>{profile.weight_kg} kg</b> · Objectif : <b>{profile.target_weight_kg} kg</b>
          {diffKg > 0 && ` (${diffKg} kg à perdre)`}
          {diffKg < 0 && ` (${Math.abs(diffKg)} kg à prendre)`}
          {diffKg === 0 && " (objectif atteint)"}
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Ajouter ce que vous avez mangé</h2>
        <div className="flex flex-wrap items-center gap-2">
          <select className="rounded border p-2 text-sm" value={slot} onChange={(e) => setSlot(e.target.value)}>
            {daySlotList.map((s) => (
              <option key={s.key} value={s.key}>{s.label} · {s.time}</option>
            ))}
          </select>
        </div>
        <textarea
          className="w-full rounded border p-3"
          rows={4}
          placeholder="Ex. 4 oeufs, 170 g de riz basmati, un peu d'huile d'olive"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <button onClick={analyze} disabled={loading || !description.trim()} className="rounded bg-green-600 px-4 py-2 text-white disabled:opacity-50">
          {loading ? "Analyse..." : "Analyser"}
        </button>
        {error && <p className="text-red-600">{error}</p>}
      </section>

      {questions.length > 0 && (
        <section className="rounded border border-yellow-400 bg-yellow-50 p-3 text-sm">
          <p className="font-semibold">Précisions demandées :</p>
          <ul className="list-disc pl-5">{questions.map((q, i) => <li key={i}>{q}</li>)}</ul>
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
            onDelete={(i) => setPending(pending.filter((_, idx) => idx !== i))}
          />
          <p className="text-sm">
            Total : {Math.round(pendingTotal.calories)} kcal · P {Math.round(pendingTotal.proteins)} g · G {Math.round(pendingTotal.carbs)} g · L {Math.round(pendingTotal.fats)} g
          </p>
          <button onClick={addToJournal} className="rounded bg-green-600 px-4 py-2 text-white">Ajouter au journal</button>
        </section>
      )}

      {lastComment && (
        <section className="rounded border border-green-400 bg-green-50 p-3 text-sm">
          <p>{lastComment}</p>
        </section>
      )}

      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold">Journée du</h2>
          <input type="date" className="rounded border p-1" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <Stat label="Calories" eaten={eaten.calories} goal={goals.calories} unit="kcal" />
        <Stat label="Protéines" eaten={eaten.proteins} goal={goals.protein_g} unit="g" />
        <Stat label="Glucides" eaten={eaten.carbs} goal={goals.carbs_g} unit="g" />
        <Stat label="Lipides" eaten={eaten.fats} goal={goals.fat_g} unit="g" />
      </section>

      <Advice slots={slotStatus} remaining={remaining} />

      <section className="space-y-3">
        <h2 className="font-semibold">Repas du {date}</h2>
        {dayEntries.length === 0 && <p className="text-sm text-gray-500">Rien d'enregistré pour ce jour.</p>}
        {dayEntries.length > 0 && (
          <EntryTable
            rows={dayEntries}
            withIds
            onName={(_, v, id) => editEntry(id!, { name: v })}
            onQty={(_, v, id) => rescaleEntry(dayEntries.find((e) => e.id === id)!, v)}
            onField={(_, field, v, id) => editEntry(id!, { [field]: v } as Partial<Entry>)}
            onDelete={(_, id) => removeEntry(id!)}
          />
        )}
      </section>

      <Water date={date} profile={profile} />
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
                  <input className="w-full rounded border p-1" defaultValue={r.name} onBlur={(e) => onName(i, e.target.value, id)} />
                  {r.assumption && <div className="text-xs text-gray-500">{r.assumption}</div>}
                </td>
                <td className="p-1"><NumInput value={r.quantity_g} onCommit={(v) => onQty(i, v, id)} /></td>
                <td className="p-1"><NumInput value={Math.round(r.calories)} onCommit={(v) => onField(i, "calories", v, id)} /></td>
                <td className="p-1"><NumInput className="w-14" value={r.proteins_g} onCommit={(v) => onField(i, "proteins_g", v, id)} /></td>
                <td className="p-1"><NumInput className="w-14" value={r.carbs_g} onCommit={(v) => onField(i, "carbs_g", v, id)} /></td>
                <td className="p-1"><NumInput className="w-14" value={r.fats_g} onCommit={(v) => onField(i, "fats_g", v, id)} /></td>
                <td className="p-1"><button onClick={() => onDelete(i, id)} className="text-red-600 underline">Supprimer</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}