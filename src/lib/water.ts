import { supabase } from "./supabase";
import type { Profile } from "./profile";

export interface WaterEntry { id: string; ml: number; }

// Environ 35 ml par kilo, arrondi à 50 ml
export function waterGoalMl(p: Profile): number {
  return Math.round((p.weight_kg * 35) / 50) * 50;
}

async function userId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Non connecté");
  return data.user.id;
}

export async function addWater(date: string, ml: number) {
  const uid = await userId();
  const { error } = await supabase.from("water").insert({ id: crypto.randomUUID(), user_id: uid, date, ml });
  if (error) throw error;
}

export async function loadWaterEntries(date: string): Promise<WaterEntry[]> {
  const { data, error } = await supabase.from("water").select("id, ml").eq("date", date).order("created_at");
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id as string, ml: Number(r.ml) }));
}

export async function updateWater(id: string, ml: number) {
  const { error } = await supabase.from("water").update({ ml }).eq("id", id);
  if (error) throw error;
}

export async function deleteWater(id: string) {
  const { error } = await supabase.from("water").delete().eq("id", id);
  if (error) throw error;
}