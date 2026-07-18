// La Copa de España: un cruce eliminatorio de 8 clubes (uno de cada una de
// las 8 ligas), a partido único. Los cruces que no te tocan a ti se
// resuelven al momento por nivel medio (igual que el resto de la jornada
// de liga); el tuyo se juega de verdad y se agenda en el calendario.
const ROUND_NAMES = ['CUARTOS DE FINAL', 'SEMIFINAL', 'FINAL'];

function snapshot(club) {
  return { id: club.id, name: club.name, skill: club.avgSkill ? club.avgSkill() : 5 };
}

export class Cup {
  constructor(bracket, roundIdx, playerClubId, finished, championId) {
    this.bracket = bracket; // bracket[round] = [{a, b, winnerId}]
    this.roundIdx = roundIdx;
    this.playerClubId = playerClubId;
    this.finished = finished;
    this.championId = championId;
  }

  static generate(leagueWorld, playerClub, playerSkill) {
    const contenders = [];
    for (let level = 1; level <= 8; level++) {
      const league = leagueWorld.leagueOf(level);
      if (!league) continue;
      const pool = league.clubs.filter((c) => !c.isPlayer);
      if (pool.length) contenders.push(snapshot(pool[Math.floor(Math.random() * pool.length)]));
    }
    const rivals = contenders.slice(0, 7);
    const clubs = [{ id: playerClub.id, name: playerClub.name, skill: playerSkill }, ...rivals];
    for (let i = clubs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [clubs[i], clubs[j]] = [clubs[j], clubs[i]];
    }
    const round0 = [];
    for (let i = 0; i < clubs.length; i += 2) round0.push({ a: clubs[i], b: clubs[i + 1] || null, winnerId: null });
    const cup = new Cup([round0], 0, playerClub.id, false, null);
    cup.resolveAiPairings();
    return cup;
  }

  get round() { return this.bracket[this.roundIdx]; }
  get roundName() { return ROUND_NAMES[this.roundIdx] || `RONDA ${this.roundIdx + 1}`; }
  get totalRounds() { return ROUND_NAMES.length; }

  playerPairing() { return this.round.find((p) => (p.a && p.a.id === this.playerClubId) || (p.b && p.b.id === this.playerClubId)); }
  playerOpponent() {
    const p = this.playerPairing();
    if (!p) return null;
    return p.a && p.a.id === this.playerClubId ? p.b : p.a;
  }
  playerEliminated() { return this.finished && this.championId !== this.playerClubId; }
  isChampion() { return this.finished && this.championId === this.playerClubId; }

  // resuelve al momento todos los cruces de la ronda actual que NO sean el
  // del jugador (por nivel medio, con algo de azar)
  resolveAiPairings() {
    for (const p of this.round) {
      if (p.winnerId !== null) continue;
      if ((p.a && p.a.id === this.playerClubId) || (p.b && p.b.id === this.playerClubId)) continue;
      if (!p.b) { p.winnerId = p.a.id; continue; } // bye
      const won = Math.random() < p.a.skill / (p.a.skill + p.b.skill);
      p.winnerId = won ? p.a.id : p.b.id;
    }
  }

  resolvePlayerPairing(won) {
    const p = this.playerPairing();
    if (!p) return;
    p.winnerId = won ? this.playerClubId : (p.a.id === this.playerClubId ? p.b.id : p.a.id);
    if (!won) this.finished = true;
  }

  roundComplete() { return this.round.every((p) => p.winnerId !== null); }

  // arma la siguiente ronda a partir de los ganadores; si ya no hay más
  // rondas, la copa se da por acabada con campeón
  advanceRound() {
    const winners = this.round.map((p) => (p.winnerId === (p.a && p.a.id) ? p.a : p.b));
    if (winners.length <= 1) { this.finished = true; this.championId = winners[0] ? winners[0].id : null; return; }
    const next = [];
    for (let i = 0; i < winners.length; i += 2) next.push({ a: winners[i], b: winners[i + 1] || null, winnerId: null });
    this.bracket.push(next);
    this.roundIdx++;
    this.resolveAiPairings();
  }

  toJSON() { return { bracket: this.bracket, roundIdx: this.roundIdx, playerClubId: this.playerClubId, finished: this.finished, championId: this.championId }; }
  static fromJSON(json) {
    if (!json) return null;
    return new Cup(json.bracket, json.roundIdx, json.playerClubId, json.finished, json.championId);
  }
}
