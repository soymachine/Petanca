// Vista ARCADE del partido (docs/REDISENO.md, Fases 3 y 6): pista en
// perspectiva detrás del lanzador — la escena 3D es solo la capa lógica y
// se ve convertida a caracteres (AsciiScene) — + minimapa cenital + HUD de
// videojuego, y una forma
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
import { dist2d, wrapText } from '../../core/utils.js';
import { CLIMAS, isRainy } from '../../data/climas.js';
import { STAT_KEYS, ABUELO_DATA } from '../../data/abuelos.js';
import { drillFor } from '../../data/trainingDrills.js';
import { CONSUMABLES, CONSUMABLE_IDS, MAX_CONSUMABLES_PER_MATCH } from '../../data/consumables.js';
import { clamp } from '../../core/utils.js';
import { Settings } from '../../core/Settings.js';
import { Audio } from '../../core/Audio.js';
import { UI, TONE, STAT, SHOT, WEATHER_FX, tint } from '../../ui/theme.js';
import { panel, statChip, segments, badge } from '../../ui/widgets.js';
import { Camera } from './Camera.js';
import { PerspectiveCourt } from './PerspectiveCourt.js';
import { AsciiScene } from './AsciiScene.js';

const FONT = '"Menlo", "Consolas", "DejaVu Sans Mono", monospace';
const VIEW_TOP = 4, VIEW_BOTTOM = 37; // filas de la vista 3D (incluidas)
// altura del tiro (Fase 6b): continua con la rueda del ratón o W/S, en el
// mismo rango que la fase 'loft' de Match; el rol sale de ella (tenso =
// tirar: más fuerza y más temblor, ver ThrowProfile.js)
const LOFT_MIN = 0.17, LOFT_MAX = 1.05, LOFT_TENSO = 0.3;
// qué hace la bola según la altura (textos de los antiguos tipos de tiro)
export function loftInfo(loft) {
  if (loft < LOFT_TENSO) return { label: 'TENSO', color: SHOT.tirar.color, hint: 'tenso y fuerte: saca la bola rival (más temblor)' };
  if (loft < 0.45) return { label: 'RASO', color: SHOT.arrimar.color, hint: SHOT.arrimar.hint };
  if (loft < 0.78) return { label: 'MEDIA VOLEA', color: SHOT.media.color, hint: SHOT.media.hint };
  return { label: 'GLOBO', color: SHOT.bombeo.color, hint: SHOT.bombeo.hint };
}
const AIM_PHASES = ['aim', 'spin', 'loft', 'power'];
const LABEL_BG = '#0b0e14';

export class ArcadeView {
  constructor(game) {
    this.game = game;
    this.cam = new Camera();
    this.court = new PerspectiveCourt();
    this.ascii = new AsciiScene(this.court); // Fase 6: la 3D es la capa lógica, se ve en ASCII
    this.loft = 0.55; // se mantiene entre tiros y partidos
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
    this._applyLoft(M);
    this.cam.direct(M); this.cam.snap();
    this._prev = { phase: M.phase, landed: false, coll: false, round: M.round, sweet: false };
    this._holding = false;
  }

