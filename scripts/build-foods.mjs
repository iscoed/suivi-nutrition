import XLSX from "xlsx";
import { readFileSync, writeFileSync, mkdirSync } from "fs";

const wb = XLSX.read(readFileSync("ciqual.xlsx"), { type: "buffer" });
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
const headers = Object.keys(rows[0] ?? {});

const find = (...words) =>
  headers.find((h) => words.every((w) => h.toLowerCase().includes(w.toLowerCase())));

// Le nom de l'aliment est "alim_nom_fr" (et non "alim_grp_nom_fr", qui contient les catégories)
const nameCol =
  headers.find((h) => h.toLowerCase() === "alim_nom_fr") ??
  headers.find((h) => /alim_nom/i.test(h) && !/grp|ssgrp/i.test(h));
const kcalCol = find("kcal");
const protCol = find("protéines") ?? find("proteines");
const carbCol = find("glucides");
const fatCol = find("lipides");

console.log("Colonne nom :", nameCol);
console.log("Colonne kcal :", kcalCol);

if (!nameCol || !kcalCol || !protCol || !carbCol || !fatCol) {
  console.error("Colonnes non reconnues. Copiez la liste des colonnes et envoyez-la-moi.");
  console.log(headers);
  process.exit(1);
}

const clean = (s) => String(s).replace(/\s+/g, " ").trim();
const num = (v) => {
  const n = Number(String(v).replace(",", ".").replace(/[^\d.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
};

const foods = rows
  .map((r) => ({
    n: clean(r[nameCol]),
    k: num(r[kcalCol]),
    p: num(r[protCol]),
    c: num(r[carbCol]),
    f: num(r[fatCol]),
  }))
  .filter((x) => x.n && x.k !== null && x.p !== null && x.c !== null && x.f !== null);

mkdirSync("src/data", { recursive: true });
writeFileSync("src/data/foods.json", JSON.stringify(foods));
console.log(`${foods.length} aliments écrits dans src/data/foods.json`);