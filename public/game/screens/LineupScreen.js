import { ABUELO_DATA, STAT_KEYS } from '../data/abuelos.js';
import { BOLAS } from '../data/bolas.js';
import { CLIMAS } from '../data/climas.js';
import { RIVAL_FACES } from '../data/art/rivalFaces.js';
import { wrapText, hitRect, truncate } from '../core/utils.js';
import { countryTag } from '../data/countries.js';
import { chemistryLevel, gamesFor } from '../domain/Chemistry.js';
import { archetypeFor } from '../data/rivalArchetypes.js';
import { UI, TONE, STAT, WEATHER_FX, tint } from '../ui/theme.js';
import { panel, bigButton, button, statChip, segments, badge, tooltip } from '../ui/widgets.js';

const FONT = '"Menlo", "Consolas", "DejaVu Sans Mono", monospace';
const WARMUP_COST = 15;
const CARD_W = 32, CARD_H = 5, CARD_GAP_X = 1, GRID_X = 4, GRID_Y = 22, GRID_COLS = 4, GRID_ROWS = 3;

// Alineación del partido — el "vestuario" (docs/REDISENO.md, Fase 4).
// Arriba la competición en grande; debajo cuatro tarjetas (RIVAL, PISTA,
// CLIMA con lo que cambia en la pista, FORMATO); en el centro los abuelos
// disponibles como tarjetas con sus 5 stats en chips (código visual de
// ui/theme.js), stamina, moral, afinidad con el clima de hoy y vínculo con
// quien ya esté elegido; abajo bolas, apuesta del bar y el botón de salir
// a la pista. Teclado de siempre: ↑↓←→ se mueve por las tarjetas (←→
// sin tarjetas cambia de bolas: ver _input), ENTER elige, M formato, W
// calentamiento, A apuesta, S a la pista, F simular (debug).
export class LineupScreen {
  constructor(game) { this.game = game; this.cursor = 0; }

  draw() {
    const { screen, input, player, frame } = this.game;
    const ctx = this.game.weeklyMatch;
    screen.clear();
    const r = ctx.currentRound;
    const opponent = ctx.opponentClub;
    const isNemesis = !ctx.isCup && !ctx.isFriendly && player.nemesis && player.nemesis.city === opponent.id;
    const isDerby = !ctx.isCup && !ctx.isFriendly && player.derbyClub && player.derbyClub.id === opponent.id;
    const important = ctx.isCup || isDerby || isNemesis;

    this._drawHeader(ctx, isDerby, isNemesis, frame);
    const rivalHover = this._drawRival(2, 5, 34, 16, ctx, opponent, r, isDerby, isNemesis, frame);
    this._drawCourt(37, 5, 32, 16, ctx);
    this._drawWeather(70, 5, 34, 16, ctx, r);
    this._drawFormat(105, 5, 33, 16, ctx, important);

    const available = this._available();
    if (available.length && this.cursor >= available.length) this.cursor = 0;
    const rowHover = this._drawRoster(ctx, r, available);
    this._drawBottom(ctx, available, frame);

    this._input(ctx, ctx.teamSel.length === ctx.formato, available, important);

    // tooltips al final de todo, por encima del resto
    if (rowHover) this._drawAbueloTooltip(rowHover.id, input.mouse.cx, input.mouse.cy);
    if (rivalHover) this._drawRivalTooltip(opponent, r, input.mouse.cx, input.mouse.cy);
    if (rowHover && input.mouse.clicked) { this.cursor = rowHover.k; this._select(ctx, available); }
  }

