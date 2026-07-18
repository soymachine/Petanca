import { rnd, clamp } from '../core/utils.js';
import { TARGET } from '../physics/constants.js';

// Resuelve una partida por estadísticas, sin jugarla a mano. Pensado para
// el desafío diario o entrenamientos que no apetece jugar en ese momento.
export class QuickSim {
  // skillScore: 0..1 aproximado de la calidad del abuelo/equipo alineado
  static resolve(skillScore, aiLevel, staminaFactor = 1) {
    const pStrength = clamp(skillScore * staminaFactor, 0.05, 0.98);
    const aStrength = clamp(0.25 + aiLevel * 0.075, 0.1, 0.95);
    let scoreP = 0, scoreA = 0;
    while (scoreP < TARGET && scoreA < TARGET) {
      const roll = Math.random() * (pStrength + aStrength);
      const points = 1 + (Math.random() < 0.25 ? 1 : 0);
      if (roll < pStrength) scoreP = Math.min(TARGET, scoreP + points);
      else scoreA = Math.min(TARGET, scoreA + points);
    }
    return { scoreP, scoreA, won: scoreP >= TARGET };
  }

  static skillFromStats(stats) {
    const avg = (stats.pulso + stats.brazo + stats.mana + stats.temple + stats.aguante) / 5;
    return clamp(avg / 10, 0.05, 0.98);
  }
}
