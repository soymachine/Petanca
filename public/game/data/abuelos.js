import { clamp } from '../core/utils.js';

// Datos base de los 10 abuelos fichables. stats 1..10; clima: -1 le afecta
// doble, 0 normal, +1 inmune. El índice de este array es el "id" del abuelo
// en todo el juego (roster, FACES, RIVAL_FACES no comparten índice).
export const ABUELO_DATA = [
  { price: 0, stats: { pulso: 7, brazo: 5, mana: 6, temple: 6, aguante: 6 },
    trait: 'Capitán fundador: su moral nunca baja de cero.',
    clima: { LLUVIA: 0, VIENTO: 0, CALOR: 0, NIEBLA: 0, HELADA: 0, TORMENTA: 0 } },
  { price: 250, stats: { pulso: 9, brazo: 3, mana: 4, temple: 5, aguante: 5 },
    trait: 'Ojo de lince: su guía de tiro es larguísima. Con lluvia se le empañan las gafas, y sin ver el boliche en la niebla su punto fuerte no vale de nada.',
    clima: { LLUVIA: -1, VIENTO: 0, CALOR: 0, NIEBLA: -1, HELADA: 0, TORMENTA: -1 } },
  { price: 300, stats: { pulso: 5, brazo: 6, mana: 5, temple: 7, aguante: 7 },
    trait: 'Siesta sagrada: empieza cada torneo con la stamina al máximo. El sombrero le salva del sol, pero el frío de una helada le entumece los huesos.',
    clima: { LLUVIA: 0, VIENTO: 0, CALOR: 1, NIEBLA: 0, HELADA: -1, TORMENTA: 0 } },
  { price: 450, stats: { pulso: 4, brazo: 9, mana: 3, temple: 6, aguante: 6 },
    trait: 'Brazo de mula: potencia descomunal, pero el calor le funde. El frío no le quita fuerza al brazo.',
    clima: { LLUVIA: 0, VIENTO: 0, CALOR: -1, NIEBLA: 0, HELADA: 1, TORMENTA: 0 } },
  { price: 350, stats: { pulso: 6, brazo: 5, mana: 7, temple: 4, aguante: 6 },
    trait: 'Presumido: la moral le sube y le baja el doble. El viento le despeina, y una tormenta le deja hecho un cristo.',
    clima: { LLUVIA: 0, VIENTO: -1, CALOR: 0, NIEBLA: 0, HELADA: 0, TORMENTA: -1 } },
  { price: 500, stats: { pulso: 5, brazo: 7, mana: 4, temple: 8, aguante: 5 },
    trait: 'Nervios de acero: la presión del marcador no le afecta jamás, ni tirar a ciegas con niebla cerrada.',
    clima: { LLUVIA: 0, VIENTO: 0, CALOR: 0, NIEBLA: 1, HELADA: 0, TORMENTA: 0 } },
  { price: 400, stats: { pulso: 6, brazo: 4, mana: 8, temple: 7, aguante: 4 },
    trait: 'Manos de santo: efecto máximo. La barba le da un calor terrible.',
    clima: { LLUVIA: 0, VIENTO: 0, CALOR: -1, NIEBLA: 0, HELADA: 0, TORMENTA: 0 } },
  { price: 550, stats: { pulso: 7, brazo: 4, mana: 6, temple: 6, aguante: 5 },
    trait: 'Lee el viento en el humo de su pipa: el vendaval no le mueve la bola, y se guía casi sin ver, aunque la lluvia se la apaga y una tormenta es demasiado hasta para él.',
    clima: { LLUVIA: -1, VIENTO: 1, CALOR: 0, NIEBLA: 1, HELADA: 0, TORMENTA: -1 } },
  { price: 600, stats: { pulso: 6, brazo: 6, mana: 5, temple: 9, aguante: 7 },
    trait: 'Supersticioso: si gana la primera mano, se crece (+pulso el resto de la partida). Cuanto peor el temporal, más se crece.',
    clima: { LLUVIA: 1, VIENTO: 0, CALOR: 0, NIEBLA: 0, HELADA: 0, TORMENTA: 1 } },
  { price: 700, stats: { pulso: 8, brazo: 6, mana: 6, temple: 3, aguante: 5 },
    trait: 'Chulería: se agranda en las finales y se aburre en los cuartos. Las gafas de sol no son postureo, pero sin público que le vea entre la niebla se le baja el ánimo.',
    clima: { LLUVIA: 0, VIENTO: 0, CALOR: 1, NIEBLA: -1, HELADA: 0, TORMENTA: 0 } },
];

export const RETIRE_AT = 8; // partidas jugadas para poder retirarse con honores

export const STAT_KEYS = ['pulso', 'brazo', 'mana', 'temple', 'aguante'];
export const STAT_LABEL = { pulso: 'Pulso', brazo: 'Brazo', mana: 'Maña', temple: 'Temple', aguante: 'Aguante' };

// stats de partida del capitán fundador (id 0), a la altura de la liga
// donde arranca la partida (ver Player constructor / TitleScreen
// _confirmCountryAndCity) — antes eran siempre las mismas fijas de
// ABUELO_DATA[0], sin mirar dónde empezabas: en una liga baja quedaba de
// serie muy por encima de la media rival (subir de categoría sin tocar sus
// stats era demasiado fácil) y en una liga alta, muy por debajo. Se
// desplaza cada stat manteniendo su forma relativa (el pulso sigue siendo
// su punto fuerte) y con el mismo ruido (±2) que usa RivalPlayer.generate,
// para que el fundador arranque "parecido" a cualquier otro jugador de esa
// liga en concreto, ni más ni menos.
export function founderStatsForLevel(effLevel) {
  const base = ABUELO_DATA[0].stats;
  const baseAvg = STAT_KEYS.reduce((sum, k) => sum + base[k], 0) / STAT_KEYS.length;
  const shift = effLevel - baseAvg;
  const out = {};
  for (const k of STAT_KEYS) out[k] = clamp(Math.round(base[k] + shift + (Math.random() - 0.5) * 4), 1, 10);
  return out;
}