  _drawHeader(ctx, isDerby, isNemesis, frame) {
    const { screen } = this.game;
    screen.fill(0, 0, screen.cols, 4, '#0f1520');
    const title = ctx.isEuropean ? `COPA DE EUROPA · ${ctx.cup.roundName}`
      : ctx.isCup ? `COPA · ${ctx.cup.roundName}`
      : ctx.isFriendly ? 'AMISTOSO DE PRETEMPORADA'
      : `JORNADA ${ctx.league.matchday + 1} · LIGA DE ${ctx.city.name}`;
    const col = ctx.isEuropean ? TONE.info : ctx.isCup ? TONE.gold : ctx.city.color || UI.accentHi;
    screen.layer('over', (c, R) => {
      c.font = `bold ${R.ch * 1.6}px ${FONT}`;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.shadowColor = col; c.shadowBlur = R.ch * 0.6; c.fillStyle = col;
      c.fillText(title, R.W / 2, R.cy(1.3));
      c.shadowBlur = 0;
      c.font = `bold ${R.ch * 0.9}px ${FONT}`;
      const mine = this.game.player.clubName, vs = '  vs  ', theirs = ctx.opponentClub.name;
      const wm = c.measureText(mine).width, wv = c.measureText(vs).width, wt = c.measureText(theirs).width;
      let tx = R.W / 2 - (wm + wv + wt) / 2;
      c.textAlign = 'left';
      c.fillStyle = TONE.player; c.fillText(mine, tx, R.cy(2.7)); tx += wm;
      c.fillStyle = UI.textDim; c.fillText(vs, tx, R.cy(2.7)); tx += wv;
      c.fillStyle = TONE.rival; c.fillText(theirs, tx, R.cy(2.7));
    });
    const chips = [];
    if (ctx.isEuropean || ctx.isCup) chips.push([`sede: ${ctx.city.name}`, UI.textDim]);
    if (isDerby) chips.push(['¡EL DERBI!', '#ff9c5b']);
    if (isNemesis) chips.push(['¡TU NÉMESIS!', TONE.bad]);
    if (ctx.festival) chips.push([ctx.festival, frame % 24 < 16 ? UI.accent : '#c98a3a']);
    let total = chips.reduce((s, [t]) => s + t.length + 3, 0);
    let x = Math.floor((screen.cols - total) / 2);
    for (const [t, c] of chips) x += badge(screen, x, 4, t, c) + 1;
  }

  _drawRival(x, y, w, h, ctx, opponent, r, isDerby, isNemesis, frame) {
    const { screen, input, player } = this.game;
    const over = hitRect(input.mouse.cx, input.mouse.cy, x, y, w, h);
    panel(screen, x, y, w, h, { title: `VS ${truncate(opponent.name, w - 9)}`, tone: over ? TONE.rival : UI.edge, titleColor: isDerby ? '#ff9c5b' : TONE.rival });
    const art = r.rivalMini || r.rivalPortrait || RIVAL_FACES[0].photo;
    screen.drawAnyPortrait(art, x + Math.max(2, Math.floor((w - (art.cols || 20)) / 2)), y + 1);
    // nivel del rival como medidor de 10 segmentos, debajo de la cara
    const lv = r.aiLevel;
    screen.text(x + 2, y + h - 3, 'NIVEL', UI.textDim);
    segments(screen, x + 8, y + h - 3, 10, lv, { color: lv >= 7 ? TONE.bad : lv >= 4 ? TONE.warn : TONE.good });
    screen.text(x + 19, y + h - 3, `${lv}/10`, UI.text);
    const euroTag = ctx.isEuropean && ctx.cup.playerOpponent() ? ` ${countryTag(ctx.cup.playerOpponent().country, player.homeCountry)}` : '';
    screen.text(x + 25, y + h - 3, `${opponent.pts ?? 0} pts${euroTag}`.slice(0, w - 26), UI.textDim);
    if (isDerby) screen.text(x + 2, y + h - 2, `derbi: ${player.derbyHistory.wins}G-${player.derbyHistory.losses}P`, frame % 20 < 14 ? '#ff9c5b' : '#a08050');
    else if (isNemesis) screen.text(x + 2, y + h - 2, '¡véngate!', frame % 20 < 14 ? TONE.bad : '#a05838');
    else if (!ctx.isCup && !ctx.isFriendly && opponent.seenArchetype) screen.text(x + 2, y + h - 2, archetypeFor(opponent.name).label, TONE.xp);
    return over;
  }

  _drawCourt(x, y, w, h, ctx) {
    const { screen } = this.game;
    panel(screen, x, y, w, h, { title: 'PISTA', tone: UI.edge });
    // pictograma de la pista con su rasgo
    const f = ctx.city.feature.id;
    const mark = { slope: '▼', puddles: '≈', tree: '♣', walls: '▌', cierzo: '≋', fastdry: '»', pressure: '!', flat: '·' }[f] || '·';
    screen.fill(x + 3, y + 2, w - 6, 4, '#3a3420');
    screen.box(x + 3, y + 2, w - 6, 4, '#c9b98a', 'single', null);
    screen.put(x + 5, y + 3, '○', '#c9b98a');
    for (let i = 0; i < 4; i++) screen.put(x + 10 + i * 4, y + 3 + (i % 2), mark, ctx.city.color || UI.accent);
    screen.put(x + w - 7, y + 3, '●', TONE.jack);
    screen.text(x + 2, y + 7, ctx.city.name.toUpperCase(), UI.accentHi);
    wrapText(ctx.city.feature.desc, w - 4).slice(0, 6).forEach((l, k) => screen.text(x + 2, y + 8 + k, l, UI.textDim));
  }

