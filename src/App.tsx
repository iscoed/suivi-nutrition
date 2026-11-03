import Weights from "./components/Weights";
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

const card = "rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100";
const field = "rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";
const btnPrimary = "rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50";
const btnGhost = "text-sm font-medium text-white/90 hover:text-white";

const parseNum = (v: string) => {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

function NumInput({ value, onCommit, className = "w-16" }: { value: number; onCommit: (n: number) => void; className?: string }) {
  return (
    <input
      key={value}
      className={`${className} rounded-lg border border-gray-200 px-2 py-1 text-right text-sm outline-none focus:border-emerald-500`}
      inputMode="decimal"
      defaultValue={String(value)}
      onBlur={(e) => onCommit(parseNum(e.target.value))}
    />
  );
}

const BAR: Record<string, string> = {
  kcal: "bg-emerald-500",
  prot: "bg-sky-500",
  gluc: "bg-amber-500",
  lip: "bg-rose-400",
};

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

  if (session === null) return <p className="p-6 text-gray-500">Chargement…</p>;
  if (!session) return <Auth />;
  if (!loaded) return <p className="p-6 text-gray-500">Chargement de vos données…</p>;

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
    <div className="min-h-screen bg-[#f5f7f4] pb-16 text-gray-800">
      <header className="bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 px-4 pb-16 pt-8 text-white">
        <div className="mx-auto flex max-w-2xl items-start justify-between">
          <div>
            <p className="text-sm text-emerald-100">Bonjour 👋</p>
            <h1 className="text-2xl font-bold">Suivi nutrition</h1>
            <p className="mt-1 text-sm text-emerald-50">
              {profile.weight_kg} kg · objectif {profile.target_weight_kg} kg
              {diffKg > 0 && ` · ${diffKg} kg à perdre`}
              {diffKg < 0 && ` · ${Math.abs(diffKg)} kg à prendre`}
              {diffKg === 0 && " · objectif atteint"}
            </p>
          </div>
          <div className="flex gap-4">
            <button onClick={() => setEditing(true)} className={btnGhost}>Profil</button>
            <button onClick={() => supabase.auth.signOut()} className={btnGhost}>Déconnexion</button>
          </div>
        </div>
      </header>

      <main className="mx-auto -mt-10 max-w-2xl space-y-5 px-4">
        <section className={card}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">Ma journée</h2>
            <input type="date" className={field} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-4">
            <Stat label="Calories" eaten={eaten.calories} goal={goals.calories} unit="kcal" color={BAR.kcal} />
            <Stat label="Protéines" eaten={eaten.proteins} goal={goals.protein_g} unit="g" color={BAR.prot} />
            <Stat label="Glucides" eaten={eaten.carbs} goal={goals.carbs_g} unit="g" color={BAR.gluc} />
            <Stat label="Lipides" eaten={eaten.fats} goal={goals.fat_g} unit="g" color={BAR.lip} />
          </div>
        </section>

        <section className={card}>
          <h2 className="mb-3 font-semibold">Ajouter ce que vous avez mangé</h2>
          <div className="mb-3">
            <select className={field} value={slot} onChange={(e) => setSlot(e.target.value)}>
              {daySlotList.map((s) => (
                <option key={s.key} value={s.key}>{s.label} · {s.time}</option>
              ))}
            </select>
          </div>
          <textarea
            className={`${field} w-full`}
            rows={4}
            placeholder="Ex. 4 œufs, 170 g de riz basmati, un peu d'huile d'olive"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="mt-3 flex items-center gap-3">
            <button onClick={analyze} disabled={loading || !description.trim()} className={btnPrimary}>
              {loading ? "Analyse…" : "Analyser"}
            </button>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        </section>

        {questions.length > 0 && (
          <section className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
            <p className="font-semibold">Précisions demandées</p>
            <ul className="mt-1 list-disc pl-5">{questions.map((q, i) => <li key={i}>{q}</li>)}</ul>
          </section>
        )}

        {pending.length > 0 && (
          <section className={card}>
            <h2 className="mb-3 font-semibold">À vérifier avant d'enregistrer</h2>
            <EntryTable
              rows={pending}
              onName={(i, v) => updatePending(i, { name: v })}
              onQty={(i, v) => rescalePending(i, v)}
              onField={(i, field, v) => updatePending(i, { [field]: v } as Partial<FoodItem>)}
              onDelete={(i) => setPending(pending.filter((_, idx) => idx !== i))}
            />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gray-50 p-3 text-sm">
              <span>
                Total : <b>{Math.round(pendingTotal.calories)} kcal</b> · P {Math.round(pendingTotal.proteins)} g · G {Math.round(pendingTotal.carbs)} g · L {Math.round(pendingTotal.fats)} g
              </span>
              <button onClick={addToJournal} className={btnPrimary}>Ajouter au journal</button>
            </div>
          </section>
        )}

        {lastComment && (
          <section className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900 ring-1 ring-emerald-200">
            <p>{lastComment}</p>
          </section>
        )}

        <Advice slots={slotStatus} remaining={remaining} />

        <section className={card}>
          <h2 className="mb-3 font-semibold">Repas du {date}</h2>
          {dayEntries.length === 0 && <p className="text-sm text-gray-400">Rien d'enregistré pour ce jour.</p>}
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
        <Weights date={date} />
        <Water date={date} profile={profile} />
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
                  <input className="w-full rounded-md border border-transparent px-1 py-0.5 outline-none hover:border-gray-200 focus:border-emerald-500" defaultValue={r.name} onBlur={(e) => onName(i, e.target.value, id)} />
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