import { rnd, clamp, gauss, dist2d } from '../core/utils.js';
import { ABUELO_DATA, STAT_LABEL } from '../data/abuelos.js';
import { drillFor } from '../data/trainingDrills.js';
import { BOLAS } from '../data/bolas.js';
import { CLIMAS, avisoClima, cambioClima } from '../data/climas.js';
import { RIVALS, ROUND_NAMES } from '../data/cities.js';
import { CW, CH, THROW_X, GRAV, TARGET, ballsPerPlayer } from '../physics/constants.js';
import { Ball } from '../physics/Ball.js';
import { Court } from '../physics/Court.js';
import { Weather } from '../physics/Weather.js';
import { PhysicsWorld } from '../physics/PhysicsWorld.js';
import { ThrowProfile } from './ThrowProfile.js';
import { AIPlayer } from './AIPlayer.js';
import { Narrator } from './Narrator.js';
import { chemistryLevel, gamesFor } from '../domain/Chemistry.js';
import { archetypeFor } from '../data/rivalArchetypes.js';
import { MAX_CONSUMABLES_PER_MATCH } from '../data/consumables.js';

const physicsWorld = new PhysicsWorld();

// Zaragoza (cierzo), Zürich (föhn) y Lisboa (viento atlántico): el viento de
// la ciudad es tan de sello propio que, si no ha tocado por puro azar de
// clima, se fuerza igualmente de vez en cuando (ver _startRound más abajo)
const FORCED_WIND_FEATURES = ['cierzo', 'fohn', 'atlantic'];

// frase de acierto por drill de entrenamiento — ver throwDone
const GOOD_THROW_FLAVOR = {
  ARRIME: '¡Arrime de libro!',
  EFECTO: '¡La rodea de libro!',
  PRESION: '¡Aguanta el pulso pese a los nervios!',
  FONDO: '¡Sigue firme pese al desgaste!',
};

// Una partida: el estado-máquina de fases (puntería, efecto, elevación,
// potencia, simulación...) más las reglas de puntuación de la petanca.
// No dibuja nada: MatchScreen lee sus propiedades públicas para pintarlas.
export class Match {
  constructor({ tournament, roster, team, training = null, practice = false, sweetBonus = 0, trainBonus = 1, chemistry = {} }) {
    this.tournament = tournament;
    this.roster = roster;
    this.training = training; // null | 'ARRIME' | 'TIRO' | 'EFECTO' | 'PRESION' | 'FONDO' — ver data/trainingDrills.js
    // modo Practicar: mismo minijuego, pero gratis y sin premio de stat —
    // ver Game.startPractice/onMatchFinished (dailyBest en vez de train())
    this.practice = !!practice;
    this._sweetBonus = sweetBonus;
    this._trainBonus = trainBonus;
    this.chemistry = chemistry; // Player.chemistry — ver domain/Chemistry.js
    this.pairMoment = false; // extra puntual: el compañero ha dejado la bola a huevo

    if (training) {
      this.city = { name: 'EL DESCAMPADO', color: '#8a8', diff: 0 };
      this.feature = null;
      this.bolaMods = {};
      this.stage = 0; this.aiLevel = 0; this.rival = ''; this.rivalIdx = 0; this.target = 0;
      this.teamP = [team[0]];
      this.totalRounds = 1; this.isDaily = false;
    } else {
      const r = tournament.currentRound;
      this.city = tournament.city;
      this.feature = tournament.city.feature.id;
      this.bolaMods = BOLAS[tournament.bola].mods;
      this.stage = tournament.roundIdx;
      this.totalRounds = tournament.rounds.length;
      this.isDaily = !!tournament.isDaily;
      this.isDerby = !!tournament.isDerby;
      this.isNemesis = !!tournament.isNemesis;
      this.warmedUp = !!(tournament.warmup && tournament.warmup.done);
      this.aiLevel = r.aiLevel;
      this.rivalIdx = r.rivalIdx;
      this.rival = r.rivalName || RIVALS[r.rivalIdx];
      this.rivalPortrait = r.rivalPortrait || null; // retrato generado (liga) en vez de curado (RIVAL_FACES)
      this.rivalMini = r.rivalMini || null; // versión pequeña para el HUD ajustado del partido
      this.rivalArchetype = archetypeFor(r.archetypeKey || this.rival).id;
      this.target = TARGET;
      this.teamP = team.slice();
      tournament.markUsed(team);
      for (const id of team) this.roster.get(id).torneos++;
    }

    this.teamPTurn = 0;
    this.abuelo = this.teamP[0];
    this.scoreP = 0; this.scoreA = 0;
    this.round = 1;
    this.phase = 'roundStart'; this.phaseT = 0;
    this.balls = []; this.jack = null; this.jack2 = null; this.twinJacks = false;
    this.ballsLeftP = training ? (drillFor(training)?.balls ?? 3) : ballsPerPlayer(this.teamP.length) * this.teamP.length;
    this.ballsLeftA = training ? 0 : ballsPerPlayer(this.teamP.length) * this.teamP.length;
    this.turn = 'P';
    this.aimAngle = 0; this.spin = 0; this.loft = 0.6; this.power = 0; this.powerDir = 1;
    this.lastPoints = 0; this.lastWinner = null;
    this.firstManoWon = null;
    this.role = 'apuntar';
    this.streak = 0;
    this.sweetSpot = null; this.sweetWidth = 0.045;
    this.jitterA = 0; this.jitterP = 0;
    this.trail = []; this.decisive = false;
    this.lastCollision = false; this.lastLanded = false; this.lastThrown = null; this.lastWasFault = false; this.timeoutUsedThisThrow = false;
    this.injuryEvent = null;
    this.score = 0; this.targetsHit = 0; this.success = false; // entrenamientos
    this.measured = false; this.measureBalls = null;
    this.xpGain = {}; // id de abuelo -> XP acumulado por calidad de tirada esta partida
    this.jackChoice = null; // ya no se elige por menú (ver _throwJack); queda en null siempre
    this.aiMorale = 0; // -1..1, sube ganando manos y baja perdiéndolas — ver resolveMano/AIPlayer
    this.chronicle = []; // hechos reales del partido para la crónica (ver match/Chronicle.js)
    this._worstDeficit = -999; this._worstDeficitScores = null; // para detectar una remontada de verdad
    this._maxStreakSeen = 0;

    // consumibles de un solo uso EN este partido (ver data/consumables.js):
    // el stock en sí vive en Player.consumables (Game.js lo gasta y llama a
    // useConsumable), aquí solo se cuentan los usos de ESTE partido para no
    // superar MAX_CONSUMABLES_PER_MATCH, y los "flags de la próxima tirada"
    // que gasta throwBall al lanzar
    this.consumablesUsedThisMatch = 0;
    this._noPressureThisThrow = false;
    this._grippedThisThrow = false;
    this._allOutThisThrow = false;

    this.court = new Court(this.feature);
    const forecastMain = training ? 'SOL' : tournament.currentRound.forecast.main;
    this.weather = new Weather(forecastMain, this.city.diff, this.feature);
    this.weatherChange = (!training && r_changeProb(tournament) > 0 && Math.random() < r_changeProb(tournament))
      ? { atRound: 2 + Math.floor(rnd(0, 2)), to: tournament.currentRound.forecast.changeTo, warned: false }
      : null;

    if (training) {
      const drill = drillFor(training);
      const rewardTxt = this.practice ? ' Modo práctica: gratis, sin coste ni premio de stat.' : ` Premio: +1 ${STAT_LABEL[drill.stat].toUpperCase()}.`;
      this.narr = drill.desc + rewardTxt;
    } else {
      this.narr = `${this.rival} te espera en la pista. ${roundFlavor(this.stage)}`;
    }

    this.court.setupFeature(this.weather.type, this.city.diff);
    if (FORCED_WIND_FEATURES.includes(this.feature) && this.weather.type !== 'VIENTO' && Math.random() < 0.4) {
      this.weather.type = 'VIENTO'; this.weather.roll(this.city.diff, this.feature);
    }
    if (training) this._setupTraining();
    else this._startRound(true);
  }

