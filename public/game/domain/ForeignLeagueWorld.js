import { Club } from './Club.js';
import { League } from './League.js';

// Las 3 ligas de fondo de UN país extranjero: un Map aparte del de
// LeagueWorld (que es 1-8 español), así que nunca colisiona con
// `movePlayer` — el jugador nunca las juega día a día, se simulan jornada
// a jornada igual que el resto de tu jornada de liga, para que sus
// clasificaciones sean reales de cara a la Copa de Europa.
export class ForeignLeagueWorld {
  constructor(country) { this.country = country; this.leagues = new Map(); }

  static generate(country, cities) {
    const w = new ForeignLeagueWorld(country);
    for (const city of cities) {
      const used = new Set();
      const clubs = Array.from({ length: 10 }, (_, i) => new Club(`${city.name}-${i}`, Club.randomName(used, country), city.diff, false, country));
      w.leagues.set(city.diff, new League(city.diff, city.name, clubs));
    }
    return w;
  }

  leagueOf(tier) { return this.leagues.get(tier); }

  toJSON() {
    const out = {};
    for (const [tier, league] of this.leagues) out[tier] = league.toJSON();
    return out;
  }
  static fromJSON(country, json) {
    const w = new ForeignLeagueWorld(country);
    if (json) for (const tier of Object.keys(json)) w.leagues.set(Number(tier), League.fromJSON(json[tier]));
    return w;
  }
}
