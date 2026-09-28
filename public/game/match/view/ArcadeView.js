// Vista ARCADE del partido (docs/REDISENO.md, Fase 3): pista en perspectiva
// detrás del lanzador + minimapa cenital + HUD de videojuego, y una forma
// nueva de tirar — señalas en el suelo dónde quieres que vaya, mantienes
// pulsado (la barra de potencia oscila como siempre: Temple y cansancio
// deciden su velocidad) y sueltas en el momento justo. El teclado sigue
// valiendo entero: ↑↓ apuntar, ←→ efecto, [TAB] tipo de tiro, [ENTER]
// empezar potencia y [ENTER] soltar.
//
// No cambia ninguna regla: todo acaba en los mismos métodos de Match
// (beginPower/release, y ENTER sintético para el boliche y las pausas),
// así que el partido se juega igual que con la vista clásica.
import { CW, CH, THROW_X, BALL_R, JACK_R, ballsPerPlayer } from '../../physics/constants.js';
import { dist2d } from '../../core/utils.js';
import { CLIMAS, isRainy } from '../../data/climas.js';
import { STAT_KEYS, ABUELO_DATA } from '../../data/abuelos.js';
import { drillFor } from '../../data/trainingDrills.js';
import { CONSUMABLES, CONSUMABLE_IDS, MAX_CONSUMABLES_PER_MATCH } from '../../data/consumables.js';
import { clamp } from '../../core/utils.js';
import { Settings } from '../../core/Settings.js';
import { UI, TONE, STAT, SHOT, WEATHER_FX, tint } from '../../ui/theme.js';
import { panel, statChip, segments, badge } from '../../ui/widgets.js';
import { Camera } from './Camera.js';
import { PerspectiveCourt } from './PerspectiveCourt.js';

const FONT = '"Menlo", "Consolas", "DejaVu Sans Mono", monospace';
const VIEW_TOP = 4, VIEW_BOTTOM = 37; // filas de la vista 3D (incluidas)
const SHOT_ORDER = ['arrimar', 'media', 'bombeo', 'tirar', 'bloquear'];
const SHOTS = { ...SHOT, bloquear: { glyph: '▮', color: '#c8a0e8', label: 'BLOQUEAR', role: 'bloquear', loft: 0.45, hint: 'corto y preciso: estorba al rival' } };
const AIM_PHASES = ['aim', 'spin', 'loft', 'power'];

export class ArcadeView {
  constructor(game) {
    this.game = game;
    this.cam = new Camera();
    this.court = new PerspectiveCourt();
    this.shot = 'media';
    this._match = null;
    this._lastMouse = { fx: -1, fy: -1 };
    this._t = 0;
  }

  // cámara lenta: factor de tiempo para Match.update (solo la vista arcade;
  // lo pide _juice en los choques). Nunca con "reducir movimiento".
  timeScale(dt) {
    if (!this._slow || Settings.get('reduceMotion')) return 1;
    this._slow = Math.max(0, this._slow - dt);
    return this._slow > 0 ? 0.3 : 1;
  }

  // Visibilidad con niebla/lluvia/tormenta: MISMA regla que la vista
  // clásica (MatchScreen._drawBalls) — más allá de cierta distancia las
  // bolas solo se ven a ratos, y con niebla el boliche no se ve hasta que
  // alguien lo destapa; el abuelo inmune a ese clima lo ve todo. Es
  // información de juego: se aplica también al minimapa.
  _visibility(M, frame) {
    const rainFog = isRainy(M.weather.type) || M.weather.type === 'NIEBLA' || M.weather.type === 'TORMENTA';
    const s = M.roster.get(M.abuelo);
    const immune = s.hasImmunity(isRainy(M.weather.type) || M.weather.type === 'TORMENTA' ? 'LLUVIA' : M.weather.type);
    const fogFrom = immune ? 999
      : M.weather.type === 'NIEBLA' ? 32
      : M.weather.type === 'TORMENTA' ? 40
      : ABUELO_DATA[M.abuelo] && ABUELO_DATA[M.abuelo].clima.LLUVIA === -1 ? 45 : 70;
    return (b) => {
      if (M.weather.type === 'NIEBLA' && b === M.jack && !M.jackRevealed && !immune) return frame % 24 < 2;
      if (!rainFog || b.x < fogFrom || (b === M.lastThrown && b.moving)) return true;
      return frame % 8 < 3;
    };
  }

  // --- estado por partido ---
  _reset(M) {
    this._match = M;
    this.shot = 'media';
    this._applyShot(M);
    this.cam.direct(M); this.cam.snap();
    this._prev = { phase: M.phase, landed: false, coll: false, round: M.round, sweet: false };
    this._holding = false;
  }

  _applyShot(M) {
    const s = SHOTS[this.shot];
    M.loft = s.loft;
    M.role = s.role;
  }

