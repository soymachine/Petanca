// La Copa de Europa: los 4 primeros de la liga de nivel más alto (8) de
// cada uno de los 6 países del circuito (España + Francia, Italia,
// Bélgica, Suiza, Portugal) — 24 clubes, sorteados COMPLETAMENTE al azar,
// sin separar por país. 24 no es potencia de 2, así que el bracket se
// rellena hasta 32 con 8 "byes" (pase directo sin jugar); el club del
// jugador nunca puede tocarle un bye, para que siempre haya partido que
// disparar cuando le toque. Mismo motor de bracket que la Copa de España
// (Cup.js), solo que con más entrantes y una ronda más. Se juega en una
// fecha exclusiva del calendario, aparte de la Copa doméstica.
const BRACKET_SIZE = 32;
const ROUND_NAMES = ['DIECISEISAVOS DE FINAL', 'OCTAVOS DE FINAL', 'CUARTOS DE FINAL', 'SEMIFINAL', 'FINAL'];

function snapshot(club, country) {
  return { id: club.id, name: club.name, skill: club.avgSkill ? club.avgSkill() : 5, country };
}

function shuffle(arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export class EuropeanCup {
  constructor(bracket, roundIdx, playerClubId, finished, championId) {
    this.bracket = bracket; // bracket[round] = [{a, b, winnerId}]
    this.roundIdx = roundIdx;
    this.playerClubId = playerClubId;
    this.finished = finished;
    this.championId = championId;
  }

  // groups: [{ country, clubs }], cada `clubs` ya recortado a los primeros
  // 4 de la liga de nivel 8 de ese país (España incluida), ordenados por
  // clasificación; playerClub/playerSkill hacen falta porque, si el propio
  // club del jugador va entre los 4 españoles, se sustituye su snapshot
  // por el nivel EN VIVO de la plantilla, no el guardado en Club.
  static generate(groups, playerClub, playerSkill) {
    const clubs = [];
    for (const { country, clubs: top4 } of groups) {
      for (const c of top4) {
        clubs.push(c.isPlayer ? { id: c.id, name: c.name, skill: playerSkill, country } : snapshot(c, country));
      }
    }

    // playerClub SIEMPRE debe venir incluido en `groups` — el llamador solo
    // arma la Copa cuando el jugador queda entre los primeros de su liga
    // (ver Career.js, `rank <= 4`). Si no aparece es un contrato roto del
    // llamador: mejor reventar aquí y ahora que corromper el bracket en
    // silencio (antes de este chequeo, el jugador podía colarse como un
    // 25º entrante fantasma fuera de la baraja de byes).
    const playerIdx = clubs.findIndex((c) => c.id === playerClub.id);
    if (playerIdx === -1) throw new Error('EuropeanCup.generate: playerClub no está entre los clasificados de `groups`');

    // el jugador nunca puede caer en el grupo con bye: se saca de la
    // baraja antes de repartirlos y se reinserta después, ya a salvo
    const player = clubs[playerIdx];
    const rest = shuffle(clubs.filter((c) => c.id !== playerClub.id));
    const byeCount = Math.max(0, BRACKET_SIZE - clubs.length);
    const byeClubs = rest.slice(0, byeCount);
    const noByeClubs = shuffle([player, ...rest.slice(byeCount)]);

    const round0 = [];
    for (const c of byeClubs) round0.push({ a: c, b: null, winnerId: null });
    for (let i = 0; i < noByeClubs.length; i += 2) round0.push({ a: noByeClubs[i], b: noByeClubs[i + 1] || null, winnerId: null });
    // se vuelve a barajar el orden de los cruces para que los byes no
    // queden todos agrupados al principio del bracket
    const round0Shuffled = shuffle(round0);

    const cup = new EuropeanCup([round0Shuffled], 0, playerClub.id, false, null);
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
  // ¿sigue el jugador vivo en el torneo (no eliminado, no acabado)?
  playerInIt() { return !this.finished && !!this.playerPairing(); }

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
    return new EuropeanCup(json.bracket, json.roundIdx, json.playerClubId, json.finished, json.championId);
  }
}
