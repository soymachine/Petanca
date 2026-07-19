import { Club } from './Club.js';

// Genera un calendario de liga a una vuelta (método del círculo): con 10
// clubes salen 9 jornadas de 5 partidos cada una, y cada club juega una vez
// contra todos los demás.
function roundRobin(clubIds) {
  const ids = clubIds.slice();
  if (ids.length % 2 !== 0) ids.push(null); // bye si fuera impar (no debería pasar con 10)
  const n = ids.length;
  const rounds = [];
  const fixed = ids[0];
  let rest = ids.slice(1);
  for (let r = 0; r < n - 1; r++) {
    const order = [fixed, ...rest];
    const matches = [];
    for (let i = 0; i < n / 2; i++) {
      const a = order[i], b = order[n - 1 - i];
      if (a !== null && b !== null) matches.push([a, b]);
    }
    rounds.push(matches);
    rest.unshift(rest.pop()); // rota
  }
  return rounds;
}

export class League {
  constructor(level, cityName, clubs) {
    this.level = level; // 1 (Albacete) .. 8 (Madrid)
    this.cityName = cityName;
    this.clubs = clubs; // Club[10], incluye el club del jugador
    this.fixtures = roundRobin(clubs.map((c) => c.id));
    this.matchday = 0; // índice de la próxima jornada a jugar (0..8)
    this.results = []; // results[jornada] = [{a, b, scoreA, scoreB}, ...] jornadas ya jugadas
  }

  clubById(id) { return this.clubs.find((c) => c.id === id); }
  get playerClub() { return this.clubs.find((c) => c.isPlayer); }

  fixturesForMatchday(idx) { return this.fixtures[idx] || []; }
  resultsForMatchday(idx) { return this.results[idx] || []; }
  recordMatchResult(matchdayIdx, aId, bId, scoreA, scoreB) {
    if (!this.results[matchdayIdx]) this.results[matchdayIdx] = [];
    this.results[matchdayIdx].push({ a: aId, b: bId, scoreA, scoreB });
  }
  get isSeasonOver() { return this.matchday >= this.fixtures.length; }

  standings() {
    return this.clubs.slice().sort((a, b) => b.pts - a.pts || b.won - a.won);
  }

  myRank() { return this.standings().findIndex((c) => c.isPlayer) + 1; }

  // arranca una temporada nueva SIN cambiar de liga (cuando no hay ascenso
  // ni descenso): reinicia clasificación y calendario, si no la liga se
  // quedaría con isSeasonOver a true para siempre.
  startNewSeason() {
    this.matchday = 0;
    for (const c of this.clubs) { c.pts = 0; c.played = 0; c.won = 0; c.lost = 0; }
    this.fixtures = roundRobin(this.clubs.map((c) => c.id));
    this.results = [];
  }

  toJSON() {
    return {
      level: this.level, cityName: this.cityName, matchday: this.matchday,
      clubs: this.clubs.map((c) => c.toJSON()), results: this.results,
    };
  }
  static fromJSON(json) {
    const clubs = json.clubs.map((cd) => Club.fromJSON(cd));
    const l = new League(json.level, json.cityName, clubs);
    l.matchday = json.matchday;
    l.results = json.results || [];
    return l;
  }
}
