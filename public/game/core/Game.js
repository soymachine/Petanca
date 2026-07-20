import { Screen } from './Screen.js';
import { Input } from './Input.js';
import { Geography } from '../data/geography.js';
import { PHOTO_BANNER } from '../data/art/photoBanner.js';
import { FACES } from '../data/art/faces.js';
import { RIVAL_FACES } from '../data/art/rivalFaces.js';
import { CITIES } from '../data/cities.js';
import { allForeignCities, countryTag, strengthFor, citiesFor } from '../data/countries.js';
import { setHomeCountry } from '../data/activeRoster.js';
import { MetaProgress } from '../model/MetaProgress.js';
import { Player } from '../model/Player.js';
import { Career } from '../model/Career.js';
import { Calendar } from '../model/Calendar.js';
import { TransferMarket } from '../model/TransferMarket.js';
import { TransferPool } from '../domain/TransferPool.js';
import { Match } from '../match/Match.js';
import { WeeklyMatchContext } from '../domain/WeeklyMatchContext.js';
import { CupMatchContext } from '../domain/CupMatchContext.js';
import { FriendlyMatchContext } from '../domain/FriendlyMatchContext.js';
import { DIFFICULTIES } from '../data/difficulty.js';
import { CLIMAS } from '../data/climas.js';
import { STAT_LABEL } from '../data/abuelos.js';
import { drillFor } from '../data/trainingDrills.js';
import { resetChemistryFor } from '../domain/Chemistry.js';
import { Chronicle } from '../match/Chronicle.js';
import { DECISION_EVENTS, decisionEventById, fillDecisionText } from '../data/decisionEvents.js';
import { AGING_FLAVOR } from '../data/agingFlavor.js';
import { clamp } from './utils.js';

import { TitleScreen } from '../screens/TitleScreen.js';
import { AgendaScreen } from '../screens/AgendaScreen.js';
import { HubScreen } from '../screens/HubScreen.js';
import { LeagueMapScreen } from '../screens/LeagueMapScreen.js';
import { PenyaScreen } from '../screens/PenyaScreen.js';
import { BarScreen } from '../screens/BarScreen.js';
import { ClubScreen } from '../screens/ClubScreen.js';
import { HemerotecaScreen } from '../screens/HemerotecaScreen.js';
import { AyudaScreen } from '../screens/AyudaScreen.js';
import { PressScreen } from '../screens/PressScreen.js';
import { CapitulosScreen } from '../screens/CapitulosScreen.js';
import { LineupScreen } from '../screens/LineupScreen.js';
import { MatchScreen } from '../screens/MatchScreen.js';
import { ResultScreen } from '../screens/ResultScreen.js';
import { SeasonEndScreen } from '../screens/SeasonEndScreen.js';

const COLS = 140, ROWS = 46;
const calendar = new Calendar();
const negotiationMarket = new TransferMarket(); // ofertas puntuales de compra de UNO de tus abuelos

// Punto de composición del juego: crea las piezas (pantalla, entrada,
// jugador, geografía) y hace de único lugar donde una pantalla puede pedir
// "avanza el día" o "juega el partido de la jornada" sin conocer a las demás.
export class Game {
  constructor(screenEl) {
    this.screen = new Screen(screenEl, COLS, ROWS);
    this.input = new Input(screenEl, COLS, ROWS);
    this.geography = new Geography(286, 92);
    this.faces = FACES;
    this.rivalFaces = RIVAL_FACES;
    this.photoBanner = PHOTO_BANNER;
    for (const c of [...CITIES, ...allForeignCities()]) {
      const [wx, wy] = this.geography.toWorld(c.lon, c.lat);
      c.wx = wx; c.wy = wy;
    }

    this.player = Player.load();
    // los 10 abuelos fundadores y sus retratos dependen del país de casa
    // (ver data/activeRoster.js): hay que fijarlos ANTES de que cualquier
    // pantalla lea ABUELO_DATA/FACES, tanto en el arranque como al cambiar
    // de perfil (ver TitleScreen._drawSlotPicker)
    setHomeCountry(this.player.homeCountry);
    this.career = new Career(this.player, (id) => this.displayName(id));

    this.weeklyMatch = null;
    this.isCupMatch = false;
    this.isEuroCupMatch = false;
    this.match = null;
    this.outcome = null;
    this.calendarEvent = null;
    this.deathEvent = null;
    this.transferOffer = null;
    this.decisionEvent = null; // { event, ctx } — evento de decisión esperando respuesta (ver data/decisionEvents.js)
    this.countryUnlockEvent = null; // true justo tras desbloquear los 5 países extranjeros (ver _finishEuroCupMatch) — ventana de aviso en HubScreen
    this.simulating = false; // modo Debugger: avanza días solo en segundo plano

    this.showFps = false; // [F3] contador de FPS reales, ver loop()
    this._fpsFrames = 0; this._fpsTimer = 0; this._fpsValue = 0;

    this.frame = 0;
    this.state = 'title';
    this.lastT = performance.now();

    this.screens = {
      title: new TitleScreen(this),
      agenda: new AgendaScreen(this),
      hub: new HubScreen(this),
      leaguemap: new LeagueMapScreen(this),
      penya: new PenyaScreen(this),
      bar: new BarScreen(this),
      club: new ClubScreen(this),
      hemeroteca: new HemerotecaScreen(this),
      ayuda: new AyudaScreen(this),
      press: new PressScreen(this),
      capitulos: new CapitulosScreen(this),
      lineup: new LineupScreen(this),
      match: new MatchScreen(this),
      result: new ResultScreen(this),
      seasonEnd: new SeasonEndScreen(this),
    };
  }

  // --- identidad de un hueco de plantilla (curado o fichado) ---
  displayName(id) {
    const s = this.player.roster.get(id);
    return s.signed ? s.signed.name : this.faces[id].name;
  }

