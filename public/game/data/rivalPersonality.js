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

// pullas que ya no hablan de SU propio club, sino de la fama que te has
// labrado tú a base de ruedas de prensa (ver Player.publicImage) — solo
// entran en juego pasados los ±25 puntos, cuando esa fama ya es de sobra
// conocida en el circuito
const IMAGE_TAUNTS_BRAVO = [
  '"Menuda fama de bocazas tiene el mánager de enfrente. A ver si esta vez calla la boca en la pista."',
  '{captain} sonríe: "Con lo que promete siempre, cualquier día le toca tragarse sus palabras."',
  '"Aquí no nos achantamos con fanfarronadas ajenas. Que hable la pista, como siempre."',
];
const IMAGE_TAUNTS_HUMBLE = [
  '"El de enfrente nunca se moja. Prudente, o que no las tiene todas consigo."',
  '{captain} se lo toma con calma: "Ni promete ni amenaza. Bueno, pues que hable la pista."',
  '"Tanta cautela no engaña a nadie: sabemos que quieren ganar igual que todos."',
];

export function rivalPersonalityFor(club) {
  const idx = Math.abs(hashStr(club.name)) % RIVAL_TAUNTS.length;
  return RIVAL_TAUNTS[idx];
}

export function rivalPersonalityLine(club, publicImage = 0) {
  const captain = club.captain;
  let line;
  if (publicImage >= 25) {
    line = IMAGE_TAUNTS_BRAVO[Math.abs(hashStr(club.name + 'bravo')) % IMAGE_TAUNTS_BRAVO.length];
  } else if (publicImage <= -25) {
    line = IMAGE_TAUNTS_HUMBLE[Math.abs(hashStr(club.name + 'humble')) % IMAGE_TAUNTS_HUMBLE.length];
  } else {
    line = rivalPersonalityFor(club).line;
  }
  return line.replace('{captain}', captain ? captain.name : 'su capitán').replace('{club}', club.name);
}
