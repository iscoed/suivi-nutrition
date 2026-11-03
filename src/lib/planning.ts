export type Slot = { label: string; time: string; kind: "breakfast" | "snack" | "lunch" | "dinner" };

export function isWeekend(date: Date = new Date()): boolean {
  const d = date.getDay();
  return d === 0 || d === 6;
}

export function daySlots(date: Date = new Date()): Slot[] {
  if (isWeekend(date)) {
    return [
      { label: "Petit-déjeuner", time: "12 h", kind: "breakfast" },
      { label: "Collation", time: "14 h", kind: "snack" },
      { label: "Déjeuner", time: "17 h – 18 h", kind: "lunch" },
      { label: "Collation", time: "20 h", kind: "snack" },
    ];
  }
  return [
    { label: "Petit-déjeuner", time: "9 h – 9 h 30", kind: "breakfast" },
    { label: "Collation", time: "11 h", kind: "snack" },
    { label: "Déjeuner", time: "14 h", kind: "lunch" },
    { label: "Collation", time: "17 h 30 – 18 h", kind: "snack" },
    { label: "Dîner (parfois)", time: "20 h", kind: "dinner" },
  ];
}

// Règles de portions imposées au dîner
export const DINNER_LIMITS = [
  "Riz : 50 g maximum",
  "Poulet : 100 g maximum",
  "Bœuf : 80 g maximum",
  "Poisson : 80 g maximum",
];

// Seuil minimal sous lequel l'application ne propose plus de restriction
export const MIN_KCAL = (sex: "homme" | "femme") => (sex === "homme" ? 1500 : 1200);