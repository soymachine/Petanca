import { clamp } from '../core/utils.js';

// Expectativa de la junta directiva de la peña para cada temporada de liga.
// La exigencia crece de forma continua con las temporadas jugadas (antes
// eran 3 escalones fijos que se quedaban parados en "2º" para siempre a
// partir de la quinta temporada — en una carrera larga de 10-15
// temporadas, como las que invitan a jugar el Panteón y las generaciones,
// la junta dejaba de apretar). El premio/multa también escala con el
// nivel de liga: la junta de Madrid no paga (ni multa) lo mismo que la de
// Albacete, cosa que antes era el mismo importe fijo en toda la partida.
export function boardObjectiveFor(seasonNum, leagueLevel = 1) {
  const rankGoal = clamp(Math.round(5 - Math.log2(seasonNum + 1)), 1, 4);
  const scale = 1 + (leagueLevel - 1) * 0.18;
  return {
    rankGoal,
    desc: `La junta espera que acabéis entre los ${rankGoal} primeros de la liga.`,
    rewardMoney: Math.round(200 * scale),
    penaltyMoney: Math.round(80 * scale),
  };
}

// Objetivos de la junta AL DÍA, jornada a jornada: más pequeños que el de
// temporada, pero con premio o castigo inmediato tras cada partido de liga.
export const WEEKLY_GOALS = [
  { id: 'ganar', desc: 'Ganar el partido de esta jornada.', reward: 50, penalty: 15,
    check: (won) => won },
  { id: 'contundencia', desc: 'Ganar esta jornada por 6 puntos de diferencia o más.', reward: 90, penalty: 0,
    check: (won, margin) => won && margin >= 6 },
  { id: 'racha', desc: 'Encadenar 3 victorias seguidas con el mismo abuelo.', reward: 70, penalty: 0,
    check: (won, margin, bestStreak) => won && bestStreak >= 3 },
  { id: 'ajustado', desc: 'Ganar por la mínima (1 a 3 puntos de diferencia).', reward: 55, penalty: 0,
    check: (won, margin) => won && margin >= 1 && margin <= 3 },
  { id: 'resistir', desc: 'Aunque se pierda, que sea por 2 puntos o menos: dar la cara.', reward: 40, penalty: 0,
    check: (won, margin) => !won && margin >= -2 },
  { id: 'racha_larga', desc: 'Encadenar 6 victorias seguidas con el mismo abuelo.', reward: 130, penalty: 0,
    check: (won, margin, bestStreak) => won && bestStreak >= 6 },
  { id: 'aplastante', desc: 'Ganar esta jornada por 10 puntos de diferencia o más.', reward: 150, penalty: 0,
    check: (won, margin) => won && margin >= 10 },
];

export function rollWeeklyGoal() {
  return { ...WEEKLY_GOALS[Math.floor(Math.random() * WEEKLY_GOALS.length)] };
}

// el objetivo semanal lleva una función (`check`) que no sobrevive a
// JSON.stringify/localStorage: al guardar solo se persiste el id, y al
// cargar se recupera el objeto completo (con su función) a partir de él.
// Acepta también partidas guardadas antes de este cambio, donde quedó
// grabado el objeto plano sin `check` (se cura solo en el próximo guardado).
export function weeklyGoalToJSON(goal) { return goal ? goal.id : null; }
export function weeklyGoalFromJSON(json) {
  const id = typeof json === 'string' ? json : (json && json.id);
  return (id && WEEKLY_GOALS.find((g) => g.id === id)) || rollWeeklyGoal();
}
