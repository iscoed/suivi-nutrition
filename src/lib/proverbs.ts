const PROVERBS = [
  "Petit à petit, l'oiseau fait son nid.",
  "Rome ne s'est pas faite en un jour.",
  "Qui veut voyager loin ménage sa monture.",
  "Gouttes d'eau répétées creusent la pierre.",
  "Une bonne habitude vaut mieux qu'un grand effort.",
  "Qui ne risque rien n'a rien.",
  "Vouloir, c'est déjà pouvoir.",
  "La patience est mère de toutes les vertus.",
  "Le frigo ne compte pas les calories : c'est à vous de le faire !",
  "Chaque repas bien choisi est une victoire, même petite.",
];

// Change chaque jour, sans appel à l'IA
export function proverbOfDay(): string {
  const day = Math.floor(Date.now() / 86_400_000);
  return PROVERBS[day % PROVERBS.length];
}