  // Traduce ratón/teclado a lo que entiende Match. Devuelve la entrada que
  // se le pasa a Match.update este frame (con teclas filtradas/sintéticas).
  input(dt) {
    const { match: M, input } = this.game;
    if (M !== this._match) this._reset(M);
    const mouse = input.mouse;
    const synth = new Set();
    const block = new Set();
    const inView = mouse.inside && mouse.cy >= VIEW_TOP && mouse.cy <= VIEW_BOTTOM;
    // ¿empezó la pulsación dentro de la vista? (para no lanzar al pulsar un botón)
    if (!mouse.down) this._pressStartedInView = false;
    else if (!this._wasDown) this._pressStartedInView = inView;
    this._wasDown = mouse.down;
    const moved = mouse.fx !== this._lastMouse.fx || mouse.fy !== this._lastMouse.fy;
    this._lastMouse = { fx: mouse.fx, fy: mouse.fy };
    const prof = AIM_PHASES.includes(M.phase) && !M.training ? M.throwProfile() : (AIM_PHASES.includes(M.phase) ? M.throwProfile() : null);

    // apuntar señalando el suelo (boliche y bola)
    if (inView && moved && (AIM_PHASES.includes(M.phase) || M.phase === 'jackAim' || M.phase === 'jackPower')) {
      const R = this.game.renderer;
      if (R) {
        const g = this.cam.unproject(R.ox + mouse.fx * R.cw, R.oy + mouse.fy * R.ch);
        if (g && g.x > THROW_X + 3) {
          const lim = M.phase.startsWith('jack') ? 0.5 : 0.55;
          M.aimAngle = clamp(Math.atan2(g.y - CH / 2, g.x - THROW_X), -lim, lim);
          this.target = { x: Math.min(CW, g.x), y: clamp(g.y, 0, CH) };
        }
      }
    }

    if (M.phase === 'aim' && M.turn === 'P') {
      // efecto con ←/→ o rueda, tipo de tiro con TAB o clic en las fichas
      const spinMax = prof ? prof.spinMax : 0.6;
      if (input.held('ArrowLeft')) M.spin -= 1.6 * dt;
      if (input.held('ArrowRight')) M.spin += 1.6 * dt;
      if (input.wheel) M.spin += input.wheel * 0.08;
      M.spin = clamp(M.spin, -spinMax, spinMax);
      if (input.hit('Tab')) { this.shot = SHOT_ORDER[(SHOT_ORDER.indexOf(this.shot) + 1) % SHOT_ORDER.length]; this._applyShot(M); }
      if (this._clickedShot) { this.shot = this._clickedShot; this._applyShot(M); this._clickedShot = null; }
      // empezar la potencia: ENTER/ESPACIO, o mantener pulsado en la vista
      block.add('Enter'); block.add(' '); block.add('r'); block.add('R');
      if (input.hit('Enter') || input.hit(' ')) M.beginPower();
      else if (inView && mouse.down && !this._holding && this._pressStartedInView) { M.beginPower(); this._holding = true; }
    } else if (M.phase === 'power' && M.turn === 'P') {
      block.add('Escape'); block.add('Backspace');
      if (input.hit('Escape') || input.hit('Backspace')) { M.phase = 'aim'; M.phaseT = 0; this._holding = false; }
      if (this._holding && !mouse.down) { synth.add('Enter'); this._holding = false; }
    } else if (M.phase === 'jackAim') {
      block.add('Enter'); block.add(' ');
      if (input.hit('Enter') || input.hit(' ') || (inView && mouse.down && this._pressStartedInView && !this._holding)) {
        M.phase = 'jackPower'; M.phaseT = 0; M.power = 0; M.powerDir = 1;
        this._holding = mouse.down;
      }
    } else if (M.phase === 'jackPower') {
      if (this._holding && !mouse.down) { synth.add('Enter'); this._holding = false; }
    } else {
      this._holding = false;
      // clic = ENTER en las pausas (inicio de mano, tras el tiro, fin de mano...)
      if (mouse.clicked && inView) synth.add('Enter');
    }

    return {
      hit: (k) => synth.has(k) || (!block.has(k) && input.hit(k)),
      held: (k) => !block.has(k) && input.held(k),
      mouse: input.mouse,
    };
  }

