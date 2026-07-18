import { rnd } from '../core/utils.js';

const EVENTS = [
  { text: '{n} tiene revisión médica el día del torneo: no podrá jugar esta vez.', unavailable: true },
  { text: '{n} se casa un sobrino ese fin de semana: llega justo y algo espeso (-15 STA).', staPenalty: 15 },
  { text: 'Es el cumpleaños de {n}: viene animado del homenaje (+10 moral).', moralBonus: 10 },
  { text: '{n} tiene boda de pueblo la víspera: trasnochó de más (-10 STA).', staPenalty: 10 },
  { text: '{n} se ha ido de viaje del IMSERSO a la costa: no vuelve a tiempo para el torneo.', unavailable: true },
  { text: '{n} se lió anoche en una partida de dominó hasta las tantas (-12 STA).', staPenalty: 12 },
  { text: 'Se le ha resentido la artrosis a {n} con la humedad (-15 STA).', staPenalty: 15 },
  { text: '{n} anda con lumbago desde que cargó una garrafa: le cuesta agacharse (-14 STA).', staPenalty: 14 },
  { text: 'A {n} le ha dado un pinchazo de ciática esta semana (-18 STA).', staPenalty: 18 },
  { text: 'A {n} le falla la rodilla últimamente, pero no piensa perderse el torneo (-10 STA).', staPenalty: 10 },
  { text: 'Al médico no le ha gustado la tensión de {n} y le ha mandado reposo: no juega este torneo.', unavailable: true },
  { text: '{n} ha pillado un catarro de traca y no calienta de gusto (-10 STA).', staPenalty: 10 },
  { text: '{n} se ha echado novia en el hogar del jubilado: anda que no sonríe (+8 moral).', moralBonus: 8 },
  { text: 'A {n} le han dado el premio al socio del año en el hogar del jubilado (+12 moral).', moralBonus: 12 },
];

// Lesiones de verdad: a diferencia de los EVENTS de arriba (que solo tocan
// al partido de esta semana), estas dejan al abuelo de baja varios días —
// no puede ni entrenar ni jugar hasta que pase la convalecencia.
const INJURIES = [
  { text: '{n} se ha torcido el tobillo subiendo al coche.', min: 4, max: 8 },
  { text: 'A {n} le ha jugado una mala pasada la espalda cargando las bolas.', min: 5, max: 10 },
  { text: '{n} se ha resentido de una rodilla tras un mal gesto en el arrime.', min: 6, max: 12 },
  { text: 'A {n} le ha dado un tirón en el hombro del brazo de tirar.', min: 3, max: 7 },
  { text: '{n} se ha caído en el descampado y se ha hecho daño en la muñeca.', min: 4, max: 9 },
];

// Calendario de imprevistos: antes de cada torneo, con cierta probabilidad
// un abuelo concreto tiene un contratiempo (o una alegría) que gestionar.
export class Calendar {
  // roster: array de ids disponibles; devuelve el evento (o null) ya resuelto
  // chanceMultiplier: el botiquín del descampado la reduce (ver FacilityManager)
  rollEvent(roster, nameOf, chanceMultiplier = 1) {
    if (!roster.length || Math.random() > 0.22 * chanceMultiplier) return null;
    const id = roster[Math.floor(rnd(0, roster.length))];
    const ev = EVENTS[Math.floor(rnd(0, EVENTS.length))];
    return { id, text: ev.text.replace('{n}', nameOf(id)), unavailable: !!ev.unavailable,
             staPenalty: ev.staPenalty || 0, moralBonus: ev.moralBonus || 0 };
  }

  // lesión de varios días: probabilidad baja e independiente de rollEvent,
  // solo afecta a quien no esté ya de baja
  rollInjury(roster, getState, currentDay, nameOf, chanceMultiplier = 1) {
    const sanos = roster.filter((id) => !getState(id).isInjured(currentDay));
    if (!sanos.length || Math.random() > 0.05 * chanceMultiplier) return null;
    const id = sanos[Math.floor(rnd(0, sanos.length))];
    const inj = INJURIES[Math.floor(rnd(0, INJURIES.length))];
    const days = Math.round(rnd(inj.min, inj.max));
    getState(id).injuredUntil = currentDay + days;
    return { id, text: `${inj.text.replace('{n}', nameOf(id))} Estará de baja ${days} días.`, days };
  }

  // ¿fallece algún abuelo esta ronda de comprobación? La probabilidad de
  // cada uno depende de su edad (ver AbueloState.deathChance). Se revisa a
  // toda la plantilla; como mucho ocurre una vez.
  rollDeath(roster, getState, chanceMultiplier = 1) {
    for (const id of roster) {
      const s = getState(id);
      if (Math.random() < s.deathChance() * chanceMultiplier) return id;
    }
    return null;
  }
}