  // el entrenamiento no pasa por el flujo de "mano" del torneo: se lanza
  // directo a apuntar, sin aviso de clima ni desgaste de calor. ARRIME,
  // EFECTO, PRESIÓN y FONDO comparten el mismo terreno (diana alrededor
  // del boliche); EFECTO además coloca una bola bloqueando la línea recta
  // (hay que rodearla con efecto, ver throwDone) y TIRO es el único que
  // usa un terreno propio (bolas viejas que derribar).
  _setupTraining() {
    if (this.training === 'TIRO') {
      this.jack = new Ball({ x: 130, y: 1, owner: 'J' });
      for (let k = 0; k < 3; k++) {
        const tx = rnd(78, 112), ty = rnd(5, CH - 5);
        const b = new Ball({ x: tx, y: ty, owner: 'T' });
        b.ox = tx; b.oy = ty;
        this.balls.push(b);
      }
    } else if (this.training === 'EFECTO') {
      this.jack = new Ball({ x: rnd(88, 108), y: rnd(9, 13), owner: 'J' });
      const mid = new Ball({ x: (THROW_X + this.jack.x) / 2, y: this.jack.y, owner: 'T' });
      mid.ox = mid.x; mid.oy = mid.y;
      this.balls.push(mid);
    } else {
      this.jack = new Ball({ x: rnd(80, 110), y: rnd(7, CH - 7), owner: 'J' });
    }
    this.court.weather = this.weather.type;
    this.phase = 'aim'; this.phaseT = 0;
    this.aimAngle = Math.atan2(((this.jack.y - CH / 2) * 2) / 60, 1) * 0.5;
    this.jackRevealed = true;
    this.measured = false;
  }

  pickThrower() { if (this.teamP.length > 1) this.abuelo = this.teamP[this.teamPTurn % this.teamP.length]; }

  allBalls() {
    const arr = [];
    if (this.jack) arr.push(this.jack);
    return arr.concat(this.balls);
  }
  anyMoving() { return this.allBalls().some((b) => b.moving); }

  bestBall(owner) {
    let best = null;
    for (const b of this.balls) {
      if (b.owner !== owner) continue;
      const d = dist2d(b.x, b.y, this.jack.x, this.jack.y);
      if (!best || d < best.d) best = { b, d };
    }
    return best;
  }

  nextTurn() {
    const p = this.bestBall('P'), a = this.bestBall('A');
    if (this.ballsLeftP === 0 && this.ballsLeftA === 0) return null;
    if (this.ballsLeftP === 0) return 'A';
    if (this.ballsLeftA === 0) return 'P';
    if (!p && !a) return this.turn === 'P' ? 'A' : 'P';
    if (!p) return 'P';
    if (!a) return 'A';
    return p.d <= a.d ? 'A' : 'P';
  }

