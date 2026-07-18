import { boardObjectiveFor } from '../data/boardObjectives.js';

// Expectativa de la junta directiva para la temporada de liga en curso.
export class BoardObjective {
  constructor(seasonNum) { this.seasonNum = seasonNum; this.goal = boardObjectiveFor(seasonNum); }

  static forSeason(seasonNum) { return new BoardObjective(seasonNum); }

  // se llama al cerrar la temporada; devuelve el resultado (cumplido o no) con su efecto en dinero
  settle(finalRank) {
    const met = finalRank <= this.goal.rankGoal;
    return { met, amount: met ? this.goal.rewardMoney : -this.goal.penaltyMoney, goal: this.goal };
  }
}