  // --- mercado unificado: excedentes del Mercado global YA DESCUBIERTOS
  // (ver domain/Scouting.js — el resto existe en el mundo simulado pero no
  // aparece aquí hasta que un ojeador lo encuentra) + jugadores Sin
  // Equipo (siempre visibles, pero con el potencial oculto hasta
  // scoutearlos). La vieja lista de "candidatos" fijos (los 10 abuelos de
  // siempre) ya no aparece aquí — fichar un jugador nuevo (Sin Equipo o
  // transferencia) es ahora lo único que hace crecer la plantilla, ver
  // PenyaScreen._pickTargetSlot ---
  marketEntries() {
    const { player } = this;
    const out = [];
    for (const listing of TransferPool.globalListings(player.leagueWorld, player.foreignLeagues)) {
      const p = listing.player;
      if (!p.discovered) continue;
      out.push({
        kind: 'transfer', ref: p, listing, name: p.name, portrait: p.portrait,
        price: p.value, stats: p.stats, age: p.age, nationality: p.nationality,
        level100: p.level100, levelRange: p.levelRange, statsRevealed: p.statsRevealed,
        clubName: listing.club.name, cityName: listing.league.cityName,
        seedKey: `t${p.id}`, afford: player.money >= p.value,
      });
    }
    for (const fa of player.freeAgents.agents) {
      out.push({
        kind: 'freeagent', ref: fa, name: fa.name, portrait: fa.portrait,
        price: player.freeAgents.price, stats: fa.stats, age: fa.age,
        nationality: fa.nationality, potentialStars: fa.potentialStars, potential: fa.potential,
        potentialRevealed: fa.potentialRevealed,
        seedKey: `f${fa.id}`, afford: true,
      });
    }
    return out;
  }

  // --- calendario ---
  scheduleTraining(abueloId, drill) {
    const clock = this.player.seasonClock;
    for (let d = clock.day + 1; d < clock.day + 15; d++) {
      const wd = (d - 1) % 7;
      if (wd === 6) continue; // domingo es partido, no se agenda entreno
      if (clock.trainings[d]) continue;
      clock.scheduleTraining(d, abueloId, drill);
      this.player.save();
      return d;
    }
    return null;
  }

  // agenda un entreno en un día concreto (para la agenda de El Club); false
  // si el día no vale (domingo, o ya tiene algo agendado)
  scheduleTrainingOnDay(day, abueloId, drill) {
    const clock = this.player.seasonClock;
    const wd = (day - 1) % 7;
    if (wd === 6 || clock.trainings[day]) return false;
    clock.scheduleTraining(day, abueloId, drill);
    this.player.save();
    return true;
  }

  trainingScheduledFor(abueloId) {
    const clock = this.player.seasonClock;
    for (const day of Object.keys(clock.trainings)) {
      const t = clock.trainings[day];
      if (t.abueloId === abueloId) {
        const wd = (Number(day) - 1) % 7;
        const names = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
        return { ...t, day: Number(day), dayLabel: names[wd] };
      }
    }
    return null;
  }

  advanceDay() {
    const clock = this.player.seasonClock;
    const league = this.player.league;
    const result = clock.advanceToNextEvent(league, () => negotiationMarket.rollOffer(this.player.roster.ids), () => this._rollDecision());
    this.player.save();
    if (!result) return;
    if (result.type === 'match') this._startWeeklyMatch();
    else if (result.type === 'eurocup') { clock.clearEuroCup(result.day); this._startEuroCupMatch(); }
    else if (result.type === 'cup') { clock.clearCup(result.day); this._startCupMatch(); }
    else if (result.type === 'training') {
      clock.clearTraining(result.day);
      this.startTraining(result.abueloId, result.drill);
    } else if (result.type === 'negotiation') {
      this.transferOffer = result.offer;
    } else if (result.type === 'decision') {
      this.decisionEvent = { event: result.event, ctx: result.ctx };
      this.state = 'agenda';
    }
    this.career.weeklyNews(league);
    this.player.freeAgents.refresh();
    this.player.save();
  }

  // avanza exactamente un día (usado por la Agenda para animar el paso día
  // a día por el calendario); no dispara el evento todavía, solo dice qué
  // hay ese día — eso lo hace triggerEvent() tras la pausa visual
  advanceOneDay() {
    const clock = this.player.seasonClock;
    const league = this.player.league;
    const result = clock.advanceOneDay(league, () => negotiationMarket.rollOffer(this.player.roster.ids), () => this._rollDecision());
    this.player.save();
    return result;
  }

  // entra de verdad al evento de un día ya "revelado" por advanceOneDay()
  triggerEvent(result) {
    const clock = this.player.seasonClock;
    const league = this.player.league;
    if (result.type === 'match') this._startWeeklyMatch();
    else if (result.type === 'eurocup') { clock.clearEuroCup(result.day); this._startEuroCupMatch(); }
    else if (result.type === 'cup') { clock.clearCup(result.day); this._startCupMatch(); }
    else if (result.type === 'training') {
      clock.clearTraining(result.day);
      this.startTraining(result.abueloId, result.drill);
    } else if (result.type === 'negotiation') {
      this.transferOffer = result.offer;
    } else if (result.type === 'decision') {
      this.decisionEvent = { event: result.event, ctx: result.ctx };
    }
    this.career.weeklyNews(league);
    this.player.freeAgents.refresh();
    this.player.save();
  }

  // --- eventos de decisión (ver data/decisionEvents.js) ---

  // elige qué toca hoy: una secuela ya agendada (prioridad) o, con poca
  // probabilidad, un evento nuevo del pool (sin repetir hasta agotarlo)
  _rollDecision() {
    const p = this.player;
    const day = p.seasonClock.day;
    const idx = p.pendingDecisions.findIndex((pd) => pd.day === day);
    if (idx >= 0) {
      const pd = p.pendingDecisions[idx];
      p.pendingDecisions.splice(idx, 1);
      const ev = decisionEventById(pd.id);
      return ev ? { event: ev, ctx: pd.ctx } : null;
    }
    if (Math.random() > 0.06) return null;
    let pool = DECISION_EVENTS.filter((e) => e.weight > 0 && !p.seenDecisions.includes(e.id) && (!e.cond || e.cond(p)));
    if (!pool.length) {
      p.seenDecisions = []; // se agotó el pool: vuelve a estar todo disponible
      pool = DECISION_EVENTS.filter((e) => e.weight > 0 && (!e.cond || e.cond(p)));
    }
    if (!pool.length) return null;
    const total = pool.reduce((s, e) => s + e.weight, 0);
    let r = Math.random() * total;
    let chosen = pool[pool.length - 1];
    for (const e of pool) { r -= e.weight; if (r <= 0) { chosen = e; break; } }
    return { event: chosen, ctx: this._buildDecisionCtx(chosen) };
  }

