import { rnd, pickWeighted, clamp } from '../core/utils.js';
import { CITIES } from '../data/cities.js';

// Adaptador que hace que un cruce de Copa "parezca" un torneo de una sola
// ronda de cara a Match.js — mismo truco que WeeklyMatchContext. La sede es
// un campo neutral: una ciudad al azar del `venuePool` (por defecto, las 8
// españolas; la Copa de Europa pasa un pool combinado con las francesas).
export class CupMatchContext {
  constructor(cup, opponentEntry, captainPortrait, venuePool = CITIES) {
    const city = venuePool[Math.floor(Math.random() * venuePool.length)];
    this.city = city;
    this.cup = cup;
    this.opponentEntry = opponentEntry;
    this.opponentClub = { id: opponentEntry.id, name: opponentEntry.name, pts: 0 };
    const aiLevel = clamp(Math.round(opponentEntry.skill), 1, 10);
    const main = pickWeighted(city.clima);
    let changeTo = main;
    while (changeTo === main) changeTo = pickWeighted(city.clima);
    this.rounds = [{
      aiLevel, rivalIdx: 0,
      rivalName: `${opponentEntry.name} (${cup.roundName})`,
      rivalPortrait: captainPortrait ? captainPortrait.portrait : null,
      rivalMini: captainPortrait ? captainPortrait.miniPortrait : null,
      forecast: { main, changeProb: Math.random() < 0.3 ? rnd(0.4, 0.8) : 0, changeTo },
    }];
    this.roundIdx = 0;
    this.results = [];
    this.usados = [];
    this.bola = 0;
    this.pointsAgainst = 0;
    this.stormPlayed = false;
    this.formato = 1;
    this.teamSel = [];
    this.timeouts = 1;
    this.isDaily = false;
    this.bet = null; // no se apuesta en la Copa
    this.isCup = true;
    this.warmup = null; // {wanted, done} — calentamiento opcional antes de partidos importantes
  }

  get currentRound() { return this.rounds[this.roundIdx]; }
  get isFinalRound() { return true; }

  markUsed(ids) { for (const i of ids) if (!this.usados.includes(i)) this.usados.push(i); }
  recordRoundResult(won, scoreP, scoreA, abuelos) {
    this.results.push({ round: 0, rival: this.currentRound.rivalName, won, scoreP, scoreA, abuelos });
  }
  advanceRound() { /* no-op */ }
  acceptBet() { return false; }
  settleBet() { return null; }
}
