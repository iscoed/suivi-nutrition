import XLSX from "xlsx";
import { readFileSync, writeFileSync, mkdirSync } from "fs";

const wb = XLSX.read(readFileSync("ciqual.xlsx"), { type: "buffer" });
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
const headers = Object.keys(rows[0] ?? {});

console.log("Colonnes trouvées :");
headers.forEach((h) => console.log(" -", h));

const find = (...words) =>
  headers.find((h) => words.every((w) => h.toLowerCase().includes(w.toLowerCase())));

const nameCol = find("nom", "fr") ?? find("nom");
const kcalCol = find("kcal");
const protCol = find("protéines") ?? find("proteines");
const carbCol = find("glucides");
const fatCol = find("lipides");

if (!nameCol || !kcalCol || !protCol || !carbCol || !fatCol) {
  console.error("Colonnes non reconnues. Copiez la liste ci-dessus et envoyez-la-moi.");
  process.exit(1);
}

const num = (v) => {
  const n = Number(String(v).replace(",", ".").replace(/[^\d.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
};

const foods = rows
  .map((r) => ({
    n: String(r[nameCol]).trim(),
    k: num(r[kcalCol]),
    p: num(r[protCol]),
    c: num(r[carbCol]),
    f: num(r[fatCol]),
  }))
  .filter((x) => x.n && x.k !== null && x.p !== null && x.c !== null && x.f !== null);

mkdirSync("src/data", { recursive: true });
writeFileSync("src/data/foods.json", JSON.stringify(foods));
console.log(`${foods.length} aliments écrits dans src/data/foods.json`);