  // lo que la vista arcade manda a Match antes de cada tiro: la altura
  // elegida, sin efecto, y el rol que corresponde a esa altura
  _applyLoft(M) {
    M.loft = this.loft;
    M.spin = 0;
    M.role = this.loft < LOFT_TENSO ? 'tirar' : 'apuntar';
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
      // altura con la rueda (arriba = más alta) o W/S; sin efecto
      if (input.wheel) this.loft -= input.wheel * 0.04;
      if (input.held('w') || input.held('W')) this.loft += 0.9 * dt;
      if (input.held('s') || input.held('S')) this.loft -= 0.9 * dt;
      this.loft = clamp(this.loft, LOFT_MIN, LOFT_MAX);
      this._applyLoft(M);
      block.add('ArrowLeft'); block.add('ArrowRight');
      // empezar la potencia: ENTER/ESPACIO, o mantener pulsado en la vista
      block.add('Enter'); block.add(' '); block.add('r'); block.add('R');
      block.add('w'); block.add('W'); block.add('s'); block.add('S');
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
    const { fx } = this.game;
    const prev = this._prev || {};
    // polvo y chispas: partículas ASCII dentro de la pista (AsciiScene)
    const at = (b, kind) => { if (b && b._screen) this.ascii.burstAtScreen(b._screen.x, b._screen.y, kind); };
    if (M.lastLanded && !prev.landed && M.lastThrown) {
      Audio.play(M.lastThrown === M.jack ? 'tick' : 'thud');
      at(M.lastThrown, 'dust');
    }
    if (M.lastCollision && !prev.coll && M.lastThrown) {
      Audio.play('clack');
      at(M.lastThrown, 'spark');
      fx.shake(0.7);
    }
    // foto de la pista justo al soltar, para leer la jugada al pararse todo
    if (M.phase === 'sim' && prev.phase !== 'sim') {
      this._snap = { thrown: M.lastThrown, balls: M.balls.filter((b) => b !== M.lastThrown).map((b) => ({ b, x: b.x, y: b.y })), jack: M.jack ? { x: M.jack.x, y: M.jack.y } : null };
    }
    if (M.phase === 'throwDone' && prev.phase === 'sim' && this._snap) { this._readPlay(M, this._snap); this._snap = null; }
    if (M.lastCollision && !prev.coll) this._slow = 0.55;
    if (M.phase === 'sim' && prev.phase === 'power' && M.lastReleaseSweet) {
      Audio.play('sweet');
      fx.float(70, 30, '¡PUNTO DULCE!', TONE.gold, { size: 1.6, life: 1 });
      fx.flash('#ffe14d', 0.12, 0.2);
    }
    if (M.phase === 'roundEnd' && prev.phase !== 'roundEnd' && M.lastWinner) {
      const mine = M.lastWinner === 'P';
      Audio.play(mine ? 'point' : 'pointRival');
      fx.banner(mine ? `¡+${M.lastPoints} PARA TI!` : `+${M.lastPoints} PARA ${M.rival.split(' ')[0]}`, mine ? TONE.good : TONE.rival, { life: 1.8, size: 3.2 });
      if (mine) fx.burst(70, 20, { n: 40, colors: [TONE.gold, TONE.good, '#ffffff'], speed: 18, life: 1 });
    }
    if (M.phase === 'matchEnd' && prev.phase !== 'matchEnd' && !M.training) {
      const won = M.scoreP >= M.target;
      Audio.play(won ? 'win' : 'lose');
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
    // la pista en ASCII (AsciiScene: la escena 3D convertida a caracteres
    // + vectores, bolas y clima ASCII), por debajo del texto de la interfaz
    const dtv = dt || 1 / 60;
    screen.layer('under', (ctx, R) => {
      const x0 = R.cx(0), y0 = R.cy(VIEW_TOP), x1 = R.cx(screen.cols), y1 = R.cy(VIEW_BOTTOM + 1);
      this.ascii.draw(ctx, R, this.cam, M, this._t, vis, { x: x0, y: y0, w: x1 - x0, h: y1 - y0, view: this, dt: dtv });
    });
    screen.layer('over', (ctx, R) => this._drawScore(ctx, R, M));

    this._drawTopHud(M);
    this._drawMinimap(M);
    this._drawWind(M);
    this._drawViewTexts(M, frame);
    this._drawDeck(M, frame);
    this._drawCoach(M, frame);
    this._juice(M);
  }

  // tutorial de los controles, una sola vez por perfil
  // (player.arcadeTutorialDone): cuatro pasos que avanzan solos al hacer lo
  // que piden — apuntar, elegir tiro, cargar potencia, soltar. [H] lo salta.
  // lógica del tutorial (sin dibujo, se prueba en tools/verify.mjs):
  // avanza el paso según lo que haga el jugador y devuelve las dos líneas
  // del cartel, o null si no hay que enseñar nada
  _coachUpdate(M, input) {
    const { player } = this.game;
    if (!player || player.arcadeTutorialDone || M.turn !== 'P') return null;
    const ph = M.phase;
    const c = this._coach || (this._coach = { step: 0, aim0: null, loft0: this.loft, t0: this._t });
    // cada paso guarda cómo estaba todo al empezar, para notar el cambio
    const next = () => { c.step++; c.t0 = this._t; c.aim0 = null; c.loft0 = this.loft; };
    if (c.step === 0 && ph === 'aim') {
      if (c.aim0 === null) c.aim0 = M.aimAngle;
      if (Math.abs(M.aimAngle - c.aim0) > 0.04) next();
    } else if (c.step === 1 && ph === 'aim') {
      if (Math.abs(this.loft - c.loft0) > 0.05 || this._t - c.t0 > 8) next();
    } else if (c.step === 3 && ph !== 'power' && ph !== 'aim') next();
    // quien se adelanta y ya carga la potencia pasa directo al "¡suelta!"
    if (c.step < 3 && ph === 'power') { c.step = 3; c.t0 = this._t; }
    if (c.step >= 4 || (input && (input.hit('h') || input.hit('H')))) { player.arcadeTutorialDone = true; if (player.save) player.save(); return null; }

    if (ph === 'jackAim' || ph === 'jackPower') return ['PRIMERO, EL BOLICHE', 'mantén pulsado sobre la pista (o ENTER) y suelta para lanzarlo'];
    if (ph === 'aim' && c.step === 0) return ['① APUNTA', 'mueve el ratón sobre la pista: la retícula va donde señalas (o ↑ ↓)'];
    if (ph === 'aim' && c.step === 1) return ['② AJUSTA LA ALTURA', 'gira la rueda del ratón (o W/S): de tiro tenso y rodado a globo — mira la parábola'];
    if (ph === 'aim' && c.step === 2) return ['③ CARGA LA POTENCIA', 'mantén pulsado sobre la pista (o ENTER)'];
    if (ph === 'power' && c.step >= 2) return ['④ ¡SUELTA!', 'suelta el botón (o ENTER) cuando la barra pase por el tramo dorado ▾'];
    return null;
  }

  _drawCoach(M, frame) {
    const { screen } = this.game;
    const lines = this._coachUpdate(M, this.game.input);
    if (!lines) return;
    // en el cielo, entre la columna del clima (izquierda) y el minimapa
    // (derecha): el texto largo se parte para caber en ese hueco
    const body = wrapText(lines[1], 60);
    const w = Math.max(lines[0].length, ...body.map((l) => l.length)) + 8, h = body.length + 4;
    const x = Math.max(30, Math.floor((130 - w) / 2)), y = VIEW_TOP + 4;
    const pulse = frame % 30 < 20;
    panel(screen, x, y, w, h, { title: 'CÓMO SE JUEGA', tone: pulse ? UI.accent : UI.edge, titleColor: UI.accentHi, style: 'double', fill: '#12161f' });
    screen.text(x + 4, y + 1, lines[0], UI.accentHi);
    screen.glow(x + 4, y + 1, lines[0].length, 1);
    body.forEach((l, i) => screen.text(x + 4, y + 2 + i, l, UI.text));
    screen.text(x + w - 18, y + h - 1, ' [H] no mostrar ', UI.textDim);
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

  // texto de la interfaz ENCIMA de la pista ASCII: con fondo propio, si no
  // sus letras se mezclan con las de la escena
  _label(x, y, txt, col, glow = false) {
    const { screen } = this.game;
    screen.fill(x - 1, y, txt.length + 2, 1, LABEL_BG);
    screen.text(x, y, txt, col);
    if (glow) screen.glow(x, y, txt.length, 1);
  }

  _drawViewTexts(M, frame) {
    const { screen } = this.game;
    const cl = CLIMAS[M.weather.type];
    const chip = `${cl.icon} ${cl.label}`;
    badge(screen, 2, VIEW_TOP + 1, chip, cl.color);
    (WEATHER_FX[M.weather.type] || []).forEach((e, i) => this._label(3, VIEW_TOP + 2 + i, `· ${e}`, UI.text));
    if (M.feature && M.city && M.city.feature && M.city.feature.label) this._label(3, VIEW_TOP + 3 + (WEATHER_FX[M.weather.type] || []).length, `pista: ${M.city.feature.label}`, UI.textDim);

    const mid = Math.floor(screen.cols / 2);
    const say = (y, txt, col, glow = true) => this._label(mid - Math.floor(txt.length / 2), y, txt, col, glow);
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
      const n = `» ${M.narr}`.slice(0, screen.cols - 6);
      this._label(3, VIEW_BOTTOM, n, '#d8c89a');
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

    // ALTURA (Fase 6b): medidor continuo, qué hace la bola a esa altura y
    // el perfil lateral de la parábola prevista
    const li = loftInfo(this.loft);
    screen.text(2, y0 + 1, 'ALTURA', UI.textDim);
    screen.text(9, y0 + 1, li.label, aiming ? li.color : UI.textFaint);
    if (aiming) screen.glow(9, y0 + 1, li.label.length, 1);
    screen.text(9 + li.label.length + 1, y0 + 1, `${Math.round(this.loft * 57.3)}°`, UI.text);
    const mw = 34, mx = 2;
    const k = (this.loft - LOFT_MIN) / (LOFT_MAX - LOFT_MIN);
    screen.fill(mx, y0 + 2, mw, 1, '#1c2230');
    for (let i = 0; i < mw; i++) {
      const lf = LOFT_MIN + ((i + 0.5) / mw) * (LOFT_MAX - LOFT_MIN);
      screen.put(mx + i, y0 + 2, i <= k * mw ? '█' : '·', i <= k * mw ? loftInfo(lf).color : UI.edgeDim);
    }
    screen.put(mx + Math.min(mw - 1, Math.round(k * mw)), y0 + 3, '▲', aiming ? '#ffffff' : UI.textFaint);
    screen.text(mx + mw + 1, y0 + 2, aiming ? 'rueda · W/S' : '', UI.textFaint);
    screen.text(2, y0 + 4, li.hint.slice(0, 50), aiming ? li.color : UI.textFaint);
    this._drawProfile(M, 52, y0 + 1, 58, aiming);

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
    const help = ph === 'aim' ? 'SEÑALA en la pista · RUEDA altura · MANTÉN pulsado y SUELTA en el punto dulce   ·   teclado: ↑↓ apuntar · W/S altura · ENTER'
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

  // perfil lateral de la parábola prevista (visto de lado): 3 filas con
  // glifos de sub-celda _ - ¯ (9 alturas), el círculo o a la izquierda,
  // la caída x y el tramo que la Maña no deja ver, apagado
  _drawProfile(M, x, y, w, aiming) {
    const { screen } = this.game;
    screen.fill(x, y, w, 3, '#10151f');
    for (let i = 0; i < w; i++) screen.put(x + i, y + 2, '_', '#3a3428');
    if (!aiming) { screen.text(x + 1, y, 'PARÁBOLA', UI.textFaint); return; }
    const power = M.phase === 'power' ? M.power : 0.55;
    const pr = PerspectiveCourt.predict(M, power);
    // escala fija: la altura máxima es la del globo con esta misma fuerza
    const zRef = Math.max(4, (pr.speed * Math.sin(LOFT_MAX)) ** 2 / (2 * 26));
    const xRef = 130;
    const levels = ['_', '-', '¯'];
    let apex = { i: -1, z: -1 };
    for (let i = 0; i < w; i++) {
      const dist = ((i + 0.5) / w) * xRef;
      const tt = dist / Math.max(0.01, pr.vh);
      if (tt > pr.T) break;
      const z = pr.vz * tt - 13 * tt * tt;
      const lv = Math.max(0, Math.min(8, Math.round((z / zRef) * 8)));
      const seen = dist <= pr.guideDist;
      const col = seen ? (lv >= 6 ? '#ffe680' : '#bff4ff') : '#3e4a58';
      screen.put(x + i, y + 2 - Math.floor(lv / 3), levels[lv % 3], col);
      if (z > apex.z) apex = { i, z, lv, seen };
    }
    screen.put(x, y + 2, 'o', TONE.player);
    const li = Math.min(w - 1, Math.round((pr.carry / xRef) * w));
    if (li > 0) screen.put(x + li, y + 2, 'x', M.phase === 'power' ? (M.isSweet(M.power) ? TONE.gold : '#ff7a5a') : '#bff4ff');
    if (apex.i > 0 && apex.seen) screen.glow(x + apex.i, y + 2 - Math.floor(apex.lv / 3), 1, 1);
    screen.text(x + w - 12, y, `cae a ${Math.round(pr.carry)}`.padStart(12), UI.textDim); // mismas marcas que la pista
  }

  // minimapa cenital en caracteres (arriba a la derecha de la vista): la
  // lectura táctica — pista, charcos ≈, árbol ♣, lo que ve la cámara, la
  // dirección de tiro, las bolas ● y el boliche •, aro dorado en la que manda
  _drawMinimap(M) {
    const { screen } = this.game;
    const w = 30, h = 9, x0 = screen.cols - w - 2, y0 = VIEW_TOP + 1;
    panel(screen, x0, y0, w, h, { title: 'CENITAL', tone: UI.edge, titleColor: UI.textDim, fill: '#0c0f14' });
    const iw = w - 2, ih = h - 2;
    const X = (x) => x0 + 1 + Math.max(0, Math.min(iw - 1, Math.floor((x / CW) * iw)));
    const Y = (y) => y0 + 1 + Math.max(0, Math.min(ih - 1, Math.floor((y / CH) * ih)));
    const camC = X(Math.max(0, this.cam.x));
    for (let r = 0; r < ih; r++) {
      for (let c = 0; c < iw; c++) {
        const cx = x0 + 1 + c;
        screen.put(cx, y0 + 1 + r, (c + r) % 4 ? ' ' : '·', '#6a5a38', cx >= camC ? '#3a3220' : '#2a2418');
      }
    }
    for (const pd of M.court.puddles || []) screen.put(X(pd.x), Y(pd.y), '≈', '#6fb6e8');
    if (M.court.tree) screen.put(X(M.court.tree.x), Y(M.court.tree.y), '♣', '#4f9a55');
    if (M.turn === 'P' && AIM_PHASES.includes(M.phase)) {
      for (let d = 6; d < 120; d += 5) screen.put(X(THROW_X + Math.cos(M.aimAngle) * d), Y(CH / 2 + Math.sin(M.aimAngle) * d), '·', '#9df09d');
    }
    screen.put(X(THROW_X), Y(CH / 2), '○', '#e8e0c8');
    const vis = this._vis || (() => true);
    if (M.jack && M.training !== 'TIRO' && vis(M.jack)) screen.put(X(M.jack.x), Y(M.jack.y), '•', TONE.jack);
    const pb = M.bestBall && M.bestBall('P'), ab = M.bestBall && M.bestBall('A');
    const lead = pb && ab ? (pb.d < ab.d ? pb.b : ab.b) : pb ? pb.b : ab ? ab.b : null;
    for (const b of M.balls) {
      if (!vis(b)) continue;
      const col = b.owner === 'P' ? TONE.player : b.owner === 'A' ? TONE.rival : '#c9c2a8';
      screen.put(X(b.x), Y(b.y), '●', col, b === lead && (!M.jack || vis(M.jack)) ? tint(TONE.gold, 0.55) : undefined);
    }
  }

  // veleta en caracteres: flecha con la dirección y barras con la fuerza
  _drawWind(M) {
    const { screen } = this.game;
    const wd = M.weather.wind, mag = M.weather.magnitude;
    if (!wd || mag < 0.05) return;
    // viento en pantalla: x del mundo = profundidad (hacia arriba), y = lateral
    const ang = Math.atan2(-wd.x, wd.y * 2);
    const arrows = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'];
    const k = ((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8;
    const bars = '≈'.repeat(Math.max(1, Math.min(4, Math.round(mag * 1.5))));
    const txt = `VIENTO ${arrows[k]} ${bars} ${mag.toFixed(1)}`;
    this._label(screen.cols - txt.length - 3, VIEW_TOP + 10, txt, '#9fd8e8');
  }
}