  _buildDecisionCtx(event) {
    const p = this.player;
    if (!event.pick || !p.roster.ids.length) return {};
    const ids = p.roster.ids;
    let abueloId;
    if (event.pick === 'oldest') abueloId = ids.reduce((a, b) => (p.roster.get(a).age >= p.roster.get(b).age ? a : b));
    else if (event.pick === 'youngest') abueloId = ids.reduce((a, b) => (p.roster.get(a).age <= p.roster.get(b).age ? a : b));
    else abueloId = ids[Math.floor(Math.random() * ids.length)];
    return { abueloId };
  }

  // aplica la opción elegida: efectos, noticia, y siembra la secuela (si la
  // opción tiene una) en la cola de Player.pendingDecisions
  resolveDecision(optionIndex) {
    const de = this.decisionEvent;
    if (!de) return;
    const opt = de.event.options[optionIndex];
    if (!opt) return;
    const p = this.player;
    this._applyDecisionEffects(opt.effects, de.ctx);
    if (!p.seenDecisions.includes(de.event.id)) p.seenDecisions.push(de.event.id);
    if (opt.sequel) {
      p.pendingDecisions.push({ day: p.seasonClock.day + opt.sequel.inWeeks * 7, id: opt.sequel.id, ctx: de.ctx });
    }
    p.news.push(fillDecisionText(opt.resultText, de.ctx, (id) => this.displayName(id)));
    this.decisionEvent = null;
    p.save();
  }

  _applyDecisionEffects(effects, ctx) {
    if (!effects) return;
    const p = this.player;
    if (effects.money) p.money += effects.money;
    if (effects.boardConfidence) p.boardConfidence = clamp(p.boardConfidence + effects.boardConfidence, 0, 100);
    const targets = (t) => {
      if (t === 'all') return p.roster.ids;
      return (ctx.abueloId !== undefined && ctx.abueloId !== null && p.roster.has(ctx.abueloId)) ? [ctx.abueloId] : [];
    };
    if (effects.moral) for (const id of targets(effects.moral.target)) p.roster.get(id).addMoral(effects.moral.d);
    if (effects.stamina) for (const id of targets(effects.stamina.target)) { const s = p.roster.get(id); s.st = clamp(s.st + effects.stamina.d, 0, 100); }
    if (effects.xp) for (const id of targets(effects.xp.target)) p.roster.get(id).addXp(effects.xp.amount);
    if (effects.item) for (const id of targets(effects.item.target || 'abuelo')) p.roster.get(id).item = { id: effects.item.itemId };
  }

  // amistoso de pretemporada: solo disponible al empezar temporada (jornada
  // 0 sin jugar), no cuenta para la liga. El PRIMERO se juega de verdad
  // (pasa por la alineación y el simulador completo, como cualquier otro
  // partido) para que la pretemporada pese algo; los siguientes se
  // resuelven al momento, como antes, para no alargar demasiado la espera.
  playFriendly() {
    if (this.player.friendliesLeft <= 0 || this.player.league.matchday !== 0) return null;
    if (this.player.friendliesLeft === 3) { this.startFriendlyMatch(); return null; }
    const league = this.player.league;
    const others = league.clubs.filter((c) => !c.isPlayer);
    if (!others.length) return null;
    const opponent = others[Math.floor(Math.random() * others.length)];
    const mySkill = this.player.club.avgSkill(this.player.roster);
    const won = Math.random() < mySkill / (mySkill + opponent.avgSkill());
    this.player.friendliesLeft--;
    for (const id of this.player.roster.ids) {
      const s = this.player.roster.get(id);
      s.st = Math.min(100, s.st + 15);
      s.addMoral(won ? 6 : 2);
    }
    this.player.addReward(20, 15);
    this.player.news.push(won
      ? `AMISTOSO DE PRETEMPORADA: ${this.player.clubName} gana a ${opponent.name}. La plantilla coge forma antes de la liga.`
      : `AMISTOSO DE PRETEMPORADA: ${opponent.name} se impone, pero sirve para rodar antes de que empiece la liga.`);
    this.player.save();
    return { won, opponent };
  }

  startFriendlyMatch() {
    const league = this.player.league;
    const others = league.clubs.filter((c) => !c.isPlayer);
    if (!others.length) return;
    const opponent = others[Math.floor(Math.random() * others.length)];
    this.weeklyMatch = new FriendlyMatchContext(league, opponent);
    this.isCupMatch = false;
    this.isFriendlyMatch = true;
    this.screens.lineup.cursor = 0;
    this.player.save();
    this.state = 'lineup';
  }

  _finishFriendlyMatch(won) {
    const p = this.player;
    const opponent = this.weeklyMatch.opponentClub;
    p.friendliesLeft--;
    for (const id of p.roster.ids) {
      const s = p.roster.get(id);
      s.st = Math.min(100, s.st + 15);
      s.addMoral(won ? 6 : 2);
    }
    p.addReward(20, 15);
    p.news.push(won
      ? `AMISTOSO DE PRETEMPORADA: ${p.clubName} gana a ${opponent.name}. La plantilla coge forma antes de la liga.`
      : `AMISTOSO DE PRETEMPORADA: ${opponent.name} se impone, pero sirve para rodar antes de que empiece la liga.`);
    p.save();
    this.isFriendlyMatch = false;
    this.friendlyJustPlayed = { won, opponent: opponent.name };
    this.state = 'agenda';
  }

  acceptTransferOffer() {
    if (!this.transferOffer) return;
    const off = this.transferOffer;
    this.player.money += off.amount;
    this.player.news.push(`${this.displayName(off.id)} ficha por ${off.buyer} a cambio de ${off.amount}€.`);
    // el hueco no desaparece: vuelve a estar disponible como candidato base
    this.player.roster.ids = this.player.roster.ids.filter((x) => x !== off.id);
    this.player.roster.states.delete(off.id);
    this.transferOffer = null;
    this.player.save();
  }

