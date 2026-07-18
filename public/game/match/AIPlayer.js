import { rnd, gauss, clamp, dist2d } from '../core/utils.js';
import { isRainy, isWindy } from '../data/climas.js';
import { GRAV, THROW_X, CH } from '../physics/constants.js';

// Decide el lanzamiento del rival: balística inversa (elige elevación,
// resuelve la velocidad) más ruido según su nivel y las condiciones.
export class AIPlayer {
  static throwParams(match) {
    const lvl = match.aiLevel;
    let tx = match.jack.x, ty = match.jack.y;
    let shooting = false;
    const pBest = match.bestBall('P');
    const aBest = match.bestBall('A');
    if (pBest && (!aBest || pBest.d < aBest.d) && pBest.d < 6 && Math.random() < 0.15 + lvl * 0.06) {
      tx = pBest.b.x; ty = pBest.b.y; shooting = true;
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
    if (!shooting) err *= 1 + match.blockingPenalty() * 0.5;
    angle += gauss() * err * 0.55;
    speed *= 1 + gauss() * err * 0.55;
    loft += gauss() * err * 0.3;
    const power = clamp((speed - 14) / 44, 0.05, 1);
    return { angle, power, spin: gauss() * 0.2, loft: clamp(loft, 0.17, 1.05) };
  }
}
