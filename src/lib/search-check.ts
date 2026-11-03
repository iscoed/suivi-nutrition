import { searchFood } from "./search";

const words = ["oeuf", "riz", "poulet", "lait", "pain", "banane", "pomme", "saumon", "yaourt", "huile d'olive", "amandes"];

for (const w of words) {
  console.log(`${w} → ${searchFood(w)?.n ?? "AUCUN RÉSULTAT"}`);
}