  _drawWeather(x, y, w, h, ctx, r) {
    const { screen } = this.game;
    const cl = CLIMAS[r.forecast.main];
    panel(screen, x, y, w, h, { title: 'CLIMA', tone: UI.edge, titleColor: cl.color });
    screen.layer('over', (c, R) => {
      c.font = `${R.ch * 3}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.shadowColor = cl.color; c.shadowBlur = R.ch; c.fillStyle = cl.color;
      c.fillText(cl.icon, R.cx(x + 6), R.cy(y + 3.6));
      c.shadowBlur = 0;
    });
    screen.text(x + 11, y + 3, cl.label, cl.color);
    let ly = y + 4;
    for (const e of WEATHER_FX[r.forecast.main] || ['sin efecto en la pista']) {
      wrapText(e, w - 14).forEach((l, k) => { if (ly < y + 8) screen.text(x + 11, ly++, `${k ? '  ' : '· '}${l}`, UI.text); });
    }
    if (r.forecast.changeProb > 0) {
      const to = CLIMAS[r.forecast.changeTo];
      wrapText(`puede cambiar a ${to.icon} ${to.label} a mitad`, w - 4).forEach((l, k) => screen.text(x + 2, y + 8 + k, l, TONE.warn));
    }
    if (ctx.isCup) screen.text(x + 2, y + h - 2, 'partido único: quien gana pasa', UI.textDim);
    else if (ctx.isFriendly) screen.text(x + 2, y + h - 2, 'amistoso: no puntúa', UI.textDim);
    else {
      const st = ctx.league.standings();
      const myRank = st.findIndex((c) => c.isPlayer) + 1;
      screen.text(x + 2, y + h - 3, `líder: ${truncate(st[0].name, w - 12)}`, UI.textDim);
      screen.text(x + 2, y + h - 2, `(${st[0].pts} pts) · tú vas ${myRank}º`, UI.textDim);
    }
  }

  _drawFormat(x, y, w, h, ctx, important) {
    const { screen } = this.game;
    panel(screen, x, y, w, h, { title: 'FORMATO', tone: UI.edge });
    const label = { 1: '1 CONTRA 1', 2: 'DOBLETE', 3: 'TRIPLETA' }[ctx.formato];
    screen.text(x + 3, y + 2, label, UI.accentHi);
    screen.glow(x + 3, y + 2, label.length, 1);
    screen.text(x + 3, y + 4, 'PLAZAS', UI.textDim);
    let dx = x + 10;
    for (let i = 0; i < ctx.formato; i++) { screen.text(dx, y + 4, i < ctx.teamSel.length ? '●' : '○', i < ctx.teamSel.length ? TONE.good : UI.text); dx += 3; }
    screen.text(x + 3, y + 6, ctx.formato === 1 ? 'elige y sales a la pista' : `${ctx.teamSel.length}/${ctx.formato} elegidos`, UI.text);
    if (button(this.game, x + 2, y + 8, 'CAMBIAR FORMATO', { hotkey: 'M', w: w - 4 })) this._cycleFormat(ctx);
    if (important) {
      const on = ctx.warmup && ctx.warmup.wanted;
      if (button(this.game, x + 2, y + 10, `CALENTAR ${on ? '✔' : ''}`, { hotkey: 'W', w: w - 4, tone: on ? TONE.good : UI.accent, selected: on })) this._toggleWarmup(ctx);
      screen.text(x + 3, y + 11, `-${WARMUP_COST} STA · tiro más firme`, UI.textDim);
    }
  }

  // tarjetas de abuelos disponibles (página que contiene al cursor)
  _drawRoster(ctx, r, available) {
    const { screen, input, player } = this.game;
    screen.text(GRID_X, GRID_Y - 1, '¿QUIÉN JUEGA?', TONE.good);
    screen.glow(GRID_X, GRID_Y - 1, 13, 1);
    const per = GRID_COLS * GRID_ROWS;
    const page = Math.floor(this.cursor / per);
    const pages = Math.max(1, Math.ceil(available.length / per));
    if (pages > 1) screen.text(GRID_X + 16, GRID_Y - 1, `página ${page + 1}/${pages}`, UI.textDim);
    let hover = null;
    const main = r.forecast.main;
    for (let n = 0; n < per; n++) {
      const k = page * per + n;
      if (k >= available.length) break;
      const id = available[k];
      const s = player.roster.get(id);
      const d = ABUELO_DATA[id];
      const cx = GRID_X + (n % GRID_COLS) * (CARD_W + CARD_GAP_X);
      const cy = GRID_Y + Math.floor(n / GRID_COLS) * (CARD_H + 1);
      const sel = k === this.cursor;
      const picked = ctx.teamSel.includes(id);
      const over = hitRect(input.mouse.cx, input.mouse.cy, cx, cy, CARD_W, CARD_H);
      if (over) hover = { id, k };
      const tone = picked ? TONE.gold : sel || over ? UI.accent : UI.edge;
      panel(screen, cx, cy, CARD_W, CARD_H, {
        title: `${picked ? '✔ ' : ''}${truncate(this.game.displayName(id), CARD_W - 12)}`, tone, titleColor: picked ? TONE.gold : sel || over ? '#ffffff' : UI.text,
        fill: picked ? tint(TONE.gold, 0.14) : sel || over ? UI.panelHi : UI.panel, style: picked || sel ? 'double' : 'single',
      });
      screen.text(cx + CARD_W - 7, cy, ` Nv${s.level} `, UI.textDim);
      // 5 stats en chips
      let sx = cx + 2;
      for (const key of STAT_KEYS) sx += statChip(screen, sx, cy + 1, key, s.getStat(key)) + 2;
      // stamina + moral
      const stCol = s.st > 60 ? TONE.good : s.st > 30 ? TONE.warn : TONE.bad;
      screen.text(cx + 2, cy + 2, 'STA', UI.textDim);
      segments(screen, cx + 6, cy + 2, 10, Math.round(s.st / 10), { color: stCol });
      screen.text(cx + 17, cy + 2, `${Math.round(s.st)}`.padStart(3), stCol);
      screen.text(cx + 22, cy + 2, `MOR ${s.mo >= 0 ? '+' : ''}${s.mo}`, s.mo >= 0 ? TONE.good : TONE.bad);
      // afinidad con el clima de hoy + vínculo con los ya elegidos
      const aff = main === 'SOL' || !d ? 0 : (d.clima[main] ?? 0);
      const cl = CLIMAS[main];
      if (aff === 1) screen.text(cx + 2, cy + 3, `${cl.icon} ✚ le va este clima`, TONE.good);
      else if (aff === -1) screen.text(cx + 2, cy + 3, `${cl.icon} ▼ sufre este clima`, TONE.bad);
      const bondLvl = ctx.teamSel.filter((oid) => oid !== id).reduce((best, oid) => Math.max(best, chemistryLevel(gamesFor(player.chemistry, id, oid))), 0);
      if (bondLvl >= 1) screen.text(cx + CARD_W - 4, cy + 3, bondLvl >= 3 ? '♥' : '♡', bondLvl >= 3 ? '#ff8fc0' : '#a8e8c8');
    }
    // peña corta: huecos vacíos en la primera fila, para que se vea que caben más
    for (let n = available.length; page === 0 && n < GRID_COLS; n++) {
      const cx = GRID_X + n * (CARD_W + CARD_GAP_X);
      screen.box(cx, GRID_Y, CARD_W, CARD_H, UI.edgeDim, 'single', null);
      screen.text(cx + Math.floor((CARD_W - 11) / 2), GRID_Y + 2, 'plaza libre', UI.textFaint);
      screen.text(cx + Math.floor((CARD_W - 20) / 2), GRID_Y + 3, 'se ficha en MI PEÑA', UI.textFaint);
    }
    return hover;
  }

  _drawBottom(ctx, available, frame) {
    const { screen, player } = this.game;
    const y0 = 40;
    const injured = player.roster.ids.filter((id) => player.roster.get(id).isInjured(player.seasonClock.day));
    if (injured.length) {
      const dias = Math.max(...injured.map((id) => player.roster.get(id).injuredUntil - player.seasonClock.day));
      screen.text(GRID_X, y0 - 1, `✚ de baja: ${injured.map((id) => this.game.displayName(id)).join(', ')} (vuelve en ${dias}d)`, '#ff8c5b');
    }
    // bolas: ◀ nombre ▶
    const bolaName = BOLAS[ctx.bola].name;
    const many = player.bolasOwned.length > 1;
    screen.text(GRID_X, y0, 'BOLAS', UI.textDim);
    if (many && button(this.game, GRID_X + 7, y0, '◀', { w: 3 })) this._cycleBolas(ctx, -1);
    screen.text(GRID_X + 11, y0, bolaName, TONE.info);
    if (many && button(this.game, GRID_X + 12 + bolaName.length, y0, '▶', { w: 3 })) this._cycleBolas(ctx, 1);
    screen.text(GRID_X + 17 + bolaName.length, y0, truncate(BOLAS[ctx.bola].desc, 70), UI.textDim);
    // apuesta del bar
    if (ctx.bet) {
      if (ctx.bet.accepted) screen.text(GRID_X, y0 + 1, `✔ apuesta aceptada: ${ctx.bet.desc}`, '#ffcf8a');
      else {
        screen.text(GRID_X, y0 + 1, `EL DEL BAR: "${ctx.bet.desc}"`, frame % 30 < 22 ? '#ffcf8a' : '#a08050');
        if (button(this.game, GRID_X + ctx.bet.desc.length + 17, y0 + 1, 'ACEPTAR', { hotkey: 'A', w: 14 })) this._acceptBet(ctx);
      }
    }
    if (this.game.deathEvent) screen.text(GRID_X, y0 + 2, truncate(this.game.deathEvent.text, 130), UI.text);
    else if (this.game.calendarEvent) screen.text(GRID_X, y0 + 2, truncate(this.game.calendarEvent.text, 130), '#ff9c5b');

    // botón de salir a la pista (1c1: basta con elegir una tarjeta)
    const canStart = ctx.teamSel.length === ctx.formato;
    if (ctx.formato > 1) {
      if (bigButton(this.game, 46, y0 + 3, 48, '▶ ¡A LA PISTA!', { hotkey: 'S', tone: TONE.good, disabled: !canStart })) this._launch(ctx, ctx.teamSel);
    } else {
      screen.textCenter(y0 + 4, 'elige un abuelo (clic o ENTER) y sale directo a la pista', UI.text);
    }
    screen.textCenter(45, '↑↓←→ moverse · ENTER elegir · ratón = detalle · [F] simular (debug)', UI.textFaint);
  }

  _available() {
    const { player } = this.game;
    return player.roster.ids.filter((id) => !player.roster.get(id).isInjured(player.seasonClock.day));
  }

  // misma acción que ENTER sobre el abuelo bajo el cursor (y que el clic)
  _select(ctx, available) {
    const id = available[this.cursor];
    if (ctx.formato === 1) this._launch(ctx, [id]);
    else if (ctx.teamSel.includes(id)) ctx.teamSel = ctx.teamSel.filter((x) => x !== id);
    else if (ctx.teamSel.length < ctx.formato) ctx.teamSel.push(id);
  }

  // coste de STA del calentamiento (si se pidió) a quien juega, y a la pista
  _launch(ctx, ids) {
    const { player } = this.game;
    if (ctx.warmup && ctx.warmup.wanted) {
      for (const id of ids) player.roster.get(id).st = Math.max(0, player.roster.get(id).st - WARMUP_COST);
      ctx.warmup.done = true;
    }
    this.game.startMatch(ids);
  }

  _cycleFormat(ctx) {
    const maxF = Math.min(3, this._available().length);
    do { ctx.formato = ctx.formato % 3 + 1; } while (ctx.formato > maxF);
    ctx.teamSel = [];
  }

  _toggleWarmup(ctx) {
    if (!ctx.warmup) ctx.warmup = { wanted: false, done: false };
    ctx.warmup.wanted = !ctx.warmup.wanted;
  }

  _cycleBolas(ctx, dir) {
    const { player } = this.game;
    const owned = player.bolasOwned;
    let k = owned.indexOf(ctx.bola);
    k = (k + (dir > 0 ? 1 : owned.length - 1)) % owned.length;
    ctx.bola = owned[k]; player.bolaSel = ctx.bola; player.save();
  }

  _acceptBet(ctx) {
    const { player } = this.game;
    if (!ctx.bet || ctx.bet.accepted) return;
    ctx.acceptBet();
    player.money -= ctx.bet.stake; player.save();
  }

  // tooltip de un abuelo propio: stats completas + qué hacen, y el retrato
  // grande al lado
  _drawAbueloTooltip(id, mx, my) {
    const { screen, player, faces } = this.game;
    const s = player.roster.get(id);
    const lines = [[`edad ${s.age} · moral ${s.mo >= 0 ? '+' : ''}${s.mo} · STA ${Math.round(s.st)} · Nv.${s.level}`, UI.text]];
    for (const k of STAT_KEYS) lines.push([`${STAT[k].glyph} ${STAT[k].label.padEnd(8)} ${String(s.getStatDisplay(k)).padStart(3)}  ${STAT[k].does}`, STAT[k].color]);
    if (s.points > 0) lines.push([`${s.points} puntos por repartir en Mi Peña`, TONE.gold]);
    if (!s.signed && ABUELO_DATA[id]) wrapText(ABUELO_DATA[id].trait, 50).forEach((l) => lines.push([l, TONE.xp]));
    lines.push([`historial: ${s.career.wins}G ${s.career.losses}P`, UI.textDim]);
    const tip = tooltip(screen, mx + 2, my + 1, lines, { title: this.game.displayName(id), tone: UI.accent });
    const art = s.signed ? s.signed.portrait : faces[id] && faces[id].photo;
    if (!art) return;
    const pw = art.cols + 2, ph = art.rows + 2;
    let px = tip.x + tip.w + 1;
    if (px + pw > screen.cols) px = tip.x - pw - 1;
    if (px < 0) return;
    const py = Math.max(1, Math.min(screen.rows - ph - 1, tip.y));
    panel(screen, px, py, pw, ph, { tone: UI.accent, fill: '#0a0d12', opaque: true });
    screen.drawAnyPortrait(art, px + 1, py + 1);
  }

  // del rival solo se conoce nombre y nivel: el rollover enseña su cara
  _drawRivalTooltip(opponent, r, mx, my) {
    const { screen } = this.game;
    const tip = tooltip(screen, mx + 2, my + 1, [[`nivel ${r.aiLevel}/10`, UI.text]], { title: opponent.name, tone: TONE.rival });
    const art = r.rivalPortrait || RIVAL_FACES[0].photo;
    if (!art) return;
    const pw = art.cols + 2, ph = art.rows + 2;
    let px = tip.x + tip.w + 1;
    if (px + pw > screen.cols) px = tip.x - pw - 1;
    if (px < 0) return;
    const py = Math.max(1, Math.min(screen.rows - ph - 1, tip.y));
    panel(screen, px, py, pw, ph, { tone: TONE.rival, fill: '#0a0d12', opaque: true });
    screen.drawAnyPortrait(art, px + 1, py + 1);
  }

  _input(ctx, canStart, available, important) {
    const { input } = this.game;
    if (important && (input.hit('w') || input.hit('W'))) this._toggleWarmup(ctx);
    if (!available.length) return;
    const n = available.length;
    if (input.hit('ArrowUp')) this.cursor = Math.max(0, this.cursor - GRID_COLS);
    if (input.hit('ArrowDown')) this.cursor = Math.min(n - 1, this.cursor + GRID_COLS);
    // ←/→ se mueve entre tarjetas si hay más de una; con una sola, cambia de bolas
    if (n > 1) {
      if (input.hit('ArrowLeft')) this.cursor = (this.cursor + n - 1) % n;
      if (input.hit('ArrowRight')) this.cursor = (this.cursor + 1) % n;
    } else if (input.hit('ArrowLeft') || input.hit('ArrowRight')) this._cycleBolas(ctx, input.hit('ArrowRight') ? 1 : -1);
    if (input.hit('m') || input.hit('M')) this._cycleFormat(ctx);
    if (input.hit('Enter') || input.hit(' ')) this._select(ctx, available);
    if ((input.hit('a') || input.hit('A')) && ctx.bet && !ctx.bet.accepted) this._acceptBet(ctx);
    if (ctx.formato > 1 && (input.hit('s') || input.hit('S')) && canStart) this._launch(ctx, ctx.teamSel);
    if (input.hit('f') || input.hit('F')) this.game.simulateMatch();
  }
}
