import type { Confidence } from "./types";

export interface Entry {
  id: string;
  date: string; // AAAA-MM-JJ
  name: string;
  quantity_g: number;
  calories: number;
  proteins_g: number;
  carbs_g: number;
  fats_g: number;
  confidence: Confidence;
  assumption: string;
}

const KEY = "suivi-nutrition-journal";

export function todayKey(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function loadEntries(): Entry[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Entry[]) : [];
  } catch {
    return [];
  }
}

function save(list: Entry[]): Entry[] {
  localStorage.setItem(KEY, JSON.stringify(list));
  return list;
}

export function addEntries(list: Entry[]): Entry[] {
  return save([...loadEntries(), ...list]);
}

export function updateEntry(id: string, patch: Partial<Entry>): Entry[] {
  return save(loadEntries().map((e) => (e.id === id ? { ...e, ...patch } : e)));
}

export function deleteEntry(id: string): Entry[] {
  return save(loadEntries().filter((e) => e.id !== id));
}

// Recalcule les valeurs proportionnellement quand la quantité change
export function rescale<T extends { quantity_g: number; calories: number; proteins_g: number; carbs_g: number; fats_g: number }>(
  item: T,
  newQty: number
): T {
  if (item.quantity_g <= 0) return { ...item, quantity_g: newQty };
  const f = newQty / item.quantity_g;
  const r1 = (v: number) => Math.round(v * f * 10) / 10;
  return {
    ...item,
    quantity_g: newQty,
    calories: Math.round(item.calories * f),
    proteins_g: r1(item.proteins_g),
    carbs_g: r1(item.carbs_g),
    fats_g: r1(item.fats_g),
  };
}

export function totals(list: Entry[]) {
  return list.reduce(
    (a, e) => ({
      calories: a.calories + e.calories,
      proteins: a.proteins + e.proteins_g,
      carbs: a.carbs + e.carbs_g,
      fats: a.fats + e.fats_g,
    }),
    { calories: 0, proteins: 0, carbs: 0, fats: 0 }
  );
}