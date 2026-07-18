import { hashStr } from '../core/utils.js';

// Los rivales recurrentes (el derbi, el némesis) no tienen guion propio más
// allá del nombre de su capitán — esto les da una "personalidad" fija y
// determinista (siempre la misma para el mismo club) para que se sientan
// como alguien de verdad en vez de un nivel de IA con nombre.
export const RIVAL_TAUNTS = [
  { archetype: 'fanfarrón', line: '"Contra {club} no hay quien pueda. Que se vayan preparando."' },
  { archetype: 'veterano', line: '"Llevamos toda la vida ganando estos duelos. Esto no va a ser diferente."' },
  { archetype: 'cantamañanas', line: '{captain} ya ha dicho en el bar que esto está decidido antes de tirar la primera bola.' },
  { archetype: 'silencioso', line: 'Ni una palabra de {captain}. En {club} dejan que hablen las bolas.' },
  { archetype: 'respetuoso', line: '"Un partido más contra {club}. Con respeto, pero a ganar."' },
  { archetype: 'rencoroso', line: '"{captain} todavía se acuerda de la última vez. Esta se la guardaba."' },
];

export function rivalPersonalityFor(club) {
  const idx = Math.abs(hashStr(club.name)) % RIVAL_TAUNTS.length;
  return RIVAL_TAUNTS[idx];
}

export function rivalPersonalityLine(club) {
  const captain = club.captain;
  const t = rivalPersonalityFor(club);
  return t.line.replace('{captain}', captain ? captain.name : 'su capitán').replace('{club}', club.name);
}
