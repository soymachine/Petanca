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
// exportado para que EuropeanCupScreen pueda pintar los nombres de TODAS
// las rondas (incluidas las que aún no se han sorteado) sin duplicar esta
// lista a mano en la pantalla
export const ROUND_NAMES = ['DIECISEISAVOS DE FINAL', 'OCTAVOS DE FINAL', 'CUARTOS DE FINAL', 'SEMIFINAL', 'FINAL'];

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
  // por el nivel EN VIVO de la plantilla, no el guardado en Club. `groupsFor`
  // más abajo arma `groups` a partir de un Player, sea cual sea su nivel
  // actual (el club del jugador puede no ir entre los 4, ver más abajo).
  //
  // playerClub es OPCIONAL: si no viene, o si no aparece entre `groups`
  // (el club del jugador no llegó a top 4 de la máxima categoría esta
  // temporada, o directamente juega en otro nivel), la Copa se sortea y se
  // resuelve ENTERA por IA en el momento — de esta forma la Copa de Europa
  // se juega y se decide todos los años, aunque el jugador no la dispute
  // esa vez (ver Career.js, que ahora la sortea cada fin de temporada, y
  // Player.js, que ya arranca con una recién resuelta desde el primer día).
  static generate(groups, playerClub, playerSkill) {
    const clubs = [];
    for (const { country, clubs: top4 } of groups) {
      for (const c of top4) {
        clubs.push(playerClub && c.id === playerClub.id ? { id: c.id, name: c.name, skill: playerSkill, country } : snapshot(c, country));
      }
    }

    const playerIdx = playerClub ? clubs.findIndex((c) => c.id === playerClub.id) : -1;
    let round0;
    if (playerIdx === -1) {
      // el jugador no está esta vez: reparto totalmente al azar, sin
      // restricción de bye para nadie en particular
      const shuffled = shuffle(clubs);
      const byeCount = Math.max(0, BRACKET_SIZE - clubs.length);
      round0 = [];
      for (let i = 0; i < byeCount; i++) round0.push({ a: shuffled[i], b: null, winnerId: null });
      for (let i = byeCount; i < shuffled.length; i += 2) round0.push({ a: shuffled[i], b: shuffled[i + 1] || null, winnerId: null });
    } else {
      // el jugador nunca puede caer en el grupo con bye: se saca de la
      // baraja antes de repartirlos y se reinserta después, ya a salvo
      const player = clubs[playerIdx];
      const rest = shuffle(clubs.filter((c) => c.id !== playerClub.id));
      const byeCount = Math.max(0, BRACKET_SIZE - clubs.length);
      const byeClubs = rest.slice(0, byeCount);
      const noByeClubs = shuffle([player, ...rest.slice(byeCount)]);
      round0 = [];
      for (const c of byeClubs) round0.push({ a: c, b: null, winnerId: null });
      for (let i = 0; i < noByeClubs.length; i += 2) round0.push({ a: noByeClubs[i], b: noByeClubs[i + 1] || null, winnerId: null });
    }
    // se vuelve a barajar el orden de los cruces para que los byes no
    // queden todos agrupados al principio del bracket
    const round0Shuffled = shuffle(round0);

    const cup = new EuropeanCup([round0Shuffled], 0, playerIdx === -1 ? null : playerClub.id, false, null);
    cup.resolveAiPairings();
    // si el jugador no está en el cuadro, resolveAiPairings ya ha resuelto
    // TODOS los cruces de la ronda 0 (nada que esperar): se completa el
    // resto del torneo entero aquí mismo, de una sentada
    if (cup.roundComplete()) cup._runToCompletion();
    return cup;
  }

  // arma `groups` (ver generate más arriba) a partir de un Player: los 4
  // primeros de la liga de nivel 8 de su país de casa (sea o no su liga
  // actual) más los 4 primeros de la de nivel 8 de cada país extranjero.
  static groupsFor(player) {
    const homeTop = player.leagueWorld.leagueOf(8);
    const groups = [{ country: player.homeCountry, clubs: homeTop ? homeTop.standings().slice(0, 4) : [] }];
    for (const [code, world] of player.foreignLeagues) {
      const top = world.leagueOf(8);
      if (top) groups.push({ country: code, clubs: top.standings().slice(0, 4) });
    }
    return groups;
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
  // ¿"acabó mal" para el jugador? true tanto si perdió como si nunca llegó
  // a jugarla (playerClubId null) — usar isChampion()/playerInIt() para
  // distinguir esos casos si hace falta
  playerEliminated() { return this.finished && this.championId !== this.playerClubId; }
  isChampion() { return this.finished && this.championId === this.playerClubId; }
  // ¿sigue el jugador vivo en el torneo (no eliminado, no acabado)?
  playerInIt() { return !this.finished && !!this.playerPairing(); }

  // el club campeón (snapshot {id,name,skill,country}), o null si aún no
  // hay campeón — SIEMPRE que `finished` sea true ya hay uno, porque el
  // torneo ahora se completa entero por IA en cuanto deja de depender de
  // un partido real del jugador (ver resolvePlayerPairing/generate)
  get championClub() {
    if (!this.finished || this.championId === null) return null;
    for (let r = this.bracket.length - 1; r >= 0; r--) {
      for (const p of this.bracket[r]) {
        if (p.a && p.a.id === this.championId) return p.a;
        if (p.b && p.b.id === this.championId) return p.b;
      }
    }
    return null;
  }

  resolveAiPairings() {
    for (const p of this.round) {
      if (p.winnerId !== null) continue;
      if ((p.a && p.a.id === this.playerClubId) || (p.b && p.b.id === this.playerClubId)) continue;
      if (!p.b) { p.winnerId = p.a.id; continue; } // bye
      const won = Math.random() < p.a.skill / (p.a.skill + p.b.skill);
      p.winnerId = won ? p.a.id : p.b.id;
    }
  }

  // gana o pierde, el torneo sigue: si el jugador cae, el resto del
  // cuadro (donde él ya no aparece) se termina de resolver por IA aquí
  // mismo, hasta tener un campeón real — antes, perder aquí dejaba la
  // Copa "acabada" sin que nadie llegara a coronarse de verdad.
  resolvePlayerPairing(won) {
    const p = this.playerPairing();
    if (!p) return;
    p.winnerId = won ? this.playerClubId : (p.a.id === this.playerClubId ? p.b.id : p.a.id);
    if (this.roundComplete()) this._runToCompletion();
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

  // avanza rondas mientras la actual esté completa y aún no haya campeón
  // — se para sola en cuanto le toca esperar un partido real del jugador
  // (esa ronda se queda incompleta hasta que se juegue) o al coronarse un
  // campeón. El tope de iteraciones es solo un cinturón de seguridad
  // (totalRounds nunca debería hacer falta más de una vuelta de más).
  _runToCompletion() {
    let guard = 0;
    while (!this.finished && this.roundComplete() && guard++ < this.totalRounds + 2) this.advanceRound();
  }

  toJSON() { return { bracket: this.bracket, roundIdx: this.roundIdx, playerClubId: this.playerClubId, finished: this.finished, championId: this.championId }; }
  static fromJSON(json) {
    if (!json) return null;
    return new EuropeanCup(json.bracket, json.roundIdx, json.playerClubId, json.finished, json.championId);
  }
}
