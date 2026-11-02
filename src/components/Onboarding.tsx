import { useState } from "react";
import type { Activity, Goal, Profile, Sex } from "../lib/profile";

interface Props {
  initial?: Profile;
  onDone: (p: Profile) => void;
}

const field = "w-full rounded border p-2";

export default function Onboarding({ initial, onDone }: Props) {
  const [sex, setSex] = useState<Sex>(initial?.sex ?? "homme");
  const [age, setAge] = useState(String(initial?.age ?? ""));
  const [height, setHeight] = useState(String(initial?.height_cm ?? ""));
  const [weight, setWeight] = useState(String(initial?.weight_kg ?? ""));
  const [goal, setGoal] = useState<Goal>(initial?.goal ?? "maintenir");
  const [activity, setActivity] = useState<Activity>(initial?.activity ?? 1.375);
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const a = Number(age), h = Number(height), w = Number(weight);
    if (a < 14 || a > 100) return setError("L'âge doit être entre 14 et 100 ans.");
    if (h < 120 || h > 230) return setError("La taille doit être entre 120 et 230 cm.");
    if (w < 30 || w > 300) return setError("Le poids doit être entre 30 et 300 kg.");
    setError(null);
    onDone({ sex, age: a, height_cm: h, weight_kg: w, goal, activity });
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-md space-y-4 p-4">
      <h1 className="text-2xl font-bold">Votre profil</h1>
      <p className="text-sm text-gray-600">Ces informations servent à estimer vos besoins. Vous pourrez les modifier.</p>

      <div>
        <p className="mb-1 font-semibold">Sexe</p>
        <div className="flex gap-4">
          <label><input type="radio" checked={sex === "homme"} onChange={() => setSex("homme")} /> Homme</label>
          <label><input type="radio" checked={sex === "femme"} onChange={() => setSex("femme")} /> Femme</label>
        </div>
      </div>

      <div><p className="mb-1 font-semibold">Âge (ans)</p>
        <input className={field} type="number" value={age} onChange={(e) => setAge(e.target.value)} required /></div>

      <div><p className="mb-1 font-semibold">Taille (cm)</p>
        <input className={field} type="number" value={height} onChange={(e) => setHeight(e.target.value)} required /></div>

      <div><p className="mb-1 font-semibold">Poids actuel (kg)</p>
        <input className={field} type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} required /></div>

      <div><p className="mb-1 font-semibold">Objectif</p>
        <select className={field} value={goal} onChange={(e) => setGoal(e.target.value as Goal)}>
          <option value="perdre">Perdre du poids</option>
          <option value="maintenir">Maintenir mon poids</option>
          <option value="prendre">Prendre du poids</option>
        </select></div>

      <div><p className="mb-1 font-semibold">Activité quotidienne</p>
        <select className={field} value={activity} onChange={(e) => setActivity(Number(e.target.value) as Activity)}>
          <option value={1.2}>Sédentaire (bureau, peu de sport)</option>
          <option value={1.375}>Légère (sport 1 à 3 fois par semaine)</option>
          <option value={1.55}>Modérée (sport 3 à 5 fois par semaine)</option>
          <option value={1.725}>Intense (sport presque tous les jours)</option>
        </select></div>

      {error && <p className="text-red-600">{error}</p>}

      <button type="submit" className="w-full rounded bg-green-600 px-4 py-2 text-white">
        Enregistrer mon profil
      </button>
    </form>
  );
}