  scoreRound() {
    const p = this.bestBall('P'), a = this.bestBall('A');
    if (!p && !a) return { winner: null, points: 0 };
    if (!p) return { winner: 'A', points: this.balls.filter((b) => b.owner === 'A').length };
    if (!a) return { winner: 'P', points: this.balls.filter((b) => b.owner === 'P').length };
    const winner = p.d < a.d ? 'P' : 'A';
    const loserBest = winner === 'P' ? a.d : p.d;
    let points = 0;
    for (const b of this.balls) {
      if (b.owner !== winner) continue;
      if (dist2d(b.x, b.y, this.jack.x, this.jack.y) < loserBest) points++;
    }
    return { winner, points: Math.max(1, points) };
  }

  // ¿hay una bola propia bloqueando el camino directo al boliche? (rol "bloquear")
  blockingPenalty() {
    const ax = THROW_X, ay = CH / 2, bx = this.jack.x, by = this.jack.y;
    const dx = bx - ax, dy = (by - ay) * 2;
    const len2 = dx * dx + dy * dy;
    let worst = 0;
    for (const b of this.balls) {
      if (b.owner !== 'P') continue;
      const px = b.x - ax, py = (b.y - ay) * 2;
      let t = len2 ? (px * dx + py * dy) / len2 : 0;
      t = clamp(t, 0, 1);
      const cx = ax + t * dx, cy = ay + (t * dy) / 2;
      const d = dist2d(b.x, b.y, cx, cy);
      if (t > 0.25 && t < 0.92 && d < 2.6) worst = Math.max(worst, 1 - d / 2.6);
    }
    return worst;
  }

  throwProfile() { return ThrowProfile.compute(this); }

  // ¿se puede usar todavía algún consumible en este partido? (nunca en
  // entrenamiento/práctica, nunca pasado el tope, y solo antes de empezar a
  // apuntar la tirada — ver Game.useConsumable, que gasta el stock de
  // verdad en Player.consumables antes de llamar aquí)
  canUseConsumable() {
    return !this.training && this.phase === 'aim' && this.turn === 'P' &&
      this.consumablesUsedThisMatch < MAX_CONSUMABLES_PER_MATCH;
  }

  // aplica el efecto de un consumible a la PRÓXIMA tirada (o al instante,
  // en el caso del gel): tila anula la presión, talco garantiza agarre, "a
  // por todas" quita el amortiguador de temblor a cambio de potencia/efecto
  // al máximo — todo se limpia solo tras el lanzamiento (ver throwBall)
  useConsumable(id) {
    if (!this.canUseConsumable()) return false;
    this.consumablesUsedThisMatch++;
    if (id === 'tila') this._noPressureThisThrow = true;
    else if (id === 'talco') this._grippedThisThrow = true;
    else if (id === 'bravo') this._allOutThisThrow = true;
    else if (id === 'gel') {
      const s = this.roster.get(this.abuelo);
      s.st = clamp(s.st + 25, 0, 100);
    }
    return true;
  }

  _startRound(isFirst) {
    this.balls = [];
    this.ballsLeftP = this.training ? this.ballsLeftP : ballsPerPlayer(this.teamP.length) * this.teamP.length;
    this.ballsLeftA = this.training ? 0 : ballsPerPlayer(this.teamP.length) * this.teamP.length;
    this.jack = null; this.jack2 = null; this.twinJacks = false;
    if (!isFirst && this.weatherChange) {
      if (!this.weatherChange.warned && this.round === this.weatherChange.atRound - 1) {
        this.narr = avisoClima(this.weatherChange.to);
        this.weatherChange.warned = true;
      } else if (this.round >= this.weatherChange.atRound) {
        this.weather.type = this.weatherChange.to;
        this.weather.roll(this.city.diff, this.feature);
        this.narr = `¡${CLIMAS[this.weather.type].label}! ` + cambioClima(this.weather.type);
        this.chronicle.push({ t: 'clima', data: { to: this.weather.type } });
        this.weatherChange = null;
      }
    }
    if (!isFirst) this.weather.roll(this.city.diff, this.feature);
    this.court.weather = this.weather.type;
    if (this.weather.type === 'CALOR' && !this.training) {
      const a = ABUELO_DATA[this.abuelo];
      const s = this.roster.get(this.abuelo);
      if (a.clima.CALOR < 1 && !s.hasImmunity('CALOR')) {
        const drain = (7 - a.stats.aguante * 0.4) * (a.clima.CALOR < 0 ? 1.6 : 1);
        s.st = clamp(s.st - drain, 0, 100);
      }
    }
    if (this.weather.type === 'TORMENTA' && this.tournament) this.tournament.stormPlayed = true;
    this.turn = 'P';
    this.phase = 'roundStart'; this.phaseT = 0;
    this.aimAngle = 0;
    this.spin = 0; this.loft = 0.6;
    this.trail = [];
    this.jackRevealed = this.weather.type !== 'NIEBLA';
    this.measured = false;
    this.weather.initParticles();
  }

