import { supabase } from "./supabase";
import type { Profile } from "./profile";

// Objectif d'eau : environ 35 ml par kilo, ajusté selon l'objectif
export function waterGoalMl(p: Profile): number {
  const base = p.weight_kg * 35;
  const extra = p.goal === "perdre" ? 0 : 0;
  return Math.round((base + extra) / 50) * 50;
}

export async function addWater(date: string, ml: number) {
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;
  if (!uid) throw new Error("Non connecté");
  const { error } = await supabase.from("water").insert({
    id: crypto.randomUUID(),
    user_id: uid,
    date,
    ml,
  });
  if (error) throw error;
}

export async function loadWater(date: string): Promise<number> {
  const { data, error } = await supabase.from("water").select("ml").eq("date", date);
  if (error) throw error;
  return (data ?? []).reduce((sum, r) => sum + Number(r.ml), 0);
}