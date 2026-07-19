import { rnd, gauss, clamp, dist2d } from '../core/utils.js';
import { isRainy, isWindy } from '../data/climas.js';
import { GRAV, THROW_X, CH } from '../physics/constants.js';

// Decide el lanzamiento del rival: balística inversa (elige elevación,
// resuelve la velocidad) más ruido según su nivel y las condiciones.
//
// Arquetipos (ver data/rivalArchetypes.js): cada capitán rival tiene un
// estilo fijo (determinista por nombre de club). 'muro' no dispara más ni
// menos que la media, pero cuando NO dispara apunta a bloquear el camino
// en vez de simplemente arrimar (ver más abajo); 'templado' se calcula al
// final, junto al resto del error.
const ARCHETYPE_SHOT_MULT = { arrimador: 0.4, tirador: 2, muro: 1, templado: 1 };
const ARCHETYPE_SHOT_RANGE = { arrimador: 6, tirador: 9, muro: 6, templado: 6 };
const ARCHETYPE_ERR_MULT = { arrimador: 0.85, tirador: 1.2, muro: 1, templado: 1 };

export class AIPlayer {
  static throwParams(match) {
    const lvl = match.aiLevel;
    const arch = match.rivalArchetype;
    let tx = match.jack.x, ty = match.jack.y;
    let shooting = false;
    const pBest = match.bestBall('P');
    const aBest = match.bestBall('A');
    const shotMult = ARCHETYPE_SHOT_MULT[arch] ?? 1;
    const shotRange = ARCHETYPE_SHOT_RANGE[arch] ?? 6;
    if (pBest && (!aBest || pBest.d < aBest.d) && pBest.d < shotRange && Math.random() < (0.15 + lvl * 0.06) * shotMult) {
      tx = pBest.b.x; ty = pBest.b.y; shooting = true;
    } else if (arch === 'muro' && !shooting) {
      // el muro no arrima al boliche cuando manda la mano: se pone en el
      // camino directo entre el círculo de tiro y el boliche, a estorbar la
      // próxima bola del jugador (mismo corredor que blockingPenalty())
      const isWinning = !pBest || (aBest && aBest.d < pBest.d);
      if (isWinning) {
        const k = 0.55 + Math.random() * 0.25;
        tx = THROW_X + (match.jack.x - THROW_X) * k;
        ty = CH / 2 + (match.jack.y - CH / 2) * k;
      }
    }
    const d = dist2d(THROW_X, CH / 2, tx, ty);
    let loft = shooting ? rnd(0.30, 0.42) : rnd(0.55, 0.80);
    const rollEst = shooting ? 0 : 4.5;
    const carry = Math.max(3, d - rollEst);
    let speed = Math.sqrt((GRAV * carry) / Math.sin(2 * loft));
    let angle = Math.atan2((ty - CH / 2) * 2, tx - THROW_X);
    const comp = clamp(lvl / 10, 0.2, 0.95);
    angle -= Math.atan2(match.weather.wind.y * 0.5, 20) * comp * 2;
    speed -= match.weather.wind.x * 0.5 * comp;
    let err = 0.42 - lvl * 0.045;
    const w = match.weather.type;
    if (isRainy(w) || isWindy(w) || w === 'NIEBLA') err *= 1.15;
    if (w === 'TORMENTA') err *= 1.3;
    if (match.jackChoice === 'larga') err *= 1.15; // boliche largo: cuesta más precisión a los dos bandos
    if (!shooting) err *= 1 + match.blockingPenalty() * 0.5;
    err *= ARCHETYPE_ERR_MULT[arch] ?? 1;
    if (arch === 'templado' && match.scoreA < match.scoreP) err *= 0.8; // veterano frío: no se arruga yendo por detrás
    err *= 1 - (match.aiMorale || 0) * 0.25; // moral alta = tira mejor (ver Match.resolveMano)
    angle += gauss() * err * 0.55;
    speed *= 1 + gauss() * err * 0.55;
    loft += gauss() * err * 0.3;
    const power = clamp((speed - 14) / 44, 0.05, 1);
    return { angle, power, spin: gauss() * 0.2, loft: clamp(loft, 0.17, 1.05) };
  }
}
