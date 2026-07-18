import { ABUELO_DATA, STAT_KEYS } from '../data/abuelos.js';
import { rivalOf } from '../data/rivalries.js';
import { AbueloState } from './AbueloState.js';

// La plantilla de la peña: qué abuelos tienes fichados y su estado. No sabe
// nada de torneos ni de la pantalla — solo gestiona "quién está en el equipo".
export class Roster {
  constructor(ids = [0], statesJSON = {}) {
    this.ids = ids.slice();
    this.states = new Map();
    for (const id of this.ids) this.states.set(id, AbueloState.fromJSON(id, statesJSON[id]));
  }

  static fromJSON(json) {
    const r = new Roster(json.roster || [0], json.state || {});
    return r;
  }
  toJSON() {
    const state = {};
    for (const [id, s] of this.states) state[id] = s.toJSON();
    return { roster: this.ids.slice(), state };
  }

  get(id) {
    if (!this.states.has(id)) this.states.set(id, new AbueloState(id));
    return this.states.get(id);
  }

  has(id) { return this.ids.includes(id); }

  recruit(id, freeIfFirst) {
    if (this.has(id)) return;
    this.ids.push(id);
    this.states.set(id, new AbueloState(id, { st: 100, mo: freeIfFirst ? 0 : 5 }));
  }

  get size() { return this.ids.length; }

  // roces internos: quien se queda en el banquillo mientras su rival de
  // vestuario ha jugado esta ronda, pierde moral extra por los celos
  applyRivalryJealousy(playedThisRound) {
    for (const id of this.ids) {
      const rid = rivalOf(id);
      if (rid === null || !this.has(rid)) continue;
      const played = playedThisRound.includes(id);
      const rivalPlayed = playedThisRound.includes(rid);
      if (!played && rivalPlayed) this.get(id).addMoral(-3);
    }
  }

  // asigna a `mentorId` como mentor de `pupilId`: acelera el entrenamiento del pupilo
  assignMentor(mentorId, pupilId) {
    if (!this.has(mentorId) || !this.has(pupilId) || mentorId === pupilId) return false;
    this.get(mentorId).mentorOf = pupilId;
    return true;
  }

  // el mentor no da un +1 genérico a todo: solo ayuda de verdad en la stat en
  // la que él mismo destaca — hay que emparejar bien mentor y pupilo según
  // qué se quiera entrenar, no solo "poner a cualquiera de mentor"
  mentorStatOf(mentorId) {
    const s = this.get(mentorId);
    let best = STAT_KEYS[0], bestVal = s.getStat(best);
    for (const k of STAT_KEYS) {
      const v = s.getStat(k);
      if (v > bestVal) { bestVal = v; best = k; }
    }
    return best;
  }

  mentorBonusFor(pupilId, statKey) {
    for (const id of this.ids) {
      if (this.get(id).mentorOf === pupilId) {
        return this.mentorStatOf(id) === statKey ? 1 : 0;
      }
    }
    return 0;
  }

  totalUpkeep() {
    // cuota de socio: cada abuelo cuesta un poco de mantenimiento por torneo
    return this.ids.reduce((sum, id) => sum + upkeepFor(id), 0);
  }
}

export function upkeepFor(id) {
  // los más caros de fichar también piden más ronda de vinos
  return 5 + Math.round(ABUELO_DATA[id].price / 100);
}