  // gasta un consumible de un solo uso (ver data/consumables.js): el stock
  // de verdad vive en player.consumables (se compra en El Bar), aquí se
  // comprueba que quede alguno Y que el propio partido no haya llegado ya
  // al tope de usos, se descuenta del stock y se aplica el efecto a la
  // próxima tirada (o al instante, en el caso del gel) — ver Match.useConsumable
  useConsumable(id) {
    const p = this.player;
    if (!this.match || !(p.consumables[id] > 0) || !this.match.canUseConsumable()) return false;
    if (!this.match.useConsumable(id)) return false;
    p.consumables[id]--;
    p.save();
    return true;
  }

  // XP de participar/ganar (liga usa su propio equivalente en
  // Career.finishWeeklyMatch); anuncia cada subida de nivel en las noticias
  _grantMatchXp(ctx, won, playXp, winXp) {
    const p = this.player;
    for (const id of ctx.usados) {
      const ups = p.roster.get(id).addXp(won ? playXp + winXp : playXp);
      for (const up of ups) {
        p.news.push(`¡${this.displayName(id)} sube a nivel ${up.level}! ${up.points} puntos por repartir en Mi Peña.`);
      }
    }
  }

  // libro de récords del Panteón: la mayor paliza dada en cualquier
  // competición jugada en vivo (la liga ya se registra aparte, en
  // Career.finishWeeklyMatch, porque solo ahí se conoce el marcador final
  // antes de que la jornada mueva el resto de resultados)
  _maybeRecordMargin(margin, rivalName, cityName) {
    const p = this.player;
    if (!p.bestMarginWin || margin > p.bestMarginWin.margin) {
      p.bestMarginWin = { margin, rival: rivalName, cityName };
    }
  }

  // XP por calidad de tirada acumulada durante el partido (this.match.xpGain,
  // ver Match.js) — aplica a cualquier tipo de partido jugado en vivo
  _applyThrowXp() {
    const M = this.match;
    if (!M || !M.xpGain) return;
    const p = this.player;
    for (const idStr of Object.keys(M.xpGain)) {
      const id = Number(idStr);
      if (!p.roster.has(id)) continue;
      const ups = p.roster.get(id).addXp(M.xpGain[idStr]);
      for (const up of ups) {
        p.news.push(`¡${this.displayName(id)} sube a nivel ${up.level}! ${up.points} puntos por repartir en Mi Peña.`);
      }
    }
  }

  // --- imprevistos + partido semanal ---
  _startWeeklyMatch() {
    this.calendarEvent = null;
    this.deathEvent = null;
    this.injuryEvent = null;

    const diff = DIFFICULTIES.find((d) => d.id === this.player.difficulty) || DIFFICULTIES[1];
    const evChance = this.player.facilities.eventChanceMultiplier() * diff.eventMult;
    const injury = calendar.rollInjury(this.player.roster.ids, (id) => this.player.roster.get(id), this.player.seasonClock.day, (id) => this.displayName(id), evChance);
    if (injury) {
      this.injuryEvent = injury;
      this.player.news.push(`LESIÓN: ${injury.text}`);
    }
    const diedId = this._maybeRollDeath(evChance);
    if (diedId === null) {
      this.calendarEvent = calendar.rollEvent(this.player.roster.ids, (id) => this.displayName(id), evChance);
      if (this.calendarEvent) {
        const s = this.player.roster.get(this.calendarEvent.id);
        if (this.calendarEvent.staPenalty) s.st = Math.max(0, s.st - this.calendarEvent.staPenalty);
        if (this.calendarEvent.moralBonus) s.addMoral(this.calendarEvent.moralBonus);
      }
      this._maybeAgingForeshadow();
    }
    const league = this.player.league;
    const fixtures = league.fixturesForMatchday(league.matchday);
    const myFixture = fixtures.find(([a, b]) => a === league.playerClub.id || b === league.playerClub.id);
    const opponentId = myFixture ? (myFixture[0] === league.playerClub.id ? myFixture[1] : myFixture[0]) : null;
    const opponent = opponentId ? league.clubById(opponentId) : league.clubs.find((c) => !c.isPlayer);

    this.weeklyMatch = new WeeklyMatchContext(league, opponent, this.player.money, this.player.nemesis && this.player.nemesis.city, this.player.derbyClub && this.player.derbyClub.id);
    this.isCupMatch = false;
    this.isEuroCupMatch = false;
    this.screens.lineup.cursor = 0;
    this.player.save();

    const isDerby = !!(this.player.derbyClub && opponent && this.player.derbyClub.id === opponent.id);
    const isNemesis = !!(this.player.nemesis && opponent && this.player.nemesis.city === opponent.id);
    const isFinal = league.matchday >= league.fixtures.length - 1;
    if (opponent && (isDerby || isNemesis || isFinal)) {
      this.pressContext = { opponent, isDerby, isNemesis, isFinal, isCup: false };
      this.screens.press.cursor = 0;
      this.state = 'press';
    } else {
      this.state = 'lineup';
    }
  }

