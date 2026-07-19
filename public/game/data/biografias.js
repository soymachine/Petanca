import { chemistryLevel, gamesFor, CHEMISTRY_LEVELS } from '../domain/Chemistry.js';

// Reportaje periódico sobre un abuelo concreto: reutiliza datos que YA se
// trackean por otros sistemas (racha, vínculos, mentorías, herencia,
// veteranía, nivel) para contar QUIÉN es cada uno, no solo qué pasó en el
// último partido — la Hemeroteca, hasta ahora, solo hablaba de resultados
// y cotilleo genérico de liga.
const HIGHLIGHT_PRIORITY = ['racha_larga', 'vinculo', 'mentor', 'pupilo', 'herencia', 'veterania', 'nivel'];

function collectHighlights(p, id) {
  const s = p.roster.get(id);
  const out = [];
  if (s.formStreak >= 4) out.push({ t: 'racha_larga', data: { streak: s.formStreak } });

  let bestBond = null, bestLvl = 0;
  for (const oid of p.roster.ids) {
    if (oid === id) continue;
    const lvl = chemistryLevel(gamesFor(p.chemistry, id, oid));
    if (lvl > bestLvl) { bestLvl = lvl; bestBond = oid; }
  }
  if (bestBond !== null && bestLvl >= 2) out.push({ t: 'vinculo', data: { oid: bestBond, label: CHEMISTRY_LEVELS[bestLvl].label } });

  if (s.mentorOf !== null && p.roster.has(s.mentorOf)) out.push({ t: 'mentor', data: { pupilId: s.mentorOf } });
  const mentorId = p.roster.ids.find((oid) => p.roster.get(oid).mentorOf === id);
  if (mentorId !== undefined) out.push({ t: 'pupilo', data: { mentorId } });

  if (s.legacy.length >= 2) out.push({ t: 'herencia', data: { count: s.legacy.length } });
  if (s.age >= 80) out.push({ t: 'veterania', data: { age: s.age } });
  if (s.level >= 8) out.push({ t: 'nivel', data: { level: s.level } });
  return out;
}

function clause(fact, nameOf) {
  switch (fact.t) {
    case 'racha_larga': return `encadena ${fact.data.streak} victorias seguidas y ya se le nota el paso más firme por el pueblo`;
    case 'vinculo': {
      // el label del nivel máximo ("pareja de leyenda") es un sustantivo,
      // no una frase verbal como el resto ("se conocen del bar"...) — hay
      // que redactarlo aparte para que no quede agramatical
      const label = fact.data.label;
      return label === 'pareja de leyenda'
        ? `forma con ${nameOf(fact.data.oid)} una auténtica pareja de leyenda`
        : `forma con ${nameOf(fact.data.oid)} una pareja que ${label}`;
    }
    case 'mentor': return `anda de mentor de ${nameOf(fact.data.pupilId)}, enseñándole lo que sabe`;
    case 'pupilo': return `sigue aprendiendo de ${nameOf(fact.data.mentorId)} cada semana`;
    case 'herencia': return `es ya la ${fact.data.count + 1}ª generación en ese hueco de la peña`;
    case 'veterania': return `sigue en la brecha a los ${fact.data.age} años, para admiración de todos`;
    case 'nivel': return `ha llegado al nivel ${fact.data.level}, todo un galón en la peña`;
    default: return '';
  }
}

const OPENERS = (name) => [
  `PERFIL DE LA PEÑA: ${name} sigue dando que hablar`,
  `SE HABLA DE ${name.toUpperCase()} EN EL BAR`,
  `RETRATO DE TEMPORADA: quién es ${name} estos días`,
];

// devuelve el titular ya compuesto, o null si nadie de la plantilla tiene
// "material" suficiente esta semana (roster vacío, o nadie destaca en nada)
export function composeBiography(p, nameOf) {
  const candidates = p.roster.ids
    .map((id) => ({ id, highlights: collectHighlights(p, id) }))
    .filter((c) => c.highlights.length > 0);
  if (!candidates.length) return null;
  const chosen = candidates[Math.floor(Math.random() * candidates.length)];
  const picked = HIGHLIGHT_PRIORITY.map((t) => chosen.highlights.find((h) => h.t === t)).filter(Boolean).slice(0, 2);
  if (!picked.length) return null;
  const name = nameOf(chosen.id);
  const openers = OPENERS(name);
  const opener = openers[Math.floor(Math.random() * openers.length)];
  return `${opener} — ${picked.map((f) => clause(f, nameOf)).join(', y ')}.`;
}
