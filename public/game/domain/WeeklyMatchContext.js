import { rnd, pickWeighted } from '../core/utils.js';
import { cityByName } from '../data/countries.js';
import { clamp } from '../core/utils.js';
import { rollFestival } from '../data/festivals.js';

// Adaptador que hace que un partido de liga semanal (un club rival de tu
// jornada) "parezca" un torneo de una sola ronda de cara a Match.js — así
// se reutiliza toda la física y la máquina de estados del partido tal cual,
// sin tener que tocarla.
export class WeeklyMatchContext {
  constructor(league, opponentClub, playerMoney, nemesisClubId, derbyClubId) {
    const city = cityByName(league.cityName);
    this.city = city;
    this.league = league;
    this.opponentClub = opponentClub;
    this.isNemesis = nemesisClubId === opponentClub.id;
    this.isDerby = derbyClubId === opponentClub.id;
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
    this.warmup = null; // {wanted, done} — calentamiento opcional antes de partidos importantes
    this.festival = rollFestival(); // nombre de la fiesta local, o null la mayoría de semanas

    const stake = Math.min(150, Math.floor(playerMoney * 0.2 / 10) * 10);
    this.bet = null;
    if (stake >= 20 && Math.random() < 0.5) {
      const nem = nemesisClubId === opponentClub.id;
      this.bet = { type: 'win', stake, mult: nem ? 3 : 2, accepted: false,
        desc: `${stake}€ a que no ganáis esta jornada (x${nem ? 3 : 2}${nem ? ', huele la revancha' : ''})` };
    }
  }

  get currentRound() { return this.rounds[this.roundIdx]; }
  get isFinalRound() { return true; } // cada jornada es autoconclusiva

  markUsed(ids) { for (const i of ids) if (!this.usados.includes(i)) this.usados.push(i); }
  recordRoundResult(won, scoreP, scoreA, abuelos) {
    this.results.push({ round: 0, rival: this.currentRound.rivalName, won, scoreP, scoreA, abuelos });
  }
  advanceRound() { /* no-op: no hay más rondas en un partido semanal */ }

  acceptBet() { if (!this.bet || this.bet.accepted) return false; this.bet.accepted = true; return true; }
  settleBet(won) {
    if (!this.bet || !this.bet.accepted) return null;
    if (won) return { won: true, amount: this.bet.stake * this.bet.mult };
    return { won: false, amount: this.bet.stake };
  }
}
