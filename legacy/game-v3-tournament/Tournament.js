import { rnd, pickWeighted, mulberry32, hashStr, todayStr } from '../core/utils.js';
import { CITIES, RIVALS, ROUND_NAMES } from '../data/cities.js';

// El torneo en curso: rondas, resultados, apuesta del bar, formato de
// equipo elegido y tiempos muertos disponibles. No sabe jugar partidas
// (eso es cosa de Match), solo lleva la cuenta del camino del torneo.
export class Tournament {
  constructor(city, rounds, opts = {}) {
    this.city = city;
    this.roundIdx = 0;
    this.rounds = rounds;
    this.results = [];
    this.usados = [];
    this.bola = opts.bola ?? 0;
    this.pointsAgainst = 0;
    this.bet = opts.bet ?? null;
    this.stormPlayed = false;
    this.formato = 1;
    this.teamSel = [];
    this.timeouts = 1;
    this.isDaily = !!opts.isDaily;
    this.dailyDate = opts.dailyDate || null;
    this.outcome = null;
  }

  static regular(city, playerMoney, nemesisCity) {
    const finalRival = city.diff - 1;
    const others = [];
    while (others.length < 2) {
      const r = Math.floor(rnd(0, RIVALS.length));
      if (r !== finalRival && !others.includes(r)) others.push(r);
    }
    const rounds = [];
    for (let i = 0; i < 3; i++) {
      let main = pickWeighted(city.clima);
      if (Math.random() < 0.03) main = 'TORMENTA';
      let changeTo = main;
      while (changeTo === main) changeTo = pickWeighted(city.clima);
      rounds.push({
        name: ROUND_NAMES[i],
        rivalIdx: i === 2 ? finalRival : others[i],
        aiLevel: Math.max(1, city.diff - (2 - i)),
        forecast: { main, changeProb: main === 'TORMENTA' ? 0 : (Math.random() < 0.35 ? rnd(0.4, 0.8) : 0), changeTo },
      });
    }
    const stake = Math.min(150, Math.floor(playerMoney * 0.25 / 10) * 10);
    let bet = null;
    if (stake >= 20) {
      if (Math.random() < 0.4) {
        bet = { type: 'clean', stake, mult: 4, accepted: false,
          desc: `${stake}€ a que encajáis más de 3 puntos en el torneo (x4 si aguantáis)` };
      } else {
        const nem = nemesisCity === city.name;
        bet = { type: 'win', stake, mult: nem ? 3 : 2, accepted: false,
          desc: `${stake}€ a que no ganáis el torneo (x${nem ? 3 : 2}${nem ? ', huele la revancha' : ''})` };
      }
    }
    return new Tournament(city, rounds, { bet });
  }

  static daily() {
    const date = todayStr();
    const rng = mulberry32(hashStr('petanka-daily-' + date));
    const city = CITIES[Math.floor(rng() * CITIES.length)];
    const weatherKeys = Object.keys(city.clima);
    const weather = weatherKeys[Math.floor(rng() * weatherKeys.length)];
    const rivalIdx = Math.floor(rng() * RIVALS.length);
    const aiLevel = 3 + Math.floor(rng() * 6);
    const rounds = [{ name: 'RELÁMPAGO', rivalIdx, aiLevel, forecast: { main: weather, changeProb: 0, changeTo: weather } }];
    return new Tournament(city, rounds, { isDaily: true, dailyDate: date });
  }

  get currentRound() { return this.rounds[this.roundIdx]; }
  get isFinalRound() { return this.roundIdx === this.rounds.length - 1; }

  markUsed(ids) { for (const i of ids) if (!this.usados.includes(i)) this.usados.push(i); }

  recordRoundResult(won, scoreP, scoreA, abuelos) {
    this.results.push({ round: this.roundIdx, rival: RIVALS[this.currentRound.rivalIdx], won, scoreP, scoreA, abuelos });
  }

  advanceRound() { this.roundIdx++; this.teamSel = []; }

  acceptBet(playerMoney) {
    if (!this.bet || this.bet.accepted || this.roundIdx !== 0) return false;
    this.bet.accepted = true;
    return true;
  }

  settleBet(won) {
    if (!this.bet || !this.bet.accepted) return null;
    const betWon = this.bet.type === 'win' ? won : this.pointsAgainst <= 3;
    if (betWon) return { won: true, amount: this.bet.stake * this.bet.mult };
    return { won: false, amount: this.bet.stake };
  }
}
