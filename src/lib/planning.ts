export type SlotKey = "breakfast" | "snack1" | "lunch" | "snack2" | "dinner";
export interface Slot { key: SlotKey; label: string; time: string; }

export function daySlots(d: Date = new Date()): Slot[] {
  const n = d.getDay();
  if (n === 0 || n === 6) {
    return [
      { key: "breakfast", label: "Petit-déjeuner", time: "12 h" },
      { key: "snack1", label: "Collation", time: "14 h" },
      { key: "lunch", label: "Déjeuner", time: "17 h – 18 h" },
      { key: "snack2", label: "Collation du soir", time: "20 h" },
    ];
  }
  return [
    { key: "breakfast", label: "Petit-déjeuner", time: "9 h – 9 h 30" },
    { key: "snack1", label: "Collation du matin", time: "11 h" },
    { key: "lunch", label: "Déjeuner", time: "14 h" },
    { key: "snack2", label: "Collation de l'après-midi", time: "17 h 30 – 18 h" },
    { key: "dinner", label: "Dîner (parfois)", time: "20 h" },
  ];
}

export const DINNER_LIMITS = [
  "Riz : 50 g maximum",
  "Poulet : 100 g maximum",
  "Bœuf : 80 g maximum",
  "Poisson : 80 g maximum",
];

export const MIN_KCAL = (sex: "homme" | "femme") => (sex === "homme" ? 1500 : 1200);