  // tirada de fallecimiento + todo lo que conlleva (relevo generacional,
  // deuda de sangre heredada, noticia, anal permanente) — factorizado para
  // que tanto el partido jugado en vivo (_startWeeklyMatch) como el modo
  // Debugger (debugAdvanceOneDay, que antes se saltaba esta tirada por
  // completo y por eso nadie moría nunca simulando temporadas) usen
  // exactamente la misma lógica. Devuelve el id fallecido, o null.
  _maybeRollDeath(evChance) {
    const diedId = calendar.rollDeath(this.player.roster.ids, (id) => this.player.roster.get(id), evChance);
    if (diedId === null) return null;
    const name = this.displayName(diedId);
    const age = this.player.roster.get(diedId).age;
    // deuda de sangre: si se va con una revancha pendiente (némesis activa,
    // o el derbi en contra en el historial), el nieto hereda las ganas de
    // saldarla — ver Career.settleDebts, que la liquida al ganarle a ese club
    let debt = null;
    if (this.player.nemesis) debt = { clubId: this.player.nemesis.city, label: this.player.nemesis.rival };
    else if (this.player.derbyClub && this.player.derbyHistory.losses > this.player.derbyHistory.wins) {
      debt = { clubId: this.player.derbyClub.id, label: this.player.derbyClub.name };
    }
    const wasForeshadowed = this.player.roster.get(diedId).agingFlavorSeen;
    const hadLegend = resetChemistryFor(this.player, diedId);
    const { inherited } = this.player.roster.get(diedId).retireToGrandchild('fallecimiento', debt);
    const echo = inherited.clima
      ? `Dicen que ha salido a su abuelo: tampoco le hace mella la ${CLIMAS[inherited.clima].label.toLowerCase()}.`
      : `Se le nota de familia el ${STAT_LABEL[inherited.stat].toLowerCase()}.`;
    const debtTxt = debt ? ` El nieto se guarda una cuenta pendiente con ${debt.label}.` : '';
    // si ya se le veía venir (ver _maybeAgingForeshadow), el titular lo
    // cita en vez de sonar a sorpresa — cierra el presagio con el desenlace
    const foreshadowTxt = wasForeshadowed ? ' Llevaba tiempo avisando de que el cuerpo no daba para más.' : '';
    this.deathEvent = { id: diedId, text: `${name} nos dejó a los ${age} años. El testigo pasa a su nieto.` };
    this.player.news.push(`IN MEMORIAM: se nos fue ${name}, a los ${age} años.${foreshadowTxt} Su nieto recoge el testigo en la peña. ${echo}${debtTxt}`);
    this.player.addAnnal(`IN MEMORIAM — ${name} (${age} años). El testigo pasa a su nieto en la peña.`);
    if (hadLegend) this.player.news.push(`FIN DE UNA ERA: la pareja de leyenda de ${name} se deshace con su marcha. Al nieto le toca hacerse un hueco desde cero.`);
    return diedId;
  }

  // presagio de la edad: sin efecto mecánico, solo una línea de aviso para
  // que la muerte (Calendar.rollDeath) no llegue de sopetón cuando el
  // declive físico (AbueloState.ageDeclineFor) ya lleva tiempo notándose.
  // Solo se comprueba en semanas "tranquilas" (sin muerte ni imprevisto ya
  // resuelto esta jornada) para no amontonar noticias, y como mucho una
  // vez por generación (ver AbueloState.agingFlavorSeen).
  _maybeAgingForeshadow() {
    if (Math.random() > 0.04) return;
    const p = this.player;
    const candidates = p.roster.ids.filter((id) => {
      const s = p.roster.get(id);
      return !s.agingFlavorSeen && s.ageDeclineFor('aguante') > 15;
    });
    if (!candidates.length) return;
    const id = candidates[Math.floor(Math.random() * candidates.length)];
    const s = p.roster.get(id);
    s.agingFlavorSeen = true;
    const line = AGING_FLAVOR[Math.floor(Math.random() * AGING_FLAVOR.length)];
    p.news.push(line.replace('{n}', this.displayName(id)));
  }

  // --- Copa de España: cruce agendado en el calendario ---
  _startCupMatch() {
    const cup = this.player.cup;
    const opponentEntry = cup && cup.playerOpponent();
    if (!cup || cup.finished || !opponentEntry) { this.state = 'hub'; return; }

    this.weeklyMatch = new CupMatchContext(cup, opponentEntry, null, citiesFor(this.player.homeCountry));
    this.isCupMatch = true;
    this.isEuroCupMatch = false;
    this.screens.lineup.cursor = 0;
    this.player.save();

    this.pressContext = { opponent: { id: opponentEntry.id, name: opponentEntry.name }, isDerby: false, isNemesis: false, isFinal: false, isCup: true, roundName: cup.roundName };
    this.screens.press.cursor = 0;
    this.state = 'press';
  }

  _finishCupMatch(won, scoreP, scoreA, chronicleFacts = null) {
    const p = this.player;
    const cup = p.cup;
    const opponent = cup.playerOpponent();
    const roundName = cup.roundName;
    cup.resolvePlayerPairing(won);
    this._grantMatchXp(this.weeklyMatch, won, 10, 15);
    this.career.settleDebts(p, this.weeklyMatch.usados, opponent.id, won);
    this.career.trackChemistry(p, this.weeklyMatch.usados, won);
    if (won) this._maybeRecordMargin(scoreP - scoreA, opponent.name, p.league.cityName);
    p.matchResults[p.seasonClock.day] = { kind: 'cup', scoreP, scoreA, won, oppName: opponent.name, roundName };

    const promiseBroken = !!(p.pressPromise && p.pressPromise.opponentId === opponent.id && !won && p.pressPromise.loseBonus < 0);
    if (p.pressPromise && p.pressPromise.opponentId === opponent.id) {
      if (promiseBroken) {
        for (const id of p.roster.ids) p.roster.get(id).addMoral(p.pressPromise.loseBonus);
        p.news.push('LA PRENSA NO OLVIDA: tras lo dicho antes del partido, la eliminación sienta especialmente mal.');
      }
      p.pressPromise = null;
    }

    if (!won) {
      const resultNews = chronicleFacts
        ? Chronicle.compose(chronicleFacts, { won, scoreP, scoreA, rivalName: opponent.name, clubName: p.clubName, venueLabel: `${cup.roundName.toLowerCase()} de la Copa de España`, promiseBroken, publicImage: p.publicImage })
        : `COPA DE ESPAÑA: ${p.clubName} cae ante ${opponent.name} en ${cup.roundName.toLowerCase()} (${scoreP}-${scoreA}). Se acaba el sueño por esta vez.`;
      p.news.push(resultNews);
      p.addReward(40, 30);
    } else if (cup.roundComplete()) {
      cup.advanceRound();
      if (cup.finished && cup.isChampion()) {
        p.cupTitles++;
        p.boardConfidence = Math.min(100, p.boardConfidence + 15);
        p.addReward(400, 800);
        p.news.push(`¡¡¡CAMPEONES DE LA COPA DE ESPAÑA!!! ${p.clubName} se corona tras ganar a ${opponent.name} en la final (${scoreP}-${scoreA}). ¡Fiesta en el pueblo!`);
        p.addAnnal(`CAMPEONES DE LA COPA DE ESPAÑA: ${p.clubName} gana la final a ${opponent.name} (${scoreP}-${scoreA}).`);
      } else {
        p.addReward(80, 120);
        const nextOpp = cup.playerOpponent();
        p.news.push(`COPA DE ESPAÑA: ${p.clubName} pasa a ${cup.roundName.toLowerCase()} tras ganar a ${opponent.name} (${scoreP}-${scoreA}). Próximo rival: ${nextOpp ? nextOpp.name : '?'}.`);
        const day = p.seasonClock.firstFreeDayFrom(3, p.league);
        p.seasonClock.scheduleCup(day);
      }
    }
    p.save();
    this.state = 'hub';
  }

