import { useState, type FormEvent } from "react";
import type { Activity, Goal, Profile, Sex } from "../lib/profile";

interface Props {
  initial?: Profile;
  onDone: (p: Profile) => void;
}

const field = "w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";
const label = "mb-1.5 block text-sm font-medium text-gray-700";

export default function Onboarding({ initial, onDone }: Props) {
  const [sex, setSex] = useState<Sex>(initial?.sex ?? "homme");
  const [age, setAge] = useState(String(initial?.age ?? ""));
  const [height, setHeight] = useState(String(initial?.height_cm ?? ""));
  const [weight, setWeight] = useState(String(initial?.weight_kg ?? ""));
  const [target, setTarget] = useState(String(initial?.target_weight_kg ?? ""));
  const [goal, setGoal] = useState<Goal>(initial?.goal ?? "maintenir");
  const [activity, setActivity] = useState<Activity>(initial?.activity ?? 1.375);
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    const a = Number(age), h = Number(height), w = Number(weight), t = Number(target);
    if (a < 14 || a > 100) return setError("L'âge doit être entre 14 et 100 ans.");
    if (h < 120 || h > 230) return setError("La taille doit être entre 120 et 230 cm.");
    if (w < 30 || w > 300) return setError("Le poids actuel doit être entre 30 et 300 kg.");
    if (t < 30 || t > 300) return setError("Le poids cible doit être entre 30 et 300 kg.");
    setError(null);
    onDone({ sex, age: a, height_cm: h, weight_kg: w, target_weight_kg: t, goal, activity });
  }

  return (
    <div className="min-h-screen bg-[#f5f7f4] p-4 pb-16">
      <form onSubmit={submit} className="mx-auto max-w-md space-y-5 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Votre profil</h1>
          <p className="mt-1 text-sm text-gray-500">Ces informations servent à estimer vos besoins. Vous pourrez les modifier à tout moment.</p>
        </div>

        <div>
          <span className={label}>Sexe</span>
          <div className="grid grid-cols-2 gap-3">
            {(["homme", "femme"] as Sex[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSex(s)}
                className={`rounded-xl border px-4 py-3 text-sm font-medium capitalize transition ${
                  sex === s ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <span className={label}>Âge</span>
            <input className={field} type="number" value={age} onChange={(e) => setAge(e.target.value)} required />
          </div>
          <div>
            <span className={label}>Taille (cm)</span>
            <input className={field} type="number" value={height} onChange={(e) => setHeight(e.target.value)} required />
          </div>
          <div>
            <span className={label}>Poids (kg)</span>
            <input className={field} type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} required />
          </div>
        </div>

        <div>
          <span className={label}>Poids cible (kg)</span>
          <input className={field} type="number" step="0.1" value={target} onChange={(e) => setTarget(e.target.value)} required />
        </div>

        <div>
          <span className={label}>Objectif</span>
          <select className={field} value={goal} onChange={(e) => setGoal(e.target.value as Goal)}>
            <option value="perdre">Perdre du poids</option>
            <option value="maintenir">Maintenir mon poids</option>
            <option value="prendre">Prendre du poids</option>
          </select>
        </div>

        <div>
          <span className={label}>Activité quotidienne</span>
          <select className={field} value={activity} onChange={(e) => setActivity(Number(e.target.value) as Activity)}>
            <option value={1.2}>Sédentaire (bureau, peu de sport)</option>
            <option value={1.375}>Légère (sport 1 à 3 fois par semaine)</option>
            <option value={1.55}>Modérée (sport 3 à 5 fois par semaine)</option>
            <option value={1.725}>Intense (sport presque tous les jours)</option>
          </select>
        </div>

        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>}

        <button type="submit" className="w-full rounded-full bg-emerald-600 py-3 font-medium text-white shadow-sm transition hover:bg-emerald-700">
          Enregistrer mon profil
        </button>
      </form>
    </div>
  );
}