  // lanzamiento del boliche simplificado: dirección + potencia (sin efecto
  // ni elevación elegible), pero animado con el mismo motor físico que una
  // bola — vuelo corto y casi todo rodadura. rollMod alto porque el
  // boliche pesa mucho menos que una bola y por eso frena antes: a la
  // misma potencia, siempre rueda menos.
  _throwJack(angle, power) {
    const startY = clamp(CH / 2 + gauss() * 0.5, 3, CH - 3);
    const loft = 0.1;
    const speed = 55 + power * 42;
    const vh = speed * Math.cos(loft);
    this.jack = new Ball({
      x: THROW_X, y: startY,
      vx: Math.cos(angle) * vh, vy: Math.sin(angle) * vh,
      z: 0.01, vz: speed * Math.sin(loft),
      owner: 'J', moving: true,
    });
    this.jack.rollMod = 1.9;
    this.lastThrown = this.jack;
    this.trail = [];
  }

  // se llama cuando el boliche deja de moverse (fase 'jackSim'): decide el
  // doble boliche si toca y deja listo el ángulo de puntería por defecto
  // para el primer tiro de bola, apuntando ya hacia donde ha quedado
  _resolveJackThrow() {
    this.jack2 = null; this.twinJacks = false;
    if (this.city.diff >= 6 && Math.random() < 0.35) {
      const ang = rnd(0, Math.PI * 2), dist = rnd(14, 22);
      const jx2 = clamp(this.jack.x + Math.cos(ang) * dist, 6, CW - 6);
      const jy2 = clamp(this.jack.y + Math.sin(ang) * dist * 0.5, 3, CH - 3);
      this.jack2 = new Ball({ x: jx2, y: jy2, owner: 'J2' });
      this.twinJacks = true;
      this.narr = '¡DOBLE BOLICHE! El primer tiro decide cuál cuenta.';
    }
    this.aimAngle = Math.atan2(((this.jack.y - CH / 2) * 2) / 60, 1) * 0.5;
  }

  throwBall(owner, angle, power, spin, loft) {
    const startY = clamp(CH / 2 + gauss() * 0.5, 3, CH - 3);
    const prof = owner === 'P' ? this.throwProfile() : null;
    const maxPow = prof ? prof.maxPow : 44;
    const speed = 14 + power * maxPow;
    const vh = speed * Math.cos(loft);
    this.weather.throwJitter();
    const bm = owner === 'P' ? (this.bolaMods || {}) : {};
    const b = new Ball({
      x: THROW_X, y: startY,
      vx: Math.cos(angle) * vh, vy: Math.sin(angle) * vh,
      z: 0.01, vz: speed * Math.sin(loft),
      owner, spin, moving: true,
    });
    b.windFactor = ((owner === 'P' && ABUELO_DATA[this.abuelo].clima.VIENTO === 1) ? 0.3 : 1) * (bm.wind || 1);
    b.rollMod = bm.roll || 1;
    b.impact = (bm.impact || 1) * (owner === 'P' ? (prof ? prof.impactBonus : 1) : 1);
    b.grip = !!bm.grip || (owner === 'P' && this._grippedThisThrow);
    b.wetPenalty = bm.wetPenalty || 1;
    b.thrower = owner === 'P' ? this.abuelo : null;
    b.loft = loft;
    // "retro": tirar con mucho efecto de verdad (más de la mitad del spinMax
    // disponible) deja la bola con posibilidad de quedarse casi clavada tras
    // el golpe en vez de seguir rodando — el tiro clásico de la petanca real
    // (efecto hacia atrás), y aquí depende solo de cuánto efecto se ha
    // metido de verdad, no de la suerte (ver PhysicsWorld._collide)
    const spinMax = owner === 'P' && prof ? prof.spinMax : 0;
    const spinFrac = spinMax > 0 ? Math.abs(spin) / spinMax : 0;
    b.retroPower = (owner === 'P' && this.role === 'tirar' && spinFrac > 0.5) ? clamp((spinFrac - 0.5) / 0.5, 0, 1) : 0;
    b.retroHit = false;
    this.balls.push(b);
    this.lastThrown = b;
    this.lastCollision = false;
    this.lastLanded = false;
    this.trail = [];
    if (owner === 'P') { this.ballsLeftP--; this.teamPTurn++; } else this.ballsLeftA--;
    this.phase = 'sim';
    this.timeoutUsedThisThrow = false;
    this.lastWasFault = false;
    this.pairMoment = false; // el extra de "momento de pareja" solo vale para este tiro
    // los flags de consumible eran "para esta tirada" — ya se han leído
    // (arriba, y dentro de throwProfile()), así que se limpian para que no
    // se cuelen en la siguiente
    this._noPressureThisThrow = false;
    this._grippedThisThrow = false;
    this._allOutThisThrow = false;
  }

  // XP por calidad de tirada: cada bola propia de la mano que se acaba de
  // resolver suma algo según lo cerca que quedó del boliche, si derribó una
  // bola rival, y si se usó bastante efecto — antes de que _startRound()
  // limpie this.balls para la siguiente mano
  _tallyThrowXp() {
    if (!this.jack) return;
    const bm = this.bolaMods || {};
    for (const b of this.balls) {
      if (b.owner !== 'P' || b.thrower === null || b.thrower === undefined) continue;
      let xp = 0;
      const d = dist2d(b.x, b.y, this.jack.x, this.jack.y);
      xp += clamp(Math.round(12 - d), 0, 12);
      if (b.wasHit) xp += 8;
      // spinMax del abuelo QUE TIRÓ esa bola en concreto (no el que esté
      // alineado ahora mismo) — misma fórmula que ThrowProfile.compute
      const s = this.roster.get(b.thrower);
      let spinMax = (0.5 + s.getStat('mana') * 0.05) * (bm.spin || 1);
      if (s.item && s.item.id === 'botas') spinMax *= 1.15;
      if (b.thrower === 6) spinMax *= 1.1; // PEPE, "manos de santo"
      // premio grande si el efecto de verdad logró el retro (resultado, no
      // solo intención); si no llegó a tanto pero se usó bastante efecto,
      // se mantiene el bono menor de siempre como consuelo
      if (b.retroHit) xp += 10;
      else if (spinMax > 0 && Math.abs(b.spin) > spinMax * 0.5) xp += 3;
      // plomada perfecta: bombeo alto que se queda a menos de 2 pasos del
      // boliche — el bombeo por fin tiene un premio ligado al acierto
      if ((b.loft || 0) > 0.75 && d < 2) xp += 6;
      if (xp > 0) this.xpGain[b.thrower] = (this.xpGain[b.thrower] || 0) + xp;
    }
  }

