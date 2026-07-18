import { ABUELO_DATA } from '../data/abuelos.js';
import { bestBondMultiplier } from '../domain/Chemistry.js';
import { clamp } from '../core/utils.js';

// fatiga -> temblor: tramo suave hasta los 30 STA (igual que antes), y por
// debajo una "pared del cansancio" con el doble de pendiente — jugar
// agotado deja de ser un empeoramiento proporcional y pasa a ser un riesgo
// real, para que rotar plantilla pese de verdad en vez de ser cosmético.
function fatiguePenalty(st) {
  if (st >= 60) return 0;
  const soft = (60 - Math.max(30, st)) / 60 * 1.2;
  if (st >= 30) return soft;
  const softAt30 = (60 - 30) / 60 * 1.2;
  return softAt30 + (30 - st) / 30 * 1.6;
}

// moral -> temblor: tramo normal igual para todo el mundo, y dos zonas que
// aceleran el efecto pasados los ±12 puntos ("estado de gracia" /
// "crisis anímica") — antes era una recta perfecta en todo el rango,
// pasar de +1 a +2 pesaba igual que de +19 a +20.
function moralShakeMult(mo) {
  const base = 1 - clamp(mo, -12, 12) * 0.0035;
  if (mo > 12) return base - (mo - 12) * 0.004;
  if (mo < -12) return base + (-12 - mo) * 0.006;
  return base;
}

// Calcula cómo tira el abuelo alineado ahora mismo: temblor, velocidad de la
// barra de potencia, alcance máximo y longitud de guía. Junta stats, fatiga,
// presión del marcador, rasgos, moral, racha, rol elegido y el juego de bolas.
export class ThrowProfile {
  static compute(match) {
    const i = match.abuelo;
    const s = match.roster.get(i);
    const bm = match.bolaMods || {};
    let shake = 0.055 - s.getStat('pulso') * 0.0038;

    const fat = Math.max(0, Math.min(1, (60 - s.st) / 60));
    shake *= 1 + fatiguePenalty(s.st);

    if (!match.training && match.scoreA > match.scoreP && i !== 5) {
      const press = (1 - s.getStat('temple') / 10) * 0.35;
      shake *= 1 + press * (match.feature === 'pressure' ? 1.7 : 1);
    }
    if (i === 8 && match.firstManoWon === true) shake *= 0.8; // FERMÍN supersticioso
    if (i === 9 && !match.training) shake *= match.stage === 2 ? 0.85 : match.stage === 0 ? 1.15 : 1; // BLAS

    // afinidad climática: quien es inmune (o lleva el pañuelo puesto) tira
    // más firme con mal tiempo; a quien le afecta doble, se le nota en la mano
    const weatherKey = !match.training && match.weather ? match.weather.type : null;
    if (weatherKey && weatherKey !== 'SOL') {
      const affinity = ABUELO_DATA[i].clima[weatherKey] || 0;
      if (s.hasImmunity(weatherKey)) shake *= 0.94;
      else if (affinity < 0) shake *= 1.16;
      // eco heredado del abuelo saliente (ver AbueloState.retireToGrandchild):
      // un 5% menos de temblor con ese clima concreto, aunque no llegue a inmunidad
      if (s.inherited && s.inherited.clima === weatherKey) shake *= 0.95;
    }

    shake *= moralShakeMult(s.mo);
    if (match.jackChoice === 'larga') shake *= 1.15; // boliche largo: cuesta más precisión a los dos bandos
    if (!match.training && match.streak >= 2) shake *= Math.max(0.6, 1 - (match.streak - 1) * 0.08);
    if (!match.training && s.inFormBonus) shake *= 0.92; // racha de forma: llega confiado de casa
    if (s.item && s.item.id === 'guantes') shake *= 0.92;
    if (match.warmedUp) shake *= 0.93; // llegó calentado antes de un partido importante

    // compenetración de parejas: cuanto más rodados juntos, más firme tira
    // uno delante del otro (ver domain/Chemistry.js); el "momento de
    // pareja" es un extra puntual justo tras un buen arrime del compañero
    if (!match.training && match.teamP && match.teamP.length > 1) {
      shake *= bestBondMultiplier(match.chemistry, i, match.teamP);
      if (match.pairMoment) shake *= 0.92;
    }

    let barSpeed = 1.7 * (1 - s.getStat('temple') * 0.035) * (1 + fat * 0.5);
    if (s.item && s.item.id === 'reloj') barSpeed *= 0.8;

    let maxPow = 34 + s.getStat('brazo') * 2 + (bm.pow || 0);
    let impactBonus = 1;
    if (!match.training && match.role === 'apuntar') { shake *= 0.72; maxPow *= 0.72; }
    else if (!match.training && match.role === 'tirar') { shake *= 1.3; maxPow *= 1.12; impactBonus = 1.25; }
    else if (!match.training && match.role === 'bloquear') { shake *= 0.6; maxPow *= 0.5; }

    let spinMax = (0.5 + s.getStat('mana') * 0.05) * (bm.spin || 1);
    if (s.item && s.item.id === 'botas') spinMax *= 1.15;
    if (i === 6) spinMax *= 1.1; // PEPE, "manos de santo": efecto de más, hasta el que no lleva de serie

    return {
      shake: Math.max(0.006, shake),
      barSpeed, maxPow, impactBonus,
      spinMax,
      guideLen: i === 1 ? 58 : 20 + s.getStat('pulso') * 2.5,
      fat,
    };
  }
}
