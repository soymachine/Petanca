// Variedad de redacción para las noticias más repetidas de la Hemeroteca:
// sin esto, ciertos titulares (el resultado sin crónica detallada de un
// partido simulado en Modo Debugger, el objetivo semanal, la nómina en
// números rojos...) salían SIEMPRE con la misma frase exacta, edición tras
// edición — cuantas más temporadas se simulan, más cantan de repetidas.
// Cada función elige al azar entre varias plantillas con el mismo
// contenido real, para que el periodista de El Eco de la Peña no suene
// siempre a la misma persona escribiendo la misma frase.
function pick(templates, ctx) {
  return templates[Math.floor(Math.random() * templates.length)](ctx);
}

// resultado de un partido de liga SIN crónica detallada (ver Chronicle.js:
// esto es lo que sale cuando el partido se resolvió en Modo Debugger, sin
// jugarse a mano, así que no hay hechos reales que contar) — el caso más
// frecuente de todos con diferencia, y hasta ahora el más repetitivo
const WIN_TEMPLATES = [
  (c) => `${c.clubName} gana ${c.scoreP}-${c.scoreA} a ${c.oppName} en la liga de ${c.cityName}.`,
  (c) => `Triunfo de ${c.clubName} ante ${c.oppName} (${c.scoreP}-${c.scoreA}) en la jornada de ${c.cityName}.`,
  (c) => `${c.clubName} no falla: ${c.scoreP}-${c.scoreA} a ${c.oppName} y dos puntos más en el saco.`,
  (c) => `Buena tarde en ${c.cityName}: ${c.clubName} doblega a ${c.oppName} por ${c.scoreP}-${c.scoreA}.`,
  (c) => `${c.oppName} se lleva un disgusto: ${c.clubName} se impone ${c.scoreP}-${c.scoreA} en su visita.`,
];
const LOSS_TEMPLATES = [
  (c) => `${c.oppName} se lleva la jornada ${c.scoreA}-${c.scoreP} frente a ${c.clubName}.`,
  (c) => `Tarde para olvidar: ${c.oppName} gana ${c.scoreA}-${c.scoreP} a ${c.clubName}.`,
  (c) => `${c.clubName} se deja la jornada en ${c.cityName}: ${c.scoreA}-${c.scoreP} para ${c.oppName}.`,
  (c) => `No hay manera: ${c.oppName} doblega a ${c.clubName} por ${c.scoreA}-${c.scoreP}.`,
  (c) => `Jornada en contra en ${c.cityName}: ${c.oppName} se impone ${c.scoreA}-${c.scoreP}.`,
];

export function resultLine(won, ctx) { return pick(won ? WIN_TEMPLATES : LOSS_TEMPLATES, ctx); }

const WEEKLY_GOAL_MET = [
  (c) => `OBJETIVO DE LA JUNTA CUMPLIDO: ${c.desc} +${c.reward}€.`,
  (c) => `LA JUNTA APRUEBA: ${c.desc}, tal y como pedía. +${c.reward}€ para las arcas.`,
  (c) => `DEBERES HECHOS: ${c.desc}. La junta paga los ${c.reward}€ prometidos sin rechistar.`,
];
const WEEKLY_GOAL_MISSED = [
  (c) => `La junta no ve cumplido su objetivo semanal (${c.desc}). -${c.penalty}€.`,
  (c) => `OBJETIVO FALLADO: no se cumple lo pedido (${c.desc}). La junta descuenta ${c.penalty}€.`,
  (c) => `La junta tuerce el gesto: ${c.desc} sigue sin cumplirse. -${c.penalty}€ de multa.`,
];

export function weeklyGoalMetLine(desc, reward) { return pick(WEEKLY_GOAL_MET, { desc, reward }); }
export function weeklyGoalMissedLine(desc, penalty) { return pick(WEEKLY_GOAL_MISSED, { desc, penalty }); }

const NOMINA_ROJA = [
  (c) => `Las arcas de ${c.clubName} están en números rojos: la nómina de ${c.upkeep}€ pasa factura a la moral de la peña.`,
  (c) => `CUENTAS AJUSTADAS: ${c.clubName} paga los ${c.upkeep}€ de nómina a duras penas. Se nota en el ambiente del vestuario.`,
  (c) => `${c.clubName} cierra la semana en descubierto tras la nómina de ${c.upkeep}€. La peña masculla por lo bajo.`,
];

export function nominaRojaLine(clubName, upkeep) { return pick(NOMINA_ROJA, { clubName, upkeep }); }

const SPONSOR_CUMPLIDO = [
  (c) => `Patrocinio cumplido: ${c.name} paga ${c.bonus}€.`,
  (c) => `${c.name} cumple lo prometido: ${c.bonus}€ ingresados en la caja del club.`,
  (c) => `BUENAS NOTICIAS DE PATROCINIO: el trato con ${c.name} se cierra con éxito, +${c.bonus}€.`,
];
const SPONSOR_FALLIDO = [
  (c) => `El patrocinio de ${c.name} se acaba sin cumplirse.`,
  (c) => `${c.name} retira su patrocinio sin que se cumplieran las condiciones pactadas.`,
  (c) => `Se acaba el trato con ${c.name} sin premio: no se cumplieron las condiciones.`,
];

export function sponsorCumplidoLine(name, bonus) { return pick(SPONSOR_CUMPLIDO, { name, bonus }); }
export function sponsorFallidoLine(name) { return pick(SPONSOR_FALLIDO, { name }); }

const LEVEL_UP = [
  (c) => `¡${c.name} sube a nivel ${c.level}! ${c.points} puntos por repartir en Mi Peña.`,
  (c) => `${c.name} da un salto de calidad: nivel ${c.level} ya, con ${c.points} puntos nuevos para repartir.`,
  (c) => `LA FORMA SE NOTA: ${c.name} llega a nivel ${c.level} y suma ${c.points} puntos para repartir.`,
];

export function levelUpLine(name, level, points) { return pick(LEVEL_UP, { name, level, points }); }

// firmas de cronista que rotan en la cabecera de El Eco de la Peña (además
// de los dos cronistas con nombre propio de Chronicle.js, que firman la
// crónica detallada de un partido jugado a mano) — puramente de
// presentación, no cambian ni un dato real de la noticia
export const REPORTERS = [
  'Eladio Cifuentes', 'Paco Arenas', 'Sole Bermejo', 'Ricardo Peláez', 'Amparo Solís', 'Toño Cabezas',
];

// una línea corta de "vox populi" bajo el titular, independiente de qué
// haya pasado: puro sabor de bar de pueblo, para que cada edición se note
// distinta aunque el titular de verdad se repita
export const VOX_POPULI = [
  '— Comentan en el bar que esta temporada va a dar que hablar.',
  '— En la barra no se habla de otra cosa esta semana.',
  '— El del quiosco jura que agotó la tirada esta mañana.',
  '— Hasta el cura lo comentó en la homilía del domingo.',
  '— La partida de mus del Casino se paró para leerlo en voz alta.',
  '— Alguien ya lo ha recortado para pegarlo en el corcho del bar.',
  '— Se rumorea que hasta en el pueblo de al lado se ha comentado.',
  '— El cartero lo repartió con una sonrisilla rara esta mañana.',
];