  // efectos ligados a lo que acaba de pasar en el partido
  _juice(M) {
    const { fx, renderer: R } = this.game;
    const prev = this._prev || {};
    const toCell = (b) => (b && b._screen && R ? { x: (b._screen.x - R.ox) / R.cw, y: (b._screen.y - R.oy) / R.ch } : null);
    if (M.lastLanded && !prev.landed && M.lastThrown) {
      const c = toCell(M.lastThrown);
      if (c) fx.burst(c.x, c.y, { n: 16, colors: ['#c9b98a', '#a89868', '#e8d8a8'], speed: 7, gravity: 12, life: 0.6, angle: -Math.PI / 2, spread: Math.PI * 1.2 });
    }
    if (M.lastCollision && !prev.coll && M.lastThrown) {
      const c = toCell(M.lastThrown);
      if (c) fx.burst(c.x, c.y, { n: 26, colors: ['#fff3c4', '#ffe14d', '#ffffff'], speed: 14, gravity: 10, life: 0.5 });
      fx.shake(0.7);
    }
    // foto de la pista justo al soltar, para leer la jugada al pararse todo
    if (M.phase === 'sim' && prev.phase !== 'sim') {
      this._snap = { thrown: M.lastThrown, balls: M.balls.filter((b) => b !== M.lastThrown).map((b) => ({ b, x: b.x, y: b.y })), jack: M.jack ? { x: M.jack.x, y: M.jack.y } : null };
    }
    if (M.phase === 'throwDone' && prev.phase === 'sim' && this._snap) { this._readPlay(M, this._snap); this._snap = null; }
    if (M.lastCollision && !prev.coll) this._slow = 0.55;
    if (M.phase === 'sim' && prev.phase === 'power' && M.lastReleaseSweet) {
      fx.float(70, 30, '¡PUNTO DULCE!', TONE.gold, { size: 1.6, life: 1 });
      fx.flash('#ffe14d', 0.12, 0.2);
    }
    if (M.phase === 'roundEnd' && prev.phase !== 'roundEnd' && M.lastWinner) {
      const mine = M.lastWinner === 'P';
      fx.banner(mine ? `¡+${M.lastPoints} PARA TI!` : `+${M.lastPoints} PARA ${M.rival.split(' ')[0]}`, mine ? TONE.good : TONE.rival, { life: 1.8, size: 3.2 });
      if (mine) fx.burst(70, 20, { n: 40, colors: [TONE.gold, TONE.good, '#ffffff'], speed: 18, life: 1 });
    }
    if (M.phase === 'matchEnd' && prev.phase !== 'matchEnd' && !M.training) {
      const won = M.scoreP >= M.target;
      fx.banner(won ? '¡VICTORIA!' : 'DERROTA', won ? TONE.gold : TONE.bad, { life: 3, size: 4.5, sub: `${M.scoreP} - ${M.scoreA}` });
      if (won) { fx.burst(40, 20, { n: 60, colors: [TONE.gold, '#ffffff', TONE.good], speed: 22, life: 1.4 }); fx.burst(100, 20, { n: 60, colors: [TONE.gold, '#ffffff', TONE.player], speed: 22, life: 1.4 }); }
    }
    this._prev = { phase: M.phase, landed: !!M.lastLanded, coll: !!M.lastCollision, round: M.round };
  }

  // ¿qué ha pasado en esta tirada? carreau (tu bola se queda donde estaba
  // la que ha sacado), biberón (pegada al boliche), boliche movido
  _readPlay(M, snap) {
    const { fx } = this.game;
    const t = snap.thrown;
    if (!t) return;
    const mine = t.owner === 'P';
    const col = mine ? TONE.gold : TONE.rival;
    const who = mine ? '' : ` DE ${M.rival.split(' ')[0]}`;
    for (const o of snap.balls) {
      if (o.b.owner === t.owner || o.b.owner === 'J' || o.b.owner === 'J2') continue;
      const moved = dist2d(o.x, o.y, o.b.x, o.b.y);
      if (moved > 4 && dist2d(t.x, t.y, o.x, o.y) < 2.2) {
        fx.banner(`¡CARREAU${who}!`, col, { sub: mine ? 'la tuya se queda justo donde estaba la del rival' : 'te ha sacado la bola y se ha quedado en su sitio', life: 2.2 });
        if (mine) fx.burst(70, 22, { n: 50, colors: [TONE.gold, '#ffffff', TONE.player], speed: 20, life: 1.1 });
        fx.shake(1.2);
        return;
      }
    }
    if (snap.jack && M.jack && dist2d(snap.jack.x, snap.jack.y, M.jack.x, M.jack.y) > 3) {
      fx.banner('¡BOLICHE MOVIDO!', TONE.jack, { sub: 'la mano cambia de sitio', life: 1.8, size: 3 });
      return;
    }
    if (M.jack && dist2d(t.x, t.y, M.jack.x, M.jack.y) < BALL_R + JACK_R + 0.35) {
      fx.banner(`¡BIBERÓN${who}!`, col, { sub: 'pegada al boliche', life: 1.8, size: 3.2 });
      if (mine) fx.burst(70, 24, { n: 30, colors: [TONE.gold, '#ffffff'], speed: 14, life: 0.9 });
    }
  }

  // --- dibujo ---
  draw(dt) {
    const { screen, match: M, frame } = this.game;
    if (M !== this._match) this._reset(M);
    this._t += dt || 1 / 60;
    this.cam.direct(M);
    this.cam.update(dt || 1 / 60, Settings.get('reduceMotion'));
    screen.clear();

    const vis = this._visibility(M, frame);
    this._vis = vis;
    // escena 3D + minimapa en la capa de píxeles, por debajo del texto
    screen.layer('under', (ctx, R) => {
      const x0 = R.cx(0), y0 = R.cy(VIEW_TOP), x1 = R.cx(screen.cols), y1 = R.cy(VIEW_BOTTOM + 1);
      this.cam.setView(x0, y0, x1 - x0, y1 - y0);
      this.court.draw(ctx, this.cam, M, this._t, vis);
      this._drawThrower(ctx, R, M);
      this._drawAimOverlay(ctx, R, M);
      this._drawMinimap(ctx, R, M);
      this._drawWind(ctx, R, M);
      // franja para la narración
      const ny = R.cy(VIEW_BOTTOM - 1);
      const g = ctx.createLinearGradient(0, ny - R.ch, 0, y1);
      g.addColorStop(0, 'rgba(8,10,14,0)'); g.addColorStop(1, 'rgba(8,10,14,0.85)');
      ctx.fillStyle = g; ctx.fillRect(x0, ny - R.ch, x1 - x0, y1 - ny + R.ch);
    });
    screen.layer('over', (ctx, R) => this._drawScore(ctx, R, M));

    this._drawTopHud(M);
    this._drawViewTexts(M, frame);
    this._drawDeck(M, frame);
    this._juice(M);
  }