  resolveMano() {
    const r = this.scoreRound();
    this._tallyThrowXp();
    this.lastWinner = r.winner; this.lastPoints = r.points;
    if (this.round === 1) this.firstManoWon = r.winner === 'P';
    const ctx = {
      me: ABUELO_DATA[this.abuelo] ? this._nameOf(this.abuelo) : '', riv: this.rival, points: r.points,
      weather: this.weather?.type, streak: this.streak, isDerby: this.isDerby, isNemesis: this.isNemesis,
      scoreP: this.scoreP, scoreA: this.scoreA, target: this.target,
    };
    if (r.winner === 'P') {
      this.scoreP += r.points; this.streak++;
      ctx.scoreP = this.scoreP;
      this.narr = Narrator.line('manoP', ctx);
      if (this.streak === 2) this.narr = '¡Racha! Dos manos seguidas. ' + this.narr;
      else if (this.streak >= 3) this.narr = `¡RACHA x${this.streak}! Está imparable. ` + this.narr;
      this.aiMorale = clamp(this.aiMorale - 0.2 - (r.points >= 2 ? 0.15 : 0), -1, 1);
    } else if (r.winner === 'A') {
      this.scoreA += r.points; if (this.tournament) this.tournament.pointsAgainst += r.points; this.streak = 0;
      ctx.scoreA = this.scoreA;
      this.narr = Narrator.line('manoA', ctx);
      this.aiMorale = clamp(this.aiMorale + 0.2 + (r.points >= 2 ? 0.15 : 0), -1, 1);
    } else this.narr = Narrator.line('nula', ctx);
    if (!this.training && r.winner !== null) {
      if (this.aiMorale <= -0.7) this.narr += ' El rival aprieta los dientes: se le nota el nervio.';
      else if (this.aiMorale >= 0.7) this.narr += ` ${this.rival} tira con la confianza de quien manda.`;
    }
    this.phase = (this.scoreP >= this.target || this.scoreA >= this.target) ? 'matchEnd' : 'roundEnd';
    this.phaseT = 0;
    this.decisive = r.winner === 'P' && (r.points >= 2 || this.phase === 'matchEnd');

    // hechos para la crónica de fin de partido (ver match/Chronicle.js): se
    // guarda el peor momento (para detectar una remontada de verdad) y la
    // racha más larga vista, no cada mano suelta — la mano decisiva sí se
    // marca aquí, justo cuando se sabe que es la que cierra el partido
    if (!this.training) {
      const deficit = this.scoreA - this.scoreP;
      if (deficit > this._worstDeficit) { this._worstDeficit = deficit; this._worstDeficitScores = { scoreA: this.scoreA, scoreP: this.scoreP }; }
      if (this.streak > this._maxStreakSeen) this._maxStreakSeen = this.streak;
      if (this.phase === 'matchEnd' && this.decisive) this.chronicle.push({ t: 'decisiva', data: { points: r.points } });
    }
  }

  _nameOf(id) { return this._nameProvider ? this._nameProvider(id) : `abuelo ${id}`; }
  setNameProvider(fn) { this._nameProvider = fn; }

