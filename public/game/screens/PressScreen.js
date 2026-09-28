import { PRESS_OPTIONS } from '../data/pressTopics.js';
import { rivalPersonalityLine } from '../data/rivalPersonality.js';
import { wrapText, hitRect } from '../core/utils.js';
import { Settings } from '../core/Settings.js';
import { UI, TONE, tint } from '../ui/theme.js';
import { panel, bigButton, segments } from '../ui/widgets.js';

const FONT = '"Menlo", "Consolas", "DejaVu Sans Mono", monospace';
const CARD_W = 26, CARD_H = 15, CARD_GAP = 1, CARD_Y = 21;
const MIC = [' ▄██▄ ', ' ████ ', ' ▀██▀ ', '  ██  ', '  ▐▌  ', ' ▄▟▙▄ '];

// Rueda de prensa antes de un partido gordo: cómo respondas afecta a la
// moral de la peña ahora mismo, y a cómo se toma la derrota si no cumples.
// Rediseño (docs/REDISENO.md, Fase 4): el periodista con su micro arriba,
// flashes de cámara, y las cuatro respuestas como cartas con su efecto en
// medidores (moral ya / castigo si perdéis / imagen pública). Ratón:
// pasar por encima elige, clic responde. Teclado: ←→ o 1-N, ENTER.
export class PressScreen {
  constructor(game) { this.game = game; this.cursor = 0; }

  draw() {
    const { screen, input, player, frame } = this.game;
    const ctx = this.game.pressContext;
    screen.clear();

    this._drawHeader(ctx, frame);
    const qy = this._drawReporter(ctx);
    if ((ctx.isDerby || ctx.isNemesis) && ctx.opponent.captain) {
      const line = rivalPersonalityLine(ctx.opponent, player.publicImage);
      const lines = wrapText(line, 90).slice(0, 2);
      panel(screen, 22, qy, 96, lines.length + 2, { title: `DESDE ${ctx.opponent.name.toUpperCase()}`, tone: tint(TONE.rival, 0.7), titleColor: TONE.rival });
      lines.forEach((l, k) => screen.text(25, qy + 1 + k, l, '#c8a0e8'));
    }

    let clicked = -1;
    // el ratón solo mueve la selección cuando se mueve (si no, pisaría a ←→)
    const mkey = `${input.mouse.cx},${input.mouse.cy}`;
    const moved = mkey !== this._lastMouse;
    this._lastMouse = mkey;
    const n = PRESS_OPTIONS.length;
    const x0 = Math.floor((screen.cols - (n * CARD_W + (n - 1) * CARD_GAP)) / 2);
    PRESS_OPTIONS.forEach((opt, i) => {
      const x = x0 + i * (CARD_W + CARD_GAP);
      if (hitRect(input.mouse.cx, input.mouse.cy, x, CARD_Y, CARD_W, CARD_H)) {
        if (moved || input.mouse.clicked) this.cursor = i;
        if (input.mouse.clicked) clicked = i;
      }
      this._drawCard(x, CARD_Y, opt, i, i === this.cursor, frame);
    });

    // lo que va a pasar con la respuesta elegida
    const opt = PRESS_OPTIONS[this.cursor];
    wrapText(`→ ${opt.result}`, 110).slice(0, 2).forEach((l, k) => screen.textCenter(CARD_Y + CARD_H + 1 + k, l, UI.text));

    const go = bigButton(this.game, 40, 40, 60, `RESPONDER ${opt.label}  [ENTER]`, { tone: TONE.good, selected: true });
    screen.textCenter(45, `←→ o 1-${n} elegir · ENTER responder y salir a la pista · ratón: clic en una carta`, UI.textFaint);

    if (input.hit('ArrowLeft')) this.cursor = (this.cursor + n - 1) % n;
    if (input.hit('ArrowRight')) this.cursor = (this.cursor + 1) % n;
    for (let i = 0; i < n; i++) if (input.hit(String(i + 1))) this.cursor = i;
    if (clicked >= 0) this._answer(ctx, PRESS_OPTIONS[clicked]);
    else if (go || input.hit('Enter') || input.hit(' ')) this._answer(ctx, PRESS_OPTIONS[this.cursor]);
  }

  _drawHeader(ctx, frame) {
    const { screen } = this.game;
    screen.fill(0, 0, screen.cols, 4, '#0f1520');
    const why = ctx.isEuropean ? `COPA DE EUROPA — ${ctx.roundName}` : ctx.isCup ? `COPA DE ESPAÑA — ${ctx.roundName}` : ctx.isDerby ? 'ES EL DERBI DE SIEMPRE' : ctx.isNemesis ? 'TU NÉMESIS OS ESPERA' : 'ÚLTIMA JORNADA DE LA TEMPORADA';
    const whyCol = ctx.isEuropean ? TONE.info : ctx.isCup ? TONE.gold : TONE.bad;
    const flashes = !Settings.get('reduceMotion');
    screen.layer('over', (c, R) => {
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = `bold ${R.ch * 1.6}px ${FONT}`;
      c.shadowColor = UI.accent; c.shadowBlur = R.ch * 0.6; c.fillStyle = UI.accent;
      c.fillText('RUEDA DE PRENSA', R.W / 2, R.cy(1.3));
      c.font = `bold ${R.ch * 0.9}px ${FONT}`;
      c.shadowColor = whyCol; c.shadowBlur = R.ch * (0.3 + 0.3 * Math.abs(Math.sin(frame * 0.08)));
      c.fillStyle = whyCol;
      c.fillText(why, R.W / 2, R.cy(2.8));
      c.shadowBlur = 0;
      // flashes de los fotógrafos: destellos breves en sitios que cambian
      if (!flashes) return;
      for (let k = 0; k < 3; k++) {
        const period = 47 + k * 13;
        const t = (frame + k * 29) % period;
        if (t > 7) continue;
        const seed = Math.floor((frame + k * 29) / period) * 7919 + k * 104729;
        const fx = R.cx(8 + (seed % 124)), fy = R.cy(1 + ((seed >> 3) % 17));
        const a = (1 - t / 8) * 0.8, rad = R.ch * (2.5 + (seed % 3));
        const g = c.createRadialGradient(fx, fy, 0, fx, fy, rad);
        g.addColorStop(0, `rgba(255,255,255,${a})`);
        g.addColorStop(0.25, `rgba(255,250,230,${a * 0.4})`);
        g.addColorStop(1, 'rgba(255,250,230,0)');
        c.fillStyle = g; c.fillRect(fx - rad, fy - rad, rad * 2, rad * 2);
      }
    });
  }