  _drawTopHud(M) {
    const { screen } = this.game;
    screen.fill(0, 0, screen.cols, 4, '#0d121b');
    // franja del color de quien tira, en el borde inferior del HUD
    for (let i = 0; i < screen.cols; i++) screen.put(i, 3, '▔', M.turn === 'P' ? TONE.player : TONE.rival);
    const s = M.roster.get(M.abuelo);
    const name = this.game.displayName(M.abuelo);
    screen.text(2, 0, name.toUpperCase(), TONE.player);
    if (M.turn === 'P') screen.glow(2, 0, name.length, 1);
    const teamSize = M.teamP.length;
    const drill = M.training ? drillFor(M.training) : null;
    const ballCount = drill ? drill.balls : ballsPerPlayer(teamSize) * teamSize;
    screen.text(2, 1, '●'.repeat(M.ballsLeftP) + '○'.repeat(Math.max(0, ballCount - M.ballsLeftP)), TONE.player);
    let x = 2;
    for (const k of STAT_KEYS) x += statChip(screen, x, 2, k, s.getStat(k)) + 1;
    const st = Math.round(s.st);
    screen.text(x + 1, 2, 'STA', UI.textDim);
    segments(screen, x + 5, 2, 10, Math.round(st / 10), { color: st > 60 ? TONE.good : st > 30 ? TONE.warn : TONE.bad });

    if (M.training) {
      const lbl = `${M.practice ? 'PRÁCTICA' : 'ENTRENO'} · ${drill.label}`;
      screen.text(screen.cols - lbl.length - 2, 0, lbl, '#88c8e8');
      const goal = drill.hits ? `DERRIBADAS ${M.targetsHit}/${drill.target}` : `PUNTOS ${M.score}/${drill.target}`;
      screen.text(screen.cols - goal.length - 2, 1, goal, UI.accentHi);
    } else {
      const rname = `${M.rival} [NIV.${M.aiLevel}]`;
      screen.text(screen.cols - rname.length - 2, 0, rname, TONE.rival);
      if (M.turn === 'A') screen.glow(screen.cols - rname.length - 2, 0, rname.length, 1);
      const rb = ballsPerPlayer(teamSize) * teamSize;
      const balls = '●'.repeat(M.ballsLeftA) + '○'.repeat(Math.max(0, rb - M.ballsLeftA));
      screen.text(screen.cols - balls.length - 2, 1, balls, TONE.rival);
      const place = `${M.city.name}`;
      screen.text(screen.cols - place.length - 2, 2, place, M.city.color || UI.textDim);
    }
  }

  // marcador grande en píxeles (entre los dos bandos)
  _drawScore(ctx, R, M) {
    if (M.training) return;
    const cx = R.W / 2, cy = R.cy(1.25);
    // el número que acaba de cambiar "salta" y brilla un momento
    if (!this._score || this._score.p !== M.scoreP || this._score.a !== M.scoreA) {
      const prevS = this._score;
      this._score = { p: M.scoreP, a: M.scoreA, tp: prevS && prevS.p !== M.scoreP ? this._t : -9, ta: prevS && prevS.a !== M.scoreA ? this._t : -9 };
    }
    const pop = (t0) => { const k = (this._t - t0) / 0.6; return k >= 0 && k < 1 ? 1 + Math.sin(k * Math.PI) * 0.45 : 1; };
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const big = (txt, x, col, s) => {
      ctx.font = `bold ${R.ch * 2.3 * s}px ${FONT}`;
      ctx.shadowBlur = R.ch * 0.8 * s; ctx.shadowColor = col; ctx.fillStyle = col;
      ctx.fillText(txt, x, cy);
    };
    big(String(M.scoreP), cx - R.cw * 5, TONE.player, pop(this._score.tp));
    big(String(M.scoreA), cx + R.cw * 5, TONE.rival, pop(this._score.ta));
    ctx.shadowBlur = 0;
    ctx.fillStyle = UI.textDim;
    ctx.font = `bold ${R.ch * 1.4}px ${FONT}`;
    ctx.fillText('·', cx, cy);
    ctx.font = `${R.fontPx}px ${FONT}`;
    ctx.fillText(`MANO ${M.round} · A ${M.target}`, cx, R.cy(2.75));
  }

