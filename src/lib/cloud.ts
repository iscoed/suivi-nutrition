import { supabase } from "./supabase";
import type { Profile } from "./profile";
import type { Entry } from "./journal";

export async function getUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function loadCloudProfile(): Promise<Profile | null> {
  const uid = await getUserId();
  if (!uid) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
  if (!data) return null;
  return {
    first_name: data.first_name ?? undefined,
    sex: data.sex,
    age: data.age,
    height_cm: Number(data.height_cm),
    weight_kg: Number(data.weight_kg),
    target_weight_kg: Number(data.target_weight_kg),
    goal: data.goal,
    activity: Number(data.activity),
  } as Profile;
}

export async function saveCloudProfile(p: Profile) {
  const uid = await getUserId();
  if (!uid) throw new Error("Non connecté");
  const { error } = await supabase.from("profiles").upsert({ id: uid, ...p, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function loadCloudEntries(): Promise<Entry[]> {
  const uid = await getUserId();
  if (!uid) return [];
  const { data, error } = await supabase.from("entries").select("*").eq("user_id", uid);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    date: r.date,
    name: r.name,
    quantity_g: Number(r.quantity_g),
    calories: Number(r.calories),
    proteins_g: Number(r.proteins_g),
    carbs_g: Number(r.carbs_g),
    fats_g: Number(r.fats_g),
    confidence: r.confidence ?? "low",
    assumption: r.assumption ?? "",
    slot: r.slot ?? undefined,
  })) as Entry[];
}

export async function insertCloudEntries(list: Entry[]) {
  const uid = await getUserId();
  if (!uid) throw new Error("Non connecté");
  const rows = list.map((e) => ({ ...e, user_id: uid }));
  const { error } = await supabase.from("entries").insert(rows);
  if (error) throw error;
}

export async function updateCloudEntry(id: string, patch: Partial<Entry>) {
  const { error } = await supabase.from("entries").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteCloudEntry(id: string) {
  const { error } = await supabase.from("entries").delete().eq("id", id);
  if (error) throw error;
}