  // --- Copa de Europa: cruce agendado en el calendario, sede en cualquier
  // ciudad conocida (española o francesa) ---
  _startEuroCupMatch() {
    const cup = this.player.euroCup;
    const opponentEntry = cup && cup.playerOpponent();
    if (!cup || cup.finished || !opponentEntry) { this.state = 'hub'; return; }

    this.weeklyMatch = new CupMatchContext(cup, opponentEntry, null, [...CITIES, ...allForeignCities()]);
    this.weeklyMatch.isEuropean = true;
    this.isCupMatch = true;
    this.isEuroCupMatch = true;
    this.screens.lineup.cursor = 0;
    this.player.save();

    this.pressContext = {
      opponent: { id: opponentEntry.id, name: opponentEntry.name }, isDerby: false, isNemesis: false, isFinal: false,
      isCup: true, isEuropean: true, roundName: cup.roundName,
    };
    this.screens.press.cursor = 0;
    this.state = 'press';
  }

  _finishEuroCupMatch(won, scoreP, scoreA, chronicleFacts = null) {
    const p = this.player;
    const cup = p.euroCup;
    const opponent = cup.playerOpponent();
    const rivalTag = countryTag(opponent.country, p.homeCountry);
    const roundName = cup.roundName;
    cup.resolvePlayerPairing(won);
    this._grantMatchXp(this.weeklyMatch, won, 15, 25);
    this.career.settleDebts(p, this.weeklyMatch.usados, opponent.id, won);
    this.career.trackChemistry(p, this.weeklyMatch.usados, won);
    if (won) this._maybeRecordMargin(scoreP - scoreA, `${opponent.name}${rivalTag}`, p.league.cityName);
    p.matchResults[p.seasonClock.day] = { kind: 'eurocup', scoreP, scoreA, won, oppName: `${opponent.name}${rivalTag}`, roundName };

    // dar la campanada: ganar a un club de un país con más strength que el
    // TUYO (no siempre España — ver Player.homeCountry) pesa más para el
    // prestigio de mánager que un triunfo cualquiera — ver Player.managerRep
    if (won && strengthFor(opponent.country) > strengthFor(p.homeCountry)) {
      p.euroUpsets++;
      p.news.push(`DAIS LA CAMPANADA: ${p.clubName} tumba a ${opponent.name}${rivalTag}, de un país con más nivel que el vuestro. La comarca no habla de otra cosa.`);
      p.addAnnal(`CAMPANADA EUROPEA: ${p.clubName} tumba a ${opponent.name}${rivalTag}, de un país de más nivel, en ${cup.roundName.toLowerCase()}.`);
    }

    const promiseBroken = !!(p.pressPromise && p.pressPromise.opponentId === opponent.id && !won && p.pressPromise.loseBonus < 0);
    if (p.pressPromise && p.pressPromise.opponentId === opponent.id) {
      if (promiseBroken) {
        for (const id of p.roster.ids) p.roster.get(id).addMoral(p.pressPromise.loseBonus);
        p.news.push('LA PRENSA NO OLVIDA: tras lo dicho antes del partido, la eliminación sienta especialmente mal.');
      }
      p.pressPromise = null;
    }

    if (!won) {
      const resultNews = chronicleFacts
        ? Chronicle.compose(chronicleFacts, { won, scoreP, scoreA, rivalName: `${opponent.name}${rivalTag}`, clubName: p.clubName, venueLabel: `${cup.roundName.toLowerCase()} de la Copa de Europa`, promiseBroken, publicImage: p.publicImage })
        : `COPA DE EUROPA: ${p.clubName} cae ante ${opponent.name}${rivalTag} en ${cup.roundName.toLowerCase()} (${scoreP}-${scoreA}). Se acaba la aventura europea por esta vez.`;
      p.news.push(resultNews);
      p.addReward(80, 60);
    } else if (cup.roundComplete()) {
      cup.advanceRound();
      if (cup.finished && cup.isChampion()) {
        p.euroCupTitles++;
        p.boardConfidence = Math.min(100, p.boardConfidence + 25);
        p.addReward(900, 1800);
        p.news.push(`¡¡¡CAMPEONES DE LA COPA DE EUROPA!!! ${p.clubName} se corona tras ganar a ${opponent.name}${rivalTag} en la final (${scoreP}-${scoreA}). ¡La peña entera lo va a recordar toda la vida!`);
        p.addAnnal(`CAMPEONES DE LA COPA DE EUROPA: ${p.clubName} gana la final a ${opponent.name}${rivalTag} (${scoreP}-${scoreA}).`);
        // primera Copa de Europa ganada NUNCA (con cualquier perfil): abre
        // los 5 países extranjeros como país de casa para partidas futuras
        // — unlockAllCountries() devuelve true solo la primera vez, así
        // que el aviso no vuelve a salir en futuras Copas de Europa
        if (MetaProgress.unlockAllCountries()) this.countryUnlockEvent = true;
      } else {
        p.addReward(180, 260);
        const nextOpp = cup.playerOpponent();
        const nextTag = nextOpp ? countryTag(nextOpp.country, p.homeCountry) : '';
        p.news.push(`COPA DE EUROPA: ${p.clubName} pasa a ${cup.roundName.toLowerCase()} tras ganar a ${opponent.name}${rivalTag} (${scoreP}-${scoreA}). Próximo rival: ${nextOpp ? nextOpp.name : '?'}${nextTag}.`);
        const day = p.seasonClock.firstFreeDayFrom(6, p.league);
        p.seasonClock.scheduleEuroCup(day);
      }
    }
    p.save();
    this.isEuroCupMatch = false;
    this.state = 'hub';
  }

