import { rnd } from '../core/utils.js';
import { PENAS_LIGA } from '../data/cities.js';

// Liga de peñas: 8 jornadas, puntos por etapa alcanzada, clasificación con
// rivales que también puntúan por su cuenta.
export class Season {
  constructor(num = 1, jornada = 0, pts = 0, rivals = null) {
    this.num = num;
    this.jornada = jornada;
    this.pts = pts;
    this.rivals = rivals || PENAS_LIGA.map((name) => ({ name, pts: 0 }));
  }

  static fromJSON(json) {
    if (!json) return new Season();
    return new Season(json.num, json.jornada, json.pts, json.rivals);
  }
  toJSON() { return { num: this.num, jornada: this.jornada, pts: this.pts, rivals: this.rivals }; }

  // etapa alcanzada -> puntos de liga; también hace avanzar a los rivales
  recordResult(won, roundIdx) {
    const pts = won ? 10 : [1, 3, 6][roundIdx] || 1;
    this.pts += pts;
    for (const rv of this.rivals) rv.pts += Math.floor(rnd(2, 8));
    this.jornada++;
    return pts;
  }

  isOver() { return this.jornada >= 8; }

  standings() {
    return [{ name: 'TU PEÑA', pts: this.pts, me: true }, ...this.rivals].sort((a, b) => b.pts - a.pts);
  }

  myRank() { return this.standings().findIndex((t) => t.me) + 1; }

  // cierra la temporada: premio según posición y reinicio
  close() {
    const rank = this.myRank();
    const prize = rank === 1 ? { m: 500, x: 300 } : rank === 2 ? { m: 250, x: 150 } : { m: 100, x: 50 };
    const closedNum = this.num;
    this.num += 1; this.jornada = 0; this.pts = 0;
    this.rivals = PENAS_LIGA.map((name) => ({ name, pts: 0 }));
    return { rank, prize, num: closedNum };
  }
}