  _drawViewTexts(M, frame) {
    const { screen } = this.game;
    const cl = CLIMAS[M.weather.type];
    const chip = `${cl.icon} ${cl.label}`;
    badge(screen, 2, VIEW_TOP + 1, chip, cl.color);
    (WEATHER_FX[M.weather.type] || []).forEach((e, i) => screen.text(3, VIEW_TOP + 2 + i, `· ${e}`, UI.text));
    if (M.feature && M.city && M.city.feature && M.city.feature.label) screen.text(3, VIEW_TOP + 3 + (WEATHER_FX[M.weather.type] || []).length, `pista: ${M.city.feature.label}`, UI.textDim);

    const mid = Math.floor(screen.cols / 2);
    const say = (y, txt, col, glow = true) => { const x = mid - Math.floor(txt.length / 2); screen.text(x, y, txt, col); if (glow) screen.glow(x, y, txt.length, 1); };
    const ph = M.phase;
    if (ph === 'roundStart') say(VIEW_TOP + 6, `— MANO ${M.round} —`, UI.accentHi);
    else if (ph === 'aiTurn') say(VIEW_TOP + 2, `${M.rival.split('(')[0].trim()} se concentra...`, TONE.rival);
    else if ((ph === 'aim' || ph === 'jackAim') && M.turn === 'P' && frame % 40 < 28) say(VIEW_TOP + 2, ph === 'jackAim' ? '▶ LANZA EL BOLICHE ◀' : '▶ TE TOCA ◀', TONE.good);
    else if (ph === 'measuring' && M.measureBalls) {
      const mb = M.measureBalls;
      say(VIEW_TOP + 2, `📏 MIDIENDO · tú ${mb.pd.toFixed(2)} · rival ${mb.ad.toFixed(2)}`, UI.accentHi);
    } else if (ph === 'throwDone' && !M.training && !M.lastWasFault && M.lastThrown && M.lastThrown.owner === 'P' && M.tournament && M.tournament.timeouts > 0 && !M.timeoutUsedThisThrow) {
      say(VIEW_TOP + 2, `¿mal tiro? [X] tiempo muerto (quedan ${M.tournament.timeouts})`, frame % 20 < 14 ? UI.accentHi : UI.accent, false);
    }
    if (M.narr) {
      const n = `» ${M.narr}`;
      screen.text(3, VIEW_BOTTOM, n.slice(0, screen.cols - 6), '#d8c89a');
    }
  }

