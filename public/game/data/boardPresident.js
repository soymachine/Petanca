import { hashStr } from '../core/utils.js';

// La junta directiva, hasta ahora, era una entidad anónima ("LA JUNTA...")
// pese a ser uno de los sistemas más punitivos del juego (confianza,
// ultimátums, crisis, descenso forzoso). Le damos nombre y una personalidad
// fija — determinista por nombre de club, mismo truco que ya usan
// rivalPersonality.js y rivalArchetypes.js — para que cada ultimátum sea
// de una persona concreta a la que complacer o fastidiar, no un medidor.
const PRESIDENTS = [
  { name: 'Don Anselmo Castañeda', g: 'o' },
  { name: 'Don Baldomero Ruiz', g: 'o' },
  { name: 'Doña Encarna Villaverde', g: 'a' },
  { name: 'Don Ceferino Prado', g: 'o' },
  { name: 'Doña Remedios Alcázar', g: 'a' },
  { name: 'Don Eustaquio Bermejo', g: 'o' },
  { name: 'Doña Presentación Ochoa', g: 'a' },
  { name: 'Don Hilario Somoza', g: 'o' },
  { name: 'Doña Asunción Peláez', g: 'a' },
  { name: 'Don Wenceslao Iríbar', g: 'o' },
];

// exigente: solo mira resultados; paternalista: perdona más pero se lo
// toma personal; ambicioso: quiere ascender ya; tacaño: todo lo mide en
// dinero. Colorea el tono de los mensajes de la junta (ver Career.js).
const ARCHETYPES = ['exigente', 'paternalista', 'ambicioso', 'tacaño'];

const ULTIMATUM_TONE = {
  exigente: 'no se anda con rodeos: exige resultados ya, cueste lo que cueste',
  paternalista: 'lo dice casi dolido, como quien no esperaba esto de la peña',
  ambicioso: 'no piensa quedarse de brazos cruzados: quiere subir de categoría, no explicaciones',
  tacaño: 'lo primero que mira es la cuenta de resultados, y no le gusta lo que ve',
};

// determinista por nombre de club: el mismo presidente (y la misma
// personalidad) toda la carrera, sin necesidad de persistir nada nuevo
export function boardPresidentFor(clubName) {
  const pick = PRESIDENTS[Math.abs(hashStr(`pres-${clubName}`)) % PRESIDENTS.length];
  const archetype = ARCHETYPES[Math.abs(hashStr(`pres-arch-${clubName}`)) % ARCHETYPES.length];
  return { name: pick.name, g: pick.g, archetype, tone: ULTIMATUM_TONE[archetype] };
}

// adjetivo de acuerdo (contento/contenta...) según el género del
// presidente, para poder personalizar frases sin líos de concordancia
export function boardAdj(president, masc, fem) { return president.g === 'a' ? fem : masc; }
