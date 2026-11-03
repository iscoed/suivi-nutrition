import { useEffect, useState } from "react";
import { addWater, loadWater, waterGoalMl } from "../lib/water";
import type { Profile } from "../lib/profile";

interface Props {
  date: string;
  profile: Profile;
  remaining: { calories: number; proteins_g: number; carbs_g: number; fats_g: number };
}

export default function Summary({ date, profile, remaining }: Props) {
  const goal = waterGoalMl(profile);
  const [water, setWater] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadWater(date).then(setWater).catch((e) => setError((e as Error).message));
  }, [date]);

  async function drink(ml: number) {
    try {
      await addWater(date, ml);
      setWater((w) => w + ml);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const waterLeft = Math.max(0, goal - water);
  const waterComment =
    water >= goal
      ? "Objectif d'eau atteint, bravo !"
      : water >= goal * 0.5
      ? `Déjà la moitié, encore ${waterLeft} ml. Un verre à chaque pause.`
      : `Il reste ${waterLeft} ml. Commencez par un grand verre d'eau.`;

  return (
    <section className="space-y-3 rounded border p-3">
      <h2 className="font-semibold">Eau</h2>
      <div className="flex items-center justify-between text-sm">
        <span><b>{water}</b> / {goal} ml</span>
        <div className="flex gap-2">
          <button onClick={() => drink(250)} className="rounded border px-3 py-1">+250 ml</button>
          <button onClick={() => drink(500)} className="rounded border px-3 py-1">+500 ml</button>
        </div>
      </div>
      <p className="text-sm text-gray-700">{waterComment}</p>

      <h2 className="pt-2 font-semibold">Bilan de la journée</h2>
      <p className="text-sm">
        Il reste : <b>{remaining.calories} kcal</b> · P {remaining.proteins_g} g · G {remaining.carbs_g} g · L {remaining.fats_g} g
      </p>
      {remaining.proteins_g > 0 && (
        <p className="text-sm text-gray-700">
          Pour compléter les protéines : 200 g de poulet cuit, ou 4 œufs + 150 g de fromage blanc.
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </section>
  );
}