  // cubierta inferior: tipos de tiro, efecto, potencia, ayuda de controles
  _drawDeck(M, frame) {
    const { screen, input, player } = this.game;
    const y0 = VIEW_BOTTOM + 1;
    screen.fill(0, y0, screen.cols, screen.rows - y0, '#0d121b');
    for (let i = 0; i < screen.cols; i++) screen.put(i, y0, '▄', '#1a2233');
    const ph = M.phase;
    const myTurn = M.turn === 'P';
    const aiming = myTurn && AIM_PHASES.includes(ph);

    // tipos de tiro (fichas clicables)
    let x = 2;
    screen.text(x, y0 + 1, 'TIRO', UI.textDim);
    x += 5;
    for (const id of SHOT_ORDER) {
      const s = SHOTS[id];
      const on = this.shot === id;
      const label = ` ${s.glyph} ${s.label} `;
      const over = aiming && input.mouse.cy === y0 + 1 && input.mouse.cx >= x && input.mouse.cx < x + label.length;
      screen.fill(x, y0 + 1, label.length, 1, on ? tint(s.color, 0.4) : over ? tint(s.color, 0.2) : '#151b27');
      screen.text(x, y0 + 1, label, on ? '#ffffff' : aiming ? s.color : UI.textFaint);
      if (on) screen.glow(x + 1, y0 + 1, label.length - 2, 1);
      if (over && input.mouse.clicked) this._clickedShot = id;
      x += label.length + 1;
    }
    screen.text(x + 1, y0 + 1, '[TAB]', UI.textFaint);
    const sh = SHOTS[this.shot];
    screen.text(2, y0 + 2, `${sh.hint}`, aiming ? sh.color : UI.textFaint);

    // efecto
    const prof = M.throwProfile();
    const spinMax = prof.spinMax || 0.6;
    screen.text(2, y0 + 4, 'EFECTO', UI.textDim);
    const w = 31, sx = 10;
    for (let i = 0; i < w; i++) screen.put(sx + i, y0 + 4, i === 15 ? '┼' : '─', UI.edgeDim);
    const pos = sx + 15 + Math.round((M.spin / spinMax) * 15);
    screen.put(pos, y0 + 4, '◆', STAT.mana.color);
    screen.glow(pos, y0 + 4, 1, 1);
    screen.text(sx + w + 1, y0 + 4, aiming ? '←/→·rueda' : '', UI.textFaint);
    const retro = !M.training && M.role === 'tirar' && Math.abs(M.spin) > spinMax * 0.5;
    if (retro) screen.text(2, y0 + 5, '¡efecto fuerte al TIRAR: si golpeas puede quedarse clavada (RETRO)!', UI.accent);

    // potencia (con ventana del punto dulce)
    const px = 64, pw = 44;
    screen.text(px - 9, y0 + 4, 'POTENCIA', UI.textDim);
    const power = ph === 'power' || ph === 'jackPower' ? M.power : 0;
    const inSweet = ph === 'power' && M.isSweet(M.power);
    screen.fill(px, y0 + 4, pw, 1, '#1c2230');
    for (let i = 0; i < pw; i++) {
      const k = i / pw;
      const sweet = ph === 'power' && M.sweetSpot !== null && Math.abs(k - M.sweetSpot) < M.sweetWidth;
      if (sweet) {
        // el tramo del punto dulce: blanco dorado y con brillo, siempre visible
        screen.put(px + i, y0 + 4, k <= power ? '█' : '▒', '#fff2b0');
        screen.glow(px + i, y0 + 4, 1, 1, TONE.gold);
      } else if (k <= power) screen.put(px + i, y0 + 4, '█', k < 0.4 ? '#5fae4a' : k < 0.75 ? '#d88a3a' : '#d84a3a');
    }
    // marcas ▼ encima del tramo dorado
    if (ph === 'power' && M.sweetSpot !== null) {
      screen.put(px + Math.round((M.sweetSpot - M.sweetWidth) * pw), y0 + 3, '▾', TONE.gold);
      screen.put(px + Math.round((M.sweetSpot + M.sweetWidth) * pw) - 1, y0 + 3, '▾', TONE.gold);
    }
    if (inSweet) screen.text(px + pw + 2, y0 + 4, '¡DENTRO!', TONE.gold);
    else if (ph === 'power' || ph === 'jackPower') screen.text(px + pw + 2, y0 + 4, `${Math.round(M.power * 100)}%`, UI.text);

    // controles según fase
    const help = ph === 'aim' ? 'SEÑALA en la pista · MANTÉN pulsado y SUELTA en el punto dulce   ·   teclado: ↑↓ apuntar · ENTER potencia · ENTER soltar'
      : ph === 'power' ? '¡SUELTA! (o ENTER) cuando la barra pase por el tramo dorado   ·   [ESC] volver a apuntar'
      : ph === 'jackAim' ? 'BOLICHE: señala hacia dónde · MANTÉN y SUELTA para la distancia   ·   teclado: ↑↓ + ENTER'
      : ph === 'jackPower' ? 'BOLICHE: ¡suelta! (o ENTER) — corto ⟷ largo'
      : ph === 'roundStart' ? 'clic o ENTER: empezar la mano'
      : ph === 'roundEnd' ? 'clic o ENTER: siguiente mano'
      : ph === 'matchEnd' || ph === 'trainEnd' ? 'clic o ENTER: continuar'
      : ph === 'aiTurn' ? `turno de ${M.rival}` : '';
    screen.text(2, y0 + 7, help.slice(0, screen.cols - 4), myTurn ? UI.text : UI.textDim);

    // consumibles
    if (M.canUseConsumable()) {
      let cx = 112;
      screen.text(cx, y0 + 1, 'CONSUMIBLES', UI.textDim);
      let cy = y0 + 2;
      for (const id of CONSUMABLE_IDS) {
        const c = CONSUMABLES[id];
        const n = player.consumables[id] || 0;
        screen.text(cx, cy++, `[${c.hotkey}] ${c.short} ×${n}`, n > 0 ? UI.accentHi : UI.textFaint);
      }
      screen.text(cx, cy, `quedan ${MAX_CONSUMABLES_PER_MATCH - M.consumablesUsedThisMatch} uso(s)`, UI.textFaint);
    }
  }

