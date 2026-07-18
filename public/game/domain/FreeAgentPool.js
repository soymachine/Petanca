import { FreeAgent } from './FreeAgent.js';

const SIZE = 4;

// Pool de jugadores Sin Equipo: sustituye a la vieja cantera. No se
// renuevan agresivamente — solo se rellenan los huecos que quedan libres
// (al fichar a uno, o si nunca llegó a haber SIZE). Gratis siempre.
export class FreeAgentPool {
  constructor(agents = []) { this.agents = agents; }

  static fromJSON(json) {
    const p = new FreeAgentPool();
    p.agents = (json || []).map((a) => new FreeAgent(a));
    return p;
  }
  toJSON() {
    return this.agents.map((a) => ({
      id: a.id, name: a.name, potential: a.potential, age: a.age, stats: a.stats, potentialRevealed: a.potentialRevealed,
    }));
  }

  refresh() {
    while (this.agents.length < SIZE) this.agents.push(FreeAgent.generate());
  }

  get price() { return 0; }
}