  startMatch(team) {
    const usableTeam = this.calendarEvent && this.calendarEvent.unavailable
      ? team.filter((id) => id !== this.calendarEvent.id)
      : team;
    const finalTeam = usableTeam.length ? usableTeam : team;
    // ANSELMO (id 2), "siesta sagrada": empieza cada torneo con la stamina
    // al máximo, llueva, truene o toque jugar el segundo partido del día
    if (finalTeam.includes(2)) this.player.roster.get(2).st = 100;
    this.match = new Match({
      tournament: this.weeklyMatch, roster: this.player.roster, team: finalTeam,
      sweetBonus: this.player.facilities.sweetSpotWidthBonus(),
      chemistry: this.player.chemistry,
    });
    this.match.setNameProvider((id) => this.displayName(id));
    this.player.captain = finalTeam[0];
    this.player.save();
    this.state = 'match';
  }

  startTraining(id, drill) {
    this.match = new Match({
      tournament: null, roster: this.player.roster, team: [id], training: drill,
      trainBonus: this.player.facilities.trainingStatBonus(drillFor(drill).stat),
    });
    this.match.setNameProvider((id2) => this.displayName(id2));
    this.player.roster.get(id).st = Math.max(0, this.player.roster.get(id).st - this.player.facilities.trainingCost());
    this.player.save();
    this.state = 'match';
  }

  // modo Practicar: el mismo minijuego, pero gratis (sin coste de STA, sin
  // ocupar un día de la Agenda) y sin premio de stat — solo para coger
  // soltura con los controles. Ver Match.practice / onMatchFinished.
  startPractice(id, drill) {
    this.match = new Match({
      tournament: null, roster: this.player.roster, team: [id], training: drill, practice: true,
      trainBonus: this.player.facilities.trainingStatBonus(drillFor(drill).stat),
    });
    this.match.setNameProvider((id2) => this.displayName(id2));
    this.player.save();
    this.state = 'match';
  }

  // --- debug: resolver el partido actual por estadísticas en vez de
  // jugarlo, para poder testear temporadas/Copa de Europa rápido. Mismo
  // criterio de probabilidad que la IA usa entre sí (Career._simulateLeagueMatchday),
  // con un marcador de pega (13 el que gana, entre 0 y 11 el que pierde,
  // como cualquier partida real de petanca).
  simulateMatch() {
    const ctx = this.weeklyMatch;
    if (!ctx) return;
    // en Copa/Copa de Europa, ctx.opponentClub es un objeto plano (sin
    // avgSkill real: el rival solo existe como entrada de bracket, ver
    // CupMatchContext) — su nivel vive en ctx.opponentEntry.skill
    const mySkill = this.player.club.avgSkill(this.player.roster);
    const oppSkill = (this.isCupMatch || this.isEuroCupMatch) ? ctx.opponentEntry.skill : ctx.opponentClub.avgSkill();
    const won = Math.random() < mySkill / (mySkill + oppSkill);
    const loserScore = Math.floor(Math.random() * 12);
    const scoreP = won ? 13 : loserScore;
    const scoreA = won ? loserScore : 13;

    if (this.isFriendlyMatch) { this._finishFriendlyMatch(won); return; }
    if (this.isEuroCupMatch) { this._finishEuroCupMatch(won, scoreP, scoreA); return; }
    if (this.isCupMatch) { this._finishCupMatch(won, scoreP, scoreA); return; }
    this.outcome = this.career.finishWeeklyMatch(ctx, won, scoreP, scoreA);
    this.state = 'result';
  }

  // --- modo Debugger: avanza la partida un día por estadísticas, sin pasar
  // por ninguna pantalla de partido — mismo criterio que simulateMatch() de
  // arriba, pero autónomo: se encarga también de resolver Copa/Copa de
  // Europa si tocan, y descarta entrenos/ofertas puntuales para no
  // bloquearse esperando una decisión que nadie va a tomar.
  _debugRollOutcome(oppSkill) {
    const mySkill = this.player.club.avgSkill(this.player.roster);
    const won = Math.random() < mySkill / (mySkill + oppSkill);
    const loserScore = Math.floor(Math.random() * 12);
    return { won, scoreP: won ? 13 : loserScore, scoreA: won ? loserScore : 13 };
  }

