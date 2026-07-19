import { CITIES } from '../data/cities.js';
import { Club } from './Club.js';
import { League } from './League.js';

// Las 8 ligas de España, una por ciudad, ordenadas por nivel (1 Albacete
// .. 8 Madrid). Solo la liga del nivel actual del jugador tiene un hueco
// "TU PEÑA"; el resto son 10 clubes IA completos, visibles pero no jugables.
export class LeagueWorld {
  constructor() { this.leagues = new Map(); }

  static generate(playerLevel, playerClubName) {
    const w = new LeagueWorld();
    for (const city of CITIES) w.leagues.set(city.diff, w._buildLeague(city, playerLevel === city.diff, playerClubName));
    return w;
  }

  _buildLeague(city, withPlayer, playerClubName) {
    const used = new Set();
    const clubs = [];
    const n = withPlayer ? 9 : 10;
    for (let i = 0; i < n; i++) clubs.push(new Club(`${city.name}-${i}`, Club.randomName(used), city.diff));
    if (withPlayer) clubs.splice(Math.floor(Math.random() * (n + 1)), 0, new Club(`${city.name}-YOU`, playerClubName, city.diff, true));
    return new League(city.diff, city.name, clubs);
  }

  leagueOf(level) { return this.leagues.get(level); }

  // el jugador asciende o desciende: la liga de destino gana un hueco "TU
  // PEÑA" (sustituyendo a un club IA aleatorio) y la de origen recupera un
  // club IA nuevo en su lugar.
  movePlayer(fromLevel, toLevel, playerClubName) {
    const from = this.leagues.get(fromLevel);
    if (from) {
      const idx = from.clubs.findIndex((c) => c.isPlayer);
      if (idx >= 0) {
        const city = CITIES.find((c) => c.diff === fromLevel);
        from.clubs[idx] = new Club(`${city.name}-R${Date.now() % 9999}`, Club.randomName(new Set(from.clubs.map((c) => c.name))), fromLevel);
        from.fixtures = rebuildFixtures(from);
      }
    }
    const to = this.leagues.get(toLevel);
    if (to) {
      const city = CITIES.find((c) => c.diff === toLevel);
      const idx = Math.floor(Math.random() * to.clubs.length);
      to.clubs[idx] = new Club(`${city.name}-YOU`, playerClubName, toLevel, true);
      to.matchday = 0;
      for (const c of to.clubs) { c.pts = 0; c.played = 0; c.won = 0; c.lost = 0; }
      to.fixtures = rebuildFixtures(to);
      to.results = [];
    }
  }

  toJSON() {
    const out = {};
    for (const [level, league] of this.leagues) out[level] = league.toJSON();
    return out;
  }
  static fromJSON(json) {
    const w = new LeagueWorld();
    for (const level of Object.keys(json)) w.leagues.set(Number(level), League.fromJSON(json[level]));
    return w;
  }
}

function rebuildFixtures(league) {
  const rebuilt = new League(league.level, league.cityName, league.clubs);
  return rebuilt.fixtures;
}
