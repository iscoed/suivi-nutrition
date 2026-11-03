import { supabase } from "./supabase";

export interface WeightPoint { date: string; kg: number }

async function userId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Non connecté");
  return data.user.id;
}

export async function saveWeight(date: string, kg: number) {
  const uid = await userId();
  const { error } = await supabase
    .from("weights")
    .upsert({ id: `${uid}:${date}`, user_id: uid, date, kg }, { onConflict: "user_id,date" });
  if (error) throw error;
}

export async function loadWeights(): Promise<WeightPoint[]> {
  const { data, error } = await supabase
    .from("weights")
    .select("date, kg")
    .order("date", { ascending: true })
    .limit(60);
  if (error) throw error;
  return (data ?? []).map((r) => ({ date: r.date as string, kg: Number(r.kg) }));
}

// Moyenne sur les 7 dernières pesées : lisse les variations d'un jour
export function movingAverage(points: WeightPoint[], window = 7): number | null {
  if (points.length === 0) return null;
  const last = points.slice(-window);
  return Math.round((last.reduce((s, p) => s + p.kg, 0) / last.length) * 10) / 10;
}