  debugAdvanceOneDay() {
    const p = this.player;
    const clock = p.seasonClock;
    const league = p.league;
    const prevState = this.state;
    const result = clock.advanceOneDay(league, () => negotiationMarket.rollOffer(p.roster.ids), () => this._rollDecision());

    if (result.type === 'match') {
      // igual que _startWeeklyMatch: cada jornada de liga es también el
      // momento en que se comprueba si algún abuelo fallece de viejo —
      // antes el modo Debugger se saltaba esta tirada por completo, así
      // que nadie moría nunca simulando temporadas enteras
      const diff = DIFFICULTIES.find((d) => d.id === p.difficulty) || DIFFICULTIES[1];
      const evChance = p.facilities.eventChanceMultiplier() * diff.eventMult;
      this._maybeRollDeath(evChance);
      const fixtures = league.fixturesForMatchday(result.matchdayIndex);
      const myFixture = fixtures.find(([a, b]) => a === league.playerClub.id || b === league.playerClub.id);
      const opponentId = myFixture ? (myFixture[0] === league.playerClub.id ? myFixture[1] : myFixture[0]) : null;
      const opponent = opponentId ? league.clubById(opponentId) : league.clubs.find((c) => !c.isPlayer);
      if (opponent) {
        const ctx = new WeeklyMatchContext(league, opponent, p.money, p.nemesis && p.nemesis.city, p.derbyClub && p.derbyClub.id);
        ctx.markUsed(p.roster.ids);
        const { won, scoreP, scoreA } = this._debugRollOutcome(opponent.avgSkill());
        this.career.finishWeeklyMatch(ctx, won, scoreP, scoreA);
      }
    } else if (result.type === 'cup') {
      clock.clearCup(result.day);
      const cup = p.cup;
      const opp = cup && !cup.finished ? cup.playerOpponent() : null;
      if (opp) {
        // _finishCupMatch reparte XP leyendo this.weeklyMatch.usados — fuera
        // de un partido jugado de verdad no existe, así que se pone uno
        // mínimo (toda la plantilla "jugó") solo para esta llamada
        this.weeklyMatch = { usados: p.roster.ids };
        const { won, scoreP, scoreA } = this._debugRollOutcome(opp.skill);
        this._finishCupMatch(won, scoreP, scoreA);
      }
    } else if (result.type === 'eurocup') {
      clock.clearEuroCup(result.day);
      const cup = p.euroCup;
      const opp = cup && !cup.finished ? cup.playerOpponent() : null;
      if (opp) {
        this.weeklyMatch = { usados: p.roster.ids };
        const { won, scoreP, scoreA } = this._debugRollOutcome(opp.skill);
        this._finishEuroCupMatch(won, scoreP, scoreA);
      }
    } else if (result.type === 'training') {
      clock.clearTraining(result.day);
    } else if (result.type === 'negotiation') {
      this.transferOffer = null;
    } else if (result.type === 'decision') {
      // en modo Debugger nadie va a estar mirando el modal: se elige
      // siempre la primera opción y se sigue sin bloquear la simulación
      this.decisionEvent = { event: result.event, ctx: result.ctx };
      this.resolveDecision(0);
    }

    this.career.weeklyNews(league);
    p.freeAgents.refresh();
    this.state = prevState; // no te saca de la pantalla que estes mirando
    p.save();
    return result;
  }

  startSimulating() { this.simulating = true; }
  stopSimulating() { this.simulating = false; }

  onMatchFinished() {
    const M = this.match;
    if (M.training) {
      // en modo Practicar no hay premio de stat (gratis, sin coste): lo
      // único que queda de la sesión es la marca personal — revive
      // Player.dailyBest, que existía desde hace tiempo pero no lo usaba
      // nadie. TIRO se mide en derribos, el resto en puntos de arrime.
      if (M.practice) {
        const val = drillFor(M.training).hits ? M.targetsHit : M.score;
        this.player.dailyBest[M.training] = Math.max(this.player.dailyBest[M.training] || 0, val);
        this.screens.club.section = 'facilities';
        this.state = 'club';
      } else {
        this.state = 'hub';
      }
      this.player.save();
      return;
    }
    if (M.injuryEvent) {
      const { id, name } = M.injuryEvent;
      const days = Math.round(4 + Math.random() * 6);
      this.player.roster.get(id).injuredUntil = this.player.seasonClock.day + days;
      this.injuryEvent = { id, text: `${name} se ha resentido en pleno partido. Estará de baja ${days} días.` };
      this.player.news.push(`LESIÓN EN PLENO PARTIDO: ${name} se ha resentido y estará de baja ${days} días.`);
    }
    this._applyThrowXp();
    if (this.isFriendlyMatch) {
      this._finishFriendlyMatch(!!M._won);
      return;
    }
    if (this.isEuroCupMatch) {
      this._finishEuroCupMatch(!!M._won, M.scoreP, M.scoreA, M.chronicle);
      return;
    }
    if (this.isCupMatch) {
      this._finishCupMatch(!!M._won, M.scoreP, M.scoreA, M.chronicle);
      return;
    }
    this.outcome = this.career.finishWeeklyMatch(this.weeklyMatch, !!M._won, M.scoreP, M.scoreA, M.chronicle);
    // suma la XP de calidad de tirada (M.xpGain, aplicada arriba en
    // _applyThrowXp) a la de participación que ya trae el outcome, para
    // poder enseñar en ResultScreen el total real ganado por cada abuelo
    const xpPerAbuelo = { ...this.outcome.xpPerAbuelo };
    for (const idStr of Object.keys(M.xpGain || {})) {
      const id = Number(idStr);
      xpPerAbuelo[id] = (xpPerAbuelo[id] || 0) + M.xpGain[idStr];
    }
    this.outcome.xpPerAbuelo = xpPerAbuelo;
    this.state = 'result';
  }

  loop = (now) => {
    const dtReal = (now - this.lastT) / 1000;
    const dt = Math.min(0.05, dtReal);
    this.lastT = now;
    this.frame++;

    if (this.input.hit('F3')) this.showFps = !this.showFps;
    // FPS real (no el dt clampeado de la física): frames por segundo,
    // recalculado 2 veces por segundo para que el número no tiemble frame
    // a frame y aun así se note enseguida si el juego va renqueando
    this._fpsFrames++; this._fpsTimer += dtReal;
    if (this._fpsTimer >= 0.5) {
      this._fpsValue = Math.round(this._fpsFrames / this._fpsTimer);
      this._fpsFrames = 0; this._fpsTimer = 0;
    }

    // modo Debugger: mientras "Simular" esté activo, avanza un día cada
    // pocos frames — rápido, pero visible en la mini-agenda en vez de
    // saltar la temporada entera de golpe en un solo frame
    if (this.simulating && this.state !== 'match' && this.frame % 4 === 0) this.debugAdvanceOneDay();

    const screen = this.screens[this.state];
    if (this.state === 'match') screen.update(dt);
    screen.draw();

    if (this.showFps) {
      const label = `${this._fpsValue} FPS [F3]`;
      const col = this._fpsValue >= 50 ? '#7ec850' : this._fpsValue >= 30 ? '#ffe14d' : '#ff5c5c';
      this.screen.text(this.screen.cols - label.length, 0, label, col);
    }

    this.input.drawCursor(this.screen);
    this.screen.render();
    this.input.endFrame();
    requestAnimationFrame(this.loop);
  };

  start() { requestAnimationFrame(this.loop); }
}