  // el periodista: micro a la izquierda, la pregunta en grande. Devuelve la
  // fila libre de debajo
  _drawReporter(ctx) {
    const { screen } = this.game;
    const x = 10, y = 6, w = 120, h = 8;
    panel(screen, x, y, w, h, { title: 'EL PERIODISTA DEL PUEBLO', tone: UI.edge, titleColor: UI.textDim });
    MIC.forEach((l, k) => screen.text(x + 3, y + 1 + k, l, k < 3 ? '#9aa4b4' : '#5a6070'));
    screen.text(x + 12, y + 2, `Os para antes del partido contra ${ctx.opponent.name}:`, UI.textDim);
    const q = ctx.isEuropean ? '"¿Cómo veis este cruce europeo?"' : ctx.isCup ? '"¿Cómo veis este cruce de Copa?"' : '"¿Cómo veis el partido de este domingo?"';
    screen.layer('over', (c, R) => {
      c.font = `italic bold ${R.ch * 1.3}px ${FONT}`;
      c.textAlign = 'left'; c.textBaseline = 'middle';
      c.fillStyle = '#f4ecd0'; c.shadowColor = '#f4ecd0'; c.shadowBlur = R.ch * 0.25;
      c.fillText(q, R.cx(x + 12), R.cy(y + 4.6));
      c.shadowBlur = 0;
    });
    return y + h + 1;
  }

  _drawCard(x, y, opt, i, sel, frame) {
    const { screen } = this.game;
    const tone = sel ? UI.accent : UI.edge;
    panel(screen, x, y, CARD_W, CARD_H, { tone, fill: sel ? tint(UI.accent, 0.12) : UI.panel, style: sel ? 'double' : 'single' });
    screen.text(x + 2, y, ` ${i + 1} `, sel ? UI.accentHi : UI.textDim);
    // la actitud en grande
    screen.layer('over', (c, R) => {
      c.font = `bold ${R.ch * 1.25}px ${FONT}`;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      const col = sel ? UI.accentHi : UI.text;
      c.fillStyle = col;
      if (sel) { c.shadowColor = UI.accent; c.shadowBlur = R.ch * (0.5 + 0.2 * Math.sin(frame * 0.15)); }
      c.fillText(opt.label, R.cx(x + CARD_W / 2), R.cy(y + 2));
      c.shadowBlur = 0;
    });
    wrapText(opt.line, CARD_W - 4).slice(0, 3).forEach((l, k) => screen.text(x + 2, y + 4 + k, l, sel ? '#f4ecd0' : UI.textDim));

    // efectos, siempre en el mismo orden y con el mismo código de color
    const ly = y + 8;
    screen.text(x + 2, ly, 'MORAL', UI.textDim);
    segments(screen, x + 9, ly, 10, opt.moraleNow, { color: TONE.good });
    screen.text(x + 20, ly, `+${opt.moraleNow}`, TONE.good);

    // castigo de moral si se pierde después de haber hablado
    screen.text(x + 2, ly + 2, 'RIESGO', UI.textDim);
    if (opt.loseBonus < 0) {
      const k = Math.ceil(-opt.loseBonus / 2);
      segments(screen, x + 9, ly + 2, 10, k, { color: k >= 6 ? TONE.bad : '#ff8c5b' });
      screen.text(x + 20, ly + 2, `${opt.loseBonus}`, TONE.bad);
    } else screen.text(x + 9, ly + 2, 'ninguno', TONE.good);

    screen.text(x + 2, ly + 4, 'IMAGEN', UI.textDim);
    const d = opt.imageDelta || 0;
    // barra centrada: a la izquierda humilde, a la derecha chulería
    const mid = x + 14;
    screen.put(mid, ly + 4, '│', UI.textFaint);
    const len = Math.min(5, Math.ceil(Math.abs(d) / 3));
    for (let k = 1; k <= 5; k++) {
      screen.put(mid - k, ly + 4, '▮', d < 0 && k <= len ? TONE.info : '#2a3040');
      screen.put(mid + k, ly + 4, '▮', d > 0 && k <= len ? TONE.xp : '#2a3040');
    }
    screen.text(x + 2, ly + 5, 'humilde', d < 0 ? TONE.info : UI.textFaint);
    screen.text(x + CARD_W - 10, ly + 5, 'chulería', d > 0 ? TONE.xp : UI.textFaint);
  }

  _answer(ctx, opt) {
    const { player } = this.game;
    for (const id of player.roster.ids) player.roster.get(id).addMoral(opt.moraleNow);
    player.nudgePublicImage(opt.imageDelta || 0);
    player.pressPromise = { optionId: opt.id, loseBonus: opt.loseBonus, opponentId: ctx.opponent.id };
    player.news.push(`RUEDA DE PRENSA: ${opt.line} ${opt.result}`);
    player.save();
    this.game.state = 'lineup';
  }
}
