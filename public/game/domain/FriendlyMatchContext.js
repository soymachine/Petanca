import { rnd, pickWeighted, clamp } from '../core/utils.js';
import { cityByName } from '../data/countries.js';

// Adaptador que hace que el primer amistoso de pretemporada "parezca" un
// torneo de una sola ronda de cara a Match.js — igual que WeeklyMatchContext,
// pero sin nada de liga real: no hay apuesta, ni derbi, ni némesis, ni
// patrocinio en juego. Es solo para coger forma antes de que empiece la liga.
export class FriendlyMatchContext {
  constructor(league, opponentClub) {
    const city = cityByName(league.cityName);
    this.city = city;
    this.league = league;
    this.opponentClub = opponentClub;
    this.isCup = false;
    this.isDerby = false;
    this.isNemesis = false;
    this.isFriendly = true;
    const aiLevel = clamp(Math.round(opponentClub.avgSkill()), 1, 10);
    const captain = opponentClub.captain;
    const main = pickWeighted(city.clima);
    let changeTo = main;
    while (changeTo === main) changeTo = pickWeighted(city.clima);
    this.rounds = [{
      aiLevel, rivalIdx: 0,
      rivalName: opponentClub.name + (captain ? ` (${captain.name})` : ''),
      archetypeKey: opponentClub.name,
      rivalPortrait: captain ? captain.portrait : null,
      rivalMini: captain ? captain.miniPortrait : null,
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
    this.warmup = null;
    this.festival = null;
    this.bet = null;
  }

  get currentRound() { return this.rounds[this.roundIdx]; }
  get isFinalRound() { return true; }

  markUsed(ids) { for (const i of ids) if (!this.usados.includes(i)) this.usados.push(i); }
  recordRoundResult(won, scoreP, scoreA, abuelos) {
    this.results.push({ round: 0, rival: this.currentRound.rivalName, won, scoreP, scoreA, abuelos });
  }
  advanceRound() { /* no-op: no hay más rondas en un amistoso */ }

  acceptBet() { return false; }
  settleBet() { return null; }
}
