// Compenetración de parejas: cuántos partidos han jugado juntos dos abuelos
// (ver Player.chemistry, Career.trackChemistry) y qué efecto da eso en
// pista (ThrowProfile.compute) y en textos (Mi Peña, noticias). Reverso
// positivo del roce de Roster.applyRivalryJealousy.
export const CHEMISTRY_LEVELS = [
  { min: 0, label: null, shakeMult: 1 },
  { min: 5, label: 'se conocen del bar', shakeMult: 0.97 },
  { min: 12, label: 'se entienden con la mirada', shakeMult: 0.94 },
  { min: 25, label: 'pareja de leyenda', shakeMult: 0.90 },
];

export function chemistryKey(a, b) { return a < b ? `${a}-${b}` : `${b}-${a}`; }

export function gamesFor(chemistry, a, b) { return (chemistry || {})[chemistryKey(a, b)] || 0; }

export function chemistryLevel(games) {
  let lvl = 0;
  for (let i = CHEMISTRY_LEVELS.length - 1; i >= 0; i--) {
    if (games >= CHEMISTRY_LEVELS[i].min) { lvl = i; break; }
  }
  return lvl;
}

// el vínculo más fuerte de `id` con cualquier otro miembro alineado en
// `team` — un solo abuelo puede tener varios compañeros, pero el bonus de
// tiro no se acumula: se queda con el mejor para no descontrolar el balance
export function bestBondMultiplier(chemistry, id, team) {
  let bestLevel = 0;
  for (const other of team) {
    if (other === id) continue;
    const lvl = chemistryLevel(gamesFor(chemistry, id, other));
    if (lvl > bestLevel) bestLevel = lvl;
  }
  return CHEMISTRY_LEVELS[bestLevel].shakeMult;
}

export function bondLabel(chemistry, a, b) {
  return CHEMISTRY_LEVELS[chemistryLevel(gamesFor(chemistry, a, b))].label;
}

// se llama cuando un hueco se releva (retiro o fallecimiento): el nieto no
// hereda la compenetración de su abuelo, así que se borra cualquier vínculo
// que tuviera con el resto de la plantilla. Devuelve true si alguno de los
// vínculos borrados era ya "pareja de leyenda" — para poder anunciarlo.
export function resetChemistryFor(player, id) {
  let hadLegend = false;
  const legendLevel = CHEMISTRY_LEVELS.length - 1;
  for (const key of Object.keys(player.chemistry)) {
    const [a, b] = key.split('-').map(Number);
    if (a !== id && b !== id) continue;
    if (chemistryLevel(player.chemistry[key]) >= legendLevel) hadLegend = true;
    delete player.chemistry[key];
  }
  return hadLegend;
}