  update(dt, input) {
    this.phaseT += dt;
    this.weather.step(this._frame || 0);
    if (this.weather.type && (this.phase === 'aim' || this.phase === 'spin' || this.phase === 'loft' || this.phase === 'power')) {
      this.weather.gust(this._frame || 0, this.round);
    }
    if (!this.training && (this.phase === 'aim' || this.phase === 'spin' || this.phase === 'loft' || this.phase === 'power')) {
      const sh = this.throwProfile().shake;
      const t = (this._frame || 0) * 0.15;
      this.jitterA = (Math.sin(t * 1.7) * 0.6 + Math.sin(t * 3.3 + 1.4) * 0.4) * sh * 2.2;
      this.jitterP = (Math.sin(t * 2.1 + 2.2) * 0.6 + Math.sin(t * 4.1 + 0.5) * 0.4) * sh * 3.5;
    } else { this.jitterA = 0; this.jitterP = 0; }

    switch (this.phase) {
      case 'roundStart':
        if (this.phaseT > 1.6 || input.hit('Enter') || input.hit(' ')) {
          if (this.turn === 'P') this.pickThrower();
          this.phase = 'jackAim'; this.phaseT = 0;
          this.aimAngle = 0;
        }
        break;

      case 'jackAim': {
        if (input.held('ArrowUp')) this.aimAngle -= 0.9 * dt;
        if (input.held('ArrowDown')) this.aimAngle += 0.9 * dt;
        this.aimAngle = clamp(this.aimAngle, -0.5, 0.5);
        if (input.hit('Enter') || input.hit(' ')) {
          this.phase = 'jackPower'; this.phaseT = 0;
          this.power = 0; this.powerDir = 1;
        }
        break;
      }

      case 'jackPower': {
        this.power += this.powerDir * 1.1 * dt;
        if (this.power >= 1) { this.power = 1; this.powerDir = -1; }
        if (this.power <= 0) { this.power = 0; this.powerDir = 1; }
        if (input.hit('Enter') || input.hit(' ')) {
          this._throwJack(this.aimAngle, this.power);
          this.phase = 'jackSim'; this.phaseT = 0;
        }
        if (input.hit('Escape') || input.hit('Backspace')) { this.phase = 'jackAim'; this.phaseT = 0; }
        break;
      }

      case 'jackSim': {
        const frame = this._frame || 0;
        let landed = false;
        const onLand = () => { landed = true; };
        physicsWorld.step(this.allBalls(), dt, this.court, this.weather, () => {}, this.trail, this.jack, frame, onLand);
        physicsWorld.step(this.allBalls(), dt, this.court, this.weather, () => {}, this.trail, this.jack, frame, onLand);
        this.lastLanded = landed;
        if (!this.jack.moving) {
          this._resolveJackThrow();
          this.phase = this.turn === 'P' ? 'aim' : 'aiTurn';
          this.phaseT = 0; this.role = 'apuntar';
        }
        break;
      }

      case 'aim': {
        if (input.held('ArrowUp')) this.aimAngle -= 0.9 * dt;
        if (input.held('ArrowDown')) this.aimAngle += 0.9 * dt;
        this.aimAngle = clamp(this.aimAngle, -0.55, 0.55);
        if (input.hit('r') || input.hit('R')) {
          this.role = this.role === 'apuntar' ? 'tirar' : this.role === 'tirar' ? 'bloquear' : 'apuntar';
        }
        if (input.hit('Enter') || input.hit(' ')) { this.phase = 'spin'; this.phaseT = 0; }
        break;
      }

      case 'spin': {
        const prof = this.throwProfile();
        if (input.held('ArrowLeft')) this.spin -= 1.6 * dt;
        if (input.held('ArrowRight')) this.spin += 1.6 * dt;
        this.spin = clamp(this.spin, -prof.spinMax, prof.spinMax);
        if (input.hit('Enter') || input.hit(' ')) { this.phase = 'loft'; this.phaseT = 0; }
        if (input.hit('Escape') || input.hit('Backspace')) { this.phase = 'aim'; this.phaseT = 0; }
        break;
      }

      case 'loft':
        if (input.held('ArrowUp')) this.loft += 1.1 * dt;
        if (input.held('ArrowDown')) this.loft -= 1.1 * dt;
        this.loft = clamp(this.loft, 0.17, 1.05);
        if (input.hit('Enter') || input.hit(' ')) {
          this.phase = 'power'; this.phaseT = 0; this.power = 0; this.powerDir = 1;
          this.sweetSpot = this.training ? null : rnd(0.5, 0.92);
          this.sweetWidth = 0.045 + (this._sweetBonus || 0);
        }
        if (input.hit('Escape') || input.hit('Backspace')) { this.phase = 'spin'; this.phaseT = 0; }
        break;

      case 'power': {
        const prof = this.throwProfile();
        this.power += this.powerDir * prof.barSpeed * dt;
        if (this.power >= 1) { this.power = 1; this.powerDir = -1; }
        if (this.power <= 0) { this.power = 0; this.powerDir = 1; }
        if (input.hit('Enter') || input.hit(' ')) {
          const abueloState = this.roster.get(this.abuelo);
          const st = abueloState.st;
          const faultChance = this.training ? 0 : Math.max(0, (25 - st) / 25) * 0.12;
          if (Math.random() < faultChance) {
            // un tropiezo de cansancio puede quedarse en susto (bola nula) o
            // ir a más si el abuelo ya viene muy fatigado o mayor: una
            // lesión de verdad, que le pasa factura el resto del partido y
            // le deja de baja unos días (se resuelve al terminar la partida)
            // continuo en vez de dos escalones fijos: cuanto menos STA le
            // queda y cuantos más años tiene, más suave pero más real crece
            // el riesgo (antes era +0.10 de golpe bajo 15 STA y +0.08 de
            // golpe a partir de 75 años, con un salto seco en ambos casos)
            const injuryChance = Math.max(0, (25 - st) / 250) + Math.max(0, abueloState.age - 70) * 0.01;
            if (!this.training && !this.injuryEvent && Math.random() < injuryChance) {
              this.injuryEvent = { id: this.abuelo, name: this._nameOf(this.abuelo) };
              abueloState.st = Math.max(0, abueloState.st - 20);
              this.narr = `¡SE HA RESENTIDO! ${this._nameOf(this.abuelo)} se dobla al pisar el círculo, cansado. Sigue cojeando, pero sigue en pie.`;
              this.chronicle.push({ t: 'lesion', data: { name: this._nameOf(this.abuelo) } });
            } else {
              this.narr = `¡FALTA DE PIE! ${this._nameOf(this.abuelo)} pisa el círculo del cansancio que lleva. Bola nula.`;
            }
            this.ballsLeftP--; this.teamPTurn++;
            this.phase = 'throwDone'; this.phaseT = 0;
            this.lastCollision = false; this.lastWasFault = true;
            break;
          }
          const sweet = this.sweetSpot !== null && Math.abs(this.power - this.sweetSpot) < this.sweetWidth;
          const residual = sweet ? 0.35 : 0.55;
          this.throwBall('P', this.aimAngle + (this.jitterA || 0) + gauss() * prof.shake * residual,
            clamp(this.power + (this.jitterP || 0) * 0.01 + gauss() * prof.shake * residual, 0.03, 1),
            this.spin, this.loft);
          break;
        }
        if (input.hit('Escape') || input.hit('Backspace')) { this.phase = 'loft'; this.phaseT = 0; }
        break;
      }

      case 'aiTurn':
        if (this.phaseT > 1.1) {
          const p = AIPlayer.throwParams(this);
          this.throwBall('A', p.angle, p.power, p.spin, p.loft);
        }
        break;

      case 'sim': {
        const treeHit = () => { this.narr = '¡A las ramas del plátano! La bola cae muerta entre hojas.'; };
        const frame = this._frame || 0;
        let landed = false;
        const onLand = () => { landed = true; };
        const c1 = physicsWorld.step(this.allBalls(), dt, this.court, this.weather, treeHit, this.trail, this.lastThrown, frame, onLand);
        const c2 = physicsWorld.step(this.allBalls(), dt, this.court, this.weather, treeHit, this.trail, this.lastThrown, frame, onLand);
        this.lastCollision = c1 || c2;
        this.lastLanded = landed;
        if (!this.anyMoving()) {
          const lt = this.lastThrown;
          // plomada: bombeo alto (globo) que cae y se queda casi muerta
          // pegada al boliche — el bombeo por fin tiene una recompensa
          // visible, no solo "elige cualquier valor intermedio" (ver _tallyThrowXp)
          const isPlomada = !!(lt && lt.owner === 'P' && this.jack && (lt.loft || 0) > 0.75 && dist2d(lt.x, lt.y, this.jack.x, this.jack.y) < 2);
          if (lt && lt.retroHit) {
            this.narr = Narrator.line('retro', {});
            if (!this.training) this.chronicle.push({ t: 'retro', data: {} });
          } else if (isPlomada) {
            this.narr = Narrator.line('plomada', {});
            if (!this.training) this.chronicle.push({ t: 'plomada', data: {} });
          } else if (this.lastCollision) this.narr = Narrator.line('golpe', {});
          this.phase = 'throwDone'; this.phaseT = 0;
        }
        break;
      }

      case 'throwDone': {
        const canTimeout = !this.training && !this.lastWasFault && this.lastThrown && this.lastThrown.owner === 'P' &&
          this.tournament && this.tournament.timeouts > 0 && !this.timeoutUsedThisThrow;
        if (canTimeout && (input.hit('x') || input.hit('X'))) {
          this.balls.pop();
          this.ballsLeftP++; this.teamPTurn--;
          this.tournament.timeouts--;
          this.timeoutUsedThisThrow = true;
          this.narr = `${this._nameOf(this.abuelo)} pide tiempo muerto y repite el tiro. Ya no quedan para este torneo.`;
          this.pickThrower();
          this.phase = 'aim'; this.phaseT = 0; this.spin = 0; this.loft = 0.6; this.role = 'apuntar';
          break;
        }
        if (this.phaseT < (canTimeout ? 2.4 : 0.7)) break;

        if (this.twinJacks && this.balls.length === 1) {
          const b0 = this.balls[0];
          const d1 = dist2d(b0.x, b0.y, this.jack.x, this.jack.y);
          const d2 = dist2d(b0.x, b0.y, this.jack2.x, this.jack2.y);
          if (d2 < d1) this.jack = this.jack2;
          this.narr = `Primer tiro: se queda con el boliche ${d2 < d1 ? 'de la derecha' : 'de la izquierda'}. El otro ya no cuenta.`;
          this.jack2 = null; this.twinJacks = false;
        }

        // ARRIME/EFECTO/PRESIÓN/FONDO comparten la misma fórmula de arrime
        // (10-distancia por bola, hasta el objetivo del drill); solo TIRO
        // (más abajo) puntúa por derribos en vez de por cercanía. EFECTO
        // además puede "bloquear" la bola si choca con la que corta la
        // línea recta (hay que rodearla con efecto) — se detecta con
        // wasHit, reseteado cada tiro para no arrastrar el choque anterior.
        if (this.training && this.training !== 'TIRO') {
          const drill = drillFor(this.training);
          const obstacle = this.training === 'EFECTO' ? this.balls.find((b) => b.owner === 'T') : null;
          const blocked = !!(obstacle && obstacle.wasHit);
          if (obstacle) obstacle.wasHit = false;
          if (blocked) {
            this.narr = '¡Choque con la bola que bloquea! No cuenta esta bola.';
          } else {
            const d = dist2d(this.lastThrown.x, this.lastThrown.y, this.jack.x, this.jack.y);
            const gained = Math.max(0, Math.round(10 - d));
            this.score += gained;
            this.narr = gained > 6 ? `${GOOD_THROW_FLAVOR[this.training]} +${gained} puntos.`
              : gained > 0 ? `Se queda a ${d.toFixed(1)} pasos. +${gained} puntos.`
              : 'Demasiado lejos. Eso no puntúa.';
          }
          // si quedan más bolas, el obstáculo vuelve a su sitio de partida:
          // debe cortar la línea recta en TODAS las tiradas del drill, no
          // solo en la primera (si no, tras el primer golpe quedaría
          // apartado y el resto de bolas ya no tendrían nada que rodear)
          if (obstacle && this.ballsLeftP > 0) {
            obstacle.x = obstacle.ox; obstacle.y = obstacle.oy;
            obstacle.vx = 0; obstacle.vy = 0; obstacle.vz = 0; obstacle.z = 0; obstacle.moving = false;
          }
          if (this.ballsLeftP === 0) { this.success = this.score >= drill.target; this.phase = 'trainEnd'; this.phaseT = 0; }
          else { this.phase = 'aim'; this.phaseT = 0; }
          break;
        }
        if (this.training === 'TIRO') {
          // cuenta un impacto real (physicsWorld marca wasHit al aplicar el
          // golpe), no solo si la bola acabó lejos de su sitio — con la
          // fricción de la pista, un golpe de verdad puede frenarla cerca
          // de donde estaba y antes no contaba como derribada
          const hits = this.balls.filter((b) => b.owner === 'T' && b.wasHit).length;
          if (hits > this.targetsHit) this.narr = '¡PIM! Bola vieja derribada.';
          this.targetsHit = hits;
          if (hits >= 3 || this.ballsLeftP === 0) { this.success = hits >= 3; this.phase = 'trainEnd'; this.phaseT = 0; }
          else { this.phase = 'aim'; this.phaseT = 0; }
          break;
        }

        const t = this.nextTurn();
        if (t === null) {
          const pB = this.bestBall('P'), aB = this.bestBall('A');
          const tight = pB && aB && Math.abs(pB.d - aB.d) < 1.0;
          if (tight && !this.measured) {
            this.measured = true;
            this.measureBalls = { p: pB.b, a: aB.b, pd: pB.d, ad: aB.d };
            this.chronicle.push({ t: 'medicion', data: {} });
            this.phase = 'measuring'; this.phaseT = 0;
            break;
          }
          this.resolveMano();
        } else {
          this.turn = t;
          this.pairMoment = false;
          if (t === 'P') {
            const prevThrower = this.lastThrown && this.lastThrown.owner === 'P' ? this.lastThrown.thrower : null;
            this.pickThrower();
            // momento de pareja: el compañero (no uno mismo) acaba de dejar
            // la bola muy cerca del boliche, y hay vínculo de verdad entre
            // los dos (ver domain/Chemistry.js) — un extra puntual solo
            // para este próximo tiro, no acumulable con el siguiente
            if (prevThrower !== null && prevThrower !== this.abuelo && this.teamP.includes(prevThrower)) {
              const lvl = chemistryLevel(gamesFor(this.chemistry, prevThrower, this.abuelo));
              if (lvl >= 2 && dist2d(this.lastThrown.x, this.lastThrown.y, this.jack.x, this.jack.y) < 3) {
                this.pairMoment = true;
                this.narr = `${this._nameOf(prevThrower)} deja la bola a huevo: ${this._nameOf(this.abuelo)} tira con la confianza de la pareja.`;
              }
            }
          }
          this.phase = t === 'P' ? 'aim' : 'aiTurn';
          this.phaseT = 0; this.spin = 0; this.role = 'apuntar';
        }
        break;
      }

      case 'measuring':
        if (this.phaseT > 1.8) this.resolveMano();
        break;

      case 'roundEnd':
        if (this.phaseT > 1.2 && (input.hit('Enter') || input.hit(' '))) { this.round++; this._startRound(false); }
        break;

      case 'trainEnd':
        if (this.phaseT > 0.8 && (input.hit('Enter') || input.hit(' '))) {
          // en modo Practicar no hay premio de stat (ver Game.startPractice):
          // el único registro que queda es la marca personal (dailyBest),
          // que se guarda fuera de Match.js porque vive en Player, no en Roster
          if (this.success && !this.practice) {
            const k = drillFor(this.training).stat;
            const mentorBonus = this.roster.mentorBonusFor ? this.roster.mentorBonusFor(this.abuelo, k) : 0;
            this.roster.get(this.abuelo).train(k, (this._trainBonus || 1) + mentorBonus);
          }
          this._finished = true;
        }
        break;

      case 'matchEnd':
        if (this.phaseT > 1.2 && (input.hit('Enter') || input.hit(' '))) {
          const won = this.scoreP >= this.target;
          if (won && this._worstDeficit >= 2) this.chronicle.push({ t: 'remontada', data: this._worstDeficitScores });
          if (this._maxStreakSeen >= 3) this.chronicle.push({ t: 'racha', data: { streak: this._maxStreakSeen } });
          for (const id of this.teamP) {
            const a = ABUELO_DATA[id];
            const s = this.roster.get(id);
            const cost = (45 - a.stats.aguante * 2) / this.teamP.length;
            s.st = clamp(s.st - cost, 0, 100);
            s.recordMatchResult(won, won ? Math.abs(this.scoreP - this.scoreA) : null);
            if (won) s.addMoral(3); else s.addMoral(-4);
          }
          this.tournament.recordRoundResult(won, this.scoreP, this.scoreA, this.teamP.slice());
          this._finished = true;
          this._won = won;
        }
        break;
    }
  }

  tickFrame(frame) { this._frame = frame; }
}

function roundFlavor(stage) {
  return ['Los cuartos: pocas gradas y mucho orgullo.',
    'Semifinal: en el bar ya se habla de vosotros.',
    '¡LA FINAL! Hasta el alcalde ha venido.'][stage];
}

function r_changeProb(t) { return t.currentRound.forecast.changeProb; }
