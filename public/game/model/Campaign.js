import { CAMPAIGN_CHAPTERS } from '../data/campaign.js';

// Capítulos de campaña: se comprueban contra el estado del jugador y se
// reclaman una sola vez.
export class Campaign {
  constructor(claimed = []) { this.claimed = claimed.slice(); }
  static fromJSON(json) { return new Campaign(json && json.claimed); }
  toJSON() { return { claimed: this.claimed }; }

  // devuelve los capítulos recién completados (y los marca como reclamados)
  checkAndClaim(playerSnapshot) {
    const justClaimed = [];
    for (const ch of CAMPAIGN_CHAPTERS) {
      if (this.claimed.includes(ch.id)) continue;
      if (ch.check(playerSnapshot)) { this.claimed.push(ch.id); justClaimed.push(ch); }
    }
    return justClaimed;
  }

  list() {
    return CAMPAIGN_CHAPTERS.map((ch) => ({ ...ch, done: this.claimed.includes(ch.id) }));
  }
}