  // el abuelo que tira, en trazo de tiza junto al círculo: boina, cara,
  // brazo que se echa atrás mientras cargas la potencia y se estira al
  // soltar. Del color del bando que tira. Solo en los planos de tiro.
  _drawThrower(ctx, R, M) {
    const cam = this.cam;
    if (!['aim', 'jack'].includes(cam.shot)) return;
    const mine = M.turn === 'P';
    const base = cam.project(THROW_X, -4, 0);
    if (!base) return;
    // tamaño fijo de "personaje" (a escala real, tan cerca de la cámara,
    // taparía media pista): ~28% del alto de la vista, anclado abajo
    const v = cam.view;
    const H = v.h * 0.28;
    const u = H / 15;
    const x = Math.max(v.x + v.w * 0.52, Math.min(v.x + v.w * 0.9, base.sx + v.w * 0.08));
    const y = v.y + v.h - R.ch * 0.6;
    const col = mine ? TONE.player : TONE.rival;
    const charge = M.phase === 'power' || M.phase === 'jackPower' ? M.power : 0;
    const thrown = M.phase === 'sim' || M.phase === 'jackSim';
    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = col; ctx.fillStyle = col;
    ctx.lineWidth = Math.max(2, u * 0.45); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.shadowColor = col; ctx.shadowBlur = u * 0.8;
    const hip = { x, y: y - H * 0.45 }, neck = { x: x + u * 0.6, y: y - H * 0.78 };
    // piernas (una adelantada, flexionada)
    ctx.beginPath(); ctx.moveTo(hip.x, hip.y); ctx.lineTo(x - u * 2.2, y); ctx.moveTo(hip.x, hip.y); ctx.lineTo(x + u * 2.4, y - H * 0.08); ctx.lineTo(x + u * 2.8, y); ctx.stroke();
    // tronco un poco inclinado
    ctx.beginPath(); ctx.moveTo(hip.x, hip.y); ctx.lineTo(neck.x, neck.y); ctx.stroke();
    // cabeza + boina
    const hr = H * 0.085;
    ctx.beginPath(); ctx.arc(neck.x + u * 0.3, neck.y - hr * 1.2, hr, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(neck.x + u * 0.3, neck.y - hr * 2.1, hr * 1.25, hr * 0.45, -0.15, 0, Math.PI * 2); ctx.fill();
    // brazo de tirar: atrás al cargar, adelante al soltar
    const a = thrown ? -0.5 : 0.9 + charge * 1.6;
    const sh = { x: neck.x, y: neck.y + u * 0.8 };
    const hand = { x: sh.x + Math.sin(a) * H * 0.34, y: sh.y + Math.cos(a) * H * 0.34 };
    ctx.beginPath(); ctx.moveTo(sh.x, sh.y); ctx.lineTo(hand.x, hand.y); ctx.stroke();
    if (!thrown) { ctx.beginPath(); ctx.arc(hand.x, hand.y, u * 0.9, 0, Math.PI * 2); ctx.fill(); }
    // brazo libre
    ctx.beginPath(); ctx.moveTo(sh.x, sh.y); ctx.lineTo(sh.x - u * 2.5, sh.y + H * 0.2); ctx.stroke();
    ctx.restore();
  }

  // retícula de destino, arco previsto (limitado por la guía) y punto de caída
  _drawAimOverlay(ctx, R, M) {
    const ph = M.phase;
    if (!(M.turn === 'P' && (AIM_PHASES.includes(ph) || ph === 'jackAim' || ph === 'jackPower'))) return;
    const cam = this.cam;
    const t = this._t;
    // retícula donde señalas
    if (this.target && (AIM_PHASES.includes(ph) || ph.startsWith('jack'))) {
      const p = cam.projectWorld(this.target.x, this.target.y);
      if (p) {
        const r = Math.max(6, p.s * 1.6);
        ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = Math.max(1, R.dpr * 1.5);
        ctx.beginPath(); ctx.ellipse(p.sx, p.sy, r, r * 0.35, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(p.sx - r * 1.4, p.sy); ctx.lineTo(p.sx - r * 0.6, p.sy); ctx.moveTo(p.sx + r * 0.6, p.sy); ctx.lineTo(p.sx + r * 1.4, p.sy); ctx.stroke();
      }
    }
    if (ph.startsWith('jack')) {
      // línea de dirección del boliche
      const a = cam.projectWorld(THROW_X + 2, CH / 2), b = cam.projectWorld(THROW_X + 60, CH / 2 + Math.sin(M.aimAngle) * 60);
      if (a && b) { ctx.strokeStyle = 'rgba(255,225,77,0.5)'; ctx.setLineDash([R.dpr * 6, R.dpr * 6]); ctx.lineWidth = R.dpr * 2; ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke(); ctx.setLineDash([]); }
      return;
    }
    // arco previsto: con la potencia actual (o una media al apuntar); solo
    // se ve el tramo que alcanza la guía del abuelo
    const power = ph === 'power' ? M.power : 0.55;
    const pr = PerspectiveCourt.predict(M, power);
    const jitter = (M.jitterA || 0);
    const steps = 36;
    for (let i = 1; i <= steps; i++) {
      const tt = (i / steps) * pr.T;
      const pt = pr.at(tt);
      const horiz = (pt.x - THROW_X);
      if (horiz > pr.guideDist) break;
      const q = cam.projectWorld(pt.x, pt.y + Math.sin(jitter) * horiz * 0.5, Math.max(0, pt.z) + 0.3);
      if (!q) continue;
      const hi = pt.z / Math.max(1, pr.vz * pr.vz / (2 * 26));
      ctx.fillStyle = `rgba(${hi > 0.5 ? '160,255,160' : '140,220,160'},${0.35 + 0.5 * (1 - i / steps)})`;
      const r = Math.max(1.5, q.s * (0.18 + hi * 0.12));
      ctx.beginPath(); ctx.arc(q.sx, q.sy, r, 0, Math.PI * 2); ctx.fill();
    }
    // punto de caída (solo con la barra en marcha, como siempre)
    if (ph === 'power') {
      const l = cam.projectWorld(pr.land.x, pr.land.y);
      if (l) {
        const r = Math.max(5, l.s * 1.1);
        const blink = 0.55 + 0.45 * Math.sin(t * 14);
        ctx.strokeStyle = M.isSweet(M.power) ? `rgba(255,210,74,${blink})` : `rgba(255,120,90,${blink})`;
        ctx.lineWidth = R.dpr * 2;
        ctx.beginPath(); ctx.moveTo(l.sx - r, l.sy - r * 0.35); ctx.lineTo(l.sx + r, l.sy + r * 0.35); ctx.moveTo(l.sx + r, l.sy - r * 0.35); ctx.lineTo(l.sx - r, l.sy + r * 0.35); ctx.stroke();
      }
    }
  }

  // minimapa cenital (arriba a la derecha de la vista): la lectura táctica
  _drawMinimap(ctx, R, M) {
    const v = this.cam.view;
    const w = Math.round(v.w * 0.26), h = Math.round(w * (44 / CW));
    const x0 = v.x + v.w - w - R.cw * 2, y0 = v.y + R.ch * 1;
    ctx.fillStyle = 'rgba(8,10,14,0.82)';
    ctx.fillRect(x0 - R.dpr * 6, y0 - R.dpr * 6, w + R.dpr * 12, h + R.dpr * 12);
    ctx.fillStyle = '#4a4428'; ctx.fillRect(x0, y0, w, h);
    ctx.strokeStyle = 'rgba(240,230,200,0.7)'; ctx.lineWidth = R.dpr; ctx.strokeRect(x0, y0, w, h);
    const X = (x) => x0 + (x / CW) * w, Y = (y) => y0 + (y / CH) * h;
    for (const pd of M.court.puddles || []) { ctx.fillStyle = 'rgba(60,110,150,0.8)'; ctx.beginPath(); ctx.ellipse(X(pd.x), Y(pd.y), (pd.r / CW) * w, (pd.r / 2 / CH) * h, 0, 0, Math.PI * 2); ctx.fill(); }
    if (M.court.tree) { const tr = M.court.tree; ctx.fillStyle = 'rgba(45,107,53,0.8)'; ctx.beginPath(); ctx.ellipse(X(tr.x), Y(tr.y), (tr.r / CW) * w, (tr.r / 2 / CH) * h, 0, 0, Math.PI * 2); ctx.fill(); }
    // campo de visión de la cámara
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(X(Math.max(0, this.cam.x)), y0, w - (X(Math.max(0, this.cam.x)) - x0), h);
    // dirección de tiro
    if (M.turn === 'P' && AIM_PHASES.includes(M.phase)) {
      ctx.strokeStyle = 'rgba(160,255,160,0.6)'; ctx.lineWidth = R.dpr;
      ctx.beginPath(); ctx.moveTo(X(THROW_X), Y(CH / 2)); ctx.lineTo(X(THROW_X + Math.cos(M.aimAngle) * 120), Y(CH / 2 + Math.sin(M.aimAngle) * 120)); ctx.stroke();
    }
    const dot = (b, col, r) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(X(b.x), Y(b.y), r, 0, Math.PI * 2); ctx.fill(); };
    const br = Math.max(3, w * 0.012);
    const vis = this._vis || (() => true);
    if (M.jack && M.training !== 'TIRO' && vis(M.jack)) dot(M.jack, TONE.jack, br * 0.8);
    for (const b of M.balls) if (vis(b)) dot(b, b.owner === 'P' ? TONE.player : b.owner === 'A' ? TONE.rival : '#c9c2a8', br);
    // quién manda: anillo en la bola más cercana
    const p = M.bestBall && M.bestBall('P'), a = M.bestBall && M.bestBall('A');
    const lead = p && a ? (p.d < a.d ? p.b : a.b) : p ? p.b : a ? a.b : null;
    if (lead && vis(lead) && (!M.jack || vis(M.jack))) { ctx.strokeStyle = TONE.gold; ctx.lineWidth = R.dpr * 1.5; ctx.beginPath(); ctx.arc(X(lead.x), Y(lead.y), br * 2, 0, Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = UI.textDim; ctx.font = `${R.fontPx * 0.85}px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('VISTA CENITAL', x0, y0 + h + R.dpr * 6);
  }

  // veleta: flecha grande con la dirección y fuerza del viento
  _drawWind(ctx, R, M) {
    const wd = M.weather.wind, mag = M.weather.magnitude;
    if (!wd || mag < 0.05) return;
    const v = this.cam.view;
    const cx = v.x + v.w - R.cw * 6, cy = v.y + Math.round(v.w * 0.26 * (44 / CW)) + R.ch * 4.5;
    // viento en pantalla: x del mundo = profundidad (hacia arriba), y = lateral
    const ang = Math.atan2(-wd.x, wd.y * 2);
    const len = R.ch * (1 + Math.min(3, mag) * 0.6);
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(ang);
    ctx.strokeStyle = '#9fd8e8'; ctx.fillStyle = '#9fd8e8'; ctx.lineWidth = R.dpr * 2.5;
    ctx.beginPath(); ctx.moveTo(-len, 0); ctx.lineTo(len * 0.6, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(len, 0); ctx.lineTo(len * 0.5, -len * 0.3); ctx.lineTo(len * 0.5, len * 0.3); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#9fd8e8'; ctx.font = `${R.fontPx}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(`viento ${mag.toFixed(1)}`, cx, cy + len + R.dpr * 4);
  }
}
