import { ABUELO_DATA, STAT_KEYS, STAT_LABEL } from '../data/abuelos.js';
import { BOLAS } from '../data/bolas.js';
import { CLIMAS } from '../data/climas.js';
import { RIVAL_FACES } from '../data/art/rivalFaces.js';
import { wrapText, hitRect } from '../core/utils.js';
import { countryTag } from '../data/countries.js';
import { chemistryLevel, gamesFor } from '../domain/Chemistry.js';
import { archetypeFor } from '../data/rivalArchetypes.js';

const WARMUP_COST = 15;
const PANEL_Y = 3, PANEL_H = 16;
const PANELS = [
  { key: 'rival', label: 'RIVAL', x: 2, w: 33 },
  { key: 'pista', label: 'PISTA', x: 36, w: 33 },
  { key: 'clima', label: 'CLIMA', x: 70, w: 33 },
  { key: 'formato', label: 'FORMATO', x: 104, w: 33 },
];
const PX = 4; // arranque del panel de alineación, a pantalla completa bajo las categorías
const ROSTER_Y = PANEL_Y + PANEL_H + 2;

// Alineación del partido de liga de la jornada (domingo): elige quién
// juega, el juego de bolas, y de paso puedes aceptar la apuesta del bar.
// Arriba, cuatro tarjetas separadas (rival / pista / clima / formato) en
// vez de todo mezclado en líneas sueltas, cada una con su propio icono.
// El rival y cada abuelo de tu plantilla reaccionan al rollover con un
// tooltip de detalle — los tooltips se pintan siempre los últimos, para
// quedar por encima de cualquier otra cosa en pantalla.
export class LineupScreen {
  constructor(game) { this.game = game; this.cursor = 0; }

  draw() {
    const { screen, input, player, frame } = this.game;
    const ctx = this.game.weeklyMatch;
    screen.clear();
    const r = ctx.currentRound;
    const opponent = ctx.opponentClub;
    if (ctx.isEuropean) {
      screen.textCenter(1, `╣ COPA DE EUROPA — ${ctx.cup.roundName} · SEDE: ${ctx.city.name} ╠`, '#88c8e8');
    } else if (ctx.isCup) {
      screen.textCenter(1, `╣ COPA DE ESPAÑA — ${ctx.cup.roundName} · SEDE: ${ctx.city.name} ╠`, '#ffd75e');
    } else if (ctx.isFriendly) {
      screen.textCenter(1, `╣ AMISTOSO DE PRETEMPORADA · SEDE: ${ctx.city.name} ╠`, '#88c8e8');
    } else {
      screen.textCenter(1, `╣ JORNADA ${ctx.league.matchday + 1} — LIGA DE ${ctx.city.name} ╠`, ctx.city.color);
    }
    if (ctx.festival) screen.textCenter(2, `🎉 ${ctx.festival} — ambiente de feria, mejor taquilla si se gana 🎉`, frame % 24 < 16 ? '#ffb347' : '#c98a3a');

    const isNemesis = !ctx.isCup && !ctx.isFriendly && player.nemesis && player.nemesis.city === opponent.id;
    const isDerby = !ctx.isCup && !ctx.isFriendly && player.derbyClub && player.derbyClub.id === opponent.id;
    const important = ctx.isCup || isDerby || isNemesis;

    let rivalHover = null, rowHover = null;

    for (const p of PANELS) screen.box(p.x, PANEL_Y, p.w, PANEL_H, '#8a7f66');
    for (const p of PANELS) screen.text(p.x + 2, PANEL_Y, ` ${p.label} `, '#ffb347');

    // --- RIVAL: thumbnail + nombre/nivel/puntos + derbi/némesis ---
    {
      const p = PANELS[0];
      const rx = p.x + 2, ry = PANEL_Y + 2;
      rivalHover = hitRect(input.mouse.cx, input.mouse.cy, p.x, PANEL_Y, p.w, PANEL_H) ? { opponent, r } : null;
      screen.drawAnyPortrait(r.rivalMini || r.rivalPortrait || RIVAL_FACES[0].photo, rx, ry);
      screen.text(p.x + 2, PANEL_Y + PANEL_H - 4, opponent.name.slice(0, p.w - 4), isDerby ? '#ffb347' : '#ef9f9f');
      const euroTag = ctx.isEuropean && ctx.cup.playerOpponent() ? ` ${countryTag(ctx.cup.playerOpponent().country) || ' (España)'}` : '';
      screen.text(p.x + 2, PANEL_Y + PANEL_H - 3, `Nivel ${r.aiLevel}/10   ·   ${opponent.pts} pts${euroTag}`, '#c9c2a8');
      if (isDerby) screen.text(p.x + 2, PANEL_Y + PANEL_H - 2, `¡EL DERBI! (${player.derbyHistory.wins}-${player.derbyHistory.losses})`, frame % 20 < 14 ? '#ffb347' : '#a08050');
      else if (isNemesis) screen.text(p.x + 2, PANEL_Y + PANEL_H - 2, '¡TU NÉMESIS! Véngate.', frame % 20 < 14 ? '#ff8c5b' : '#a05838');
      // estilo de juego del capitán rival: solo si ya se lo has visto hacer
      // (ver domain/Club.seenArchetype) — partidos de liga solamente, en
      // copa el rival es un cruce puntual y no llega a "conocerse"
      if (!ctx.isCup && !ctx.isFriendly && opponent.seenArchetype) {
        screen.text(p.x + 2, PANEL_Y + PANEL_H - 1, archetypeFor(opponent.name).label, '#c8a0e8');
      }
    }

    // --- PISTA: mini icono de cancha + ciudad + descripción ---
    {
      const p = PANELS[1];
      const ix = p.x + 2, iy = PANEL_Y + 2;
      screen.text(ix, iy, '┌──────────┐', ctx.city.color);
      screen.text(ix, iy + 1, '│    ◦     │', ctx.city.color);
      screen.text(ix, iy + 2, '└──────────┘', ctx.city.color);
      screen.text(p.x + 2, iy + 4, ctx.city.name.toUpperCase(), '#ffe680');
      wrapText(ctx.city.feature.desc, p.w - 4).slice(0, 6).forEach((l, k) => screen.text(p.x + 2, iy + 5 + k, l, '#9a927a'));
    }

    // --- CLIMA: icono en bloque + etiqueta + aviso de cambio ---
    const cl = CLIMAS[r.forecast.main];
    {
      const p = PANELS[2];
      const ix = p.x + 2, iy = PANEL_Y + 2;
      for (let row = 0; row < 3; row++) screen.text(ix, iy + row, `${cl.icon} ${cl.icon} ${cl.icon}`, cl.color);
      screen.text(p.x + 2, iy + 4, cl.label, cl.color);
      if (r.forecast.changeProb > 0) {
        wrapText(`ojo, podría cambiar a ${CLIMAS[r.forecast.changeTo].icon} ${CLIMAS[r.forecast.changeTo].label}`, p.w - 4)
          .forEach((l, k) => screen.text(p.x + 2, iy + 6 + k, l, '#9a927a'));
      }
      if (ctx.isCup) {
        screen.text(p.x + 2, PANEL_Y + PANEL_H - 2, 'partido único: quien gana pasa', '#9a927a');
      } else if (ctx.isFriendly) {
        screen.text(p.x + 2, PANEL_Y + PANEL_H - 3, 'amistoso: no cuenta', '#9a927a');
        screen.text(p.x + 2, PANEL_Y + PANEL_H - 2, 'para la clasificación', '#9a927a');
      } else {
        const top1 = ctx.league.standings()[0];
        const myRank = ctx.league.standings().findIndex((c) => c.isPlayer) + 1;
        screen.text(p.x + 2, PANEL_Y + PANEL_H - 3, `líder: ${top1.name.slice(0, p.w - 10)}`, '#9a927a');
        screen.text(p.x + 2, PANEL_Y + PANEL_H - 2, `(${top1.pts}pts) · tú vas ${myRank}º`, '#9a927a');
      }
    }

    // --- FORMATO: pictograma de bolas + etiqueta + calentamiento ---
    {
      const p = PANELS[3];
      const formatoLabel = { 1: '1 CONTRA 1', 2: 'DOBLETE (2)', 3: 'TRIPLETA (3)' }[ctx.formato];
      const dots = Array.from({ length: ctx.formato }, (_, i) => (i < ctx.teamSel.length ? '●' : '○')).join(' ');
      screen.text(p.x + 2, PANEL_Y + 2, dots, '#7CFC00');
      screen.text(p.x + 2, PANEL_Y + 4, formatoLabel, '#ffe680');
      screen.text(p.x + 2, PANEL_Y + 5, '[M] cambiar formato', '#8a7f66');
      screen.text(p.x + 2, PANEL_Y + 6, ctx.formato === 1 ? 'elige y sales a la pista' : `${ctx.teamSel.length}/${ctx.formato} elegidos`, '#c9c2a8');
      if (important) {
        const on = ctx.warmup && ctx.warmup.wanted;
        wrapText(`[W] calentamiento (-${WARMUP_COST} STA, tiro más firme): ${on ? 'SÍ' : 'no'}`, p.w - 4)
          .forEach((l, k) => screen.text(p.x + 2, PANEL_Y + 9 + k, l, on ? '#7CFC00' : '#8a7f66'));
      }
    }

    // --- plantilla disponible ---
    const available = this._available();
    if (available.length && this.cursor >= available.length) this.cursor = 0;
    screen.text(PX, ROSTER_Y - 1, '¿QUIÉN JUEGA?', '#7CFC00');

    let yy = ROSTER_Y + 1;
    for (let k = 0; k < available.length; k++) {
      const id = available[k];
      const s = player.roster.get(id);
      const d = ABUELO_DATA[id];
      const sel = k === this.cursor;
      const picked = ctx.teamSel.includes(id);
      const stCol = s.st > 60 ? '#7ec850' : s.st > 30 ? '#ffe14d' : '#ff5c5c';
      const aff = d.clima[r.forecast.main] !== undefined ? d.clima[r.forecast.main] : 0;
      const affStr = r.forecast.main === 'SOL' ? '  ' : aff === 1 ? ' ✚' : aff === -1 ? ' ▼' : '  ';
      const affCol = aff === 1 ? '#7ec850' : aff === -1 ? '#ff5c5c' : '#666';
      // una sola línea por abuelo: las 5 stats ya no hace falta repetirlas
      // aquí, viven en el tooltip del rollover — así caben todos sin scroll
      const rowRect = { x: PX - 1, y: yy, w: 130, h: 1 };
      const over = hitRect(input.mouse.cx, input.mouse.cy, rowRect.x, rowRect.y, rowRect.w, rowRect.h);
      if (over) rowHover = { id, k };
      if (sel || over) screen.text(rowRect.x, yy, ' '.repeat(rowRect.w), '#3a4a3a');
      // vínculo con quien ya esté elegido para este partido (ver
      // domain/Chemistry.js): un corazón junto al nombre si la pareja
      // llega con algo de rodaje, más lleno cuanto más fuerte el vínculo
      const bondLvl = ctx.teamSel.filter((oid) => oid !== id)
        .reduce((best, oid) => Math.max(best, chemistryLevel(gamesFor(player.chemistry, id, oid))), 0);
      const bondIcon = bondLvl >= 3 ? '♥' : bondLvl >= 1 ? '♡' : '';
      const bondCol = bondLvl >= 3 ? '#ff8fc0' : '#a8e8c8';
      screen.text(PX + 1, yy, `${picked ? '✓ ' : '  '}${this.game.displayName(id)}`, picked ? '#ffe680' : (sel || over) ? '#fff' : '#c9c2a8');
      if (bondIcon) screen.text(PX + 21, yy, bondIcon, bondCol);
      screen.text(PX + 24, yy, `STA ${'▮'.repeat(Math.round(s.st / 12.5))}${'▯'.repeat(8 - Math.round(s.st / 12.5))} ${Math.round(s.st)}`, stCol);
      screen.text(PX + 48, yy, `MOR ${s.mo >= 0 ? '+' : ''}${s.mo}`, s.mo >= 0 ? '#88e088' : '#ef9f9f');
      screen.text(PX + 60, yy, `${CLIMAS[r.forecast.main].icon}${affStr}`, affCol);
      yy += 2;
      if (yy > 36) break;
    }

    const injured = player.roster.ids.filter((id) => player.roster.get(id).isInjured(player.seasonClock.day));
    if (injured.length) {
      const dias = Math.max(...injured.map((id) => player.roster.get(id).injuredUntil - player.seasonClock.day));
      screen.text(PX, 38, `De baja: ${injured.map((id) => this.game.displayName(id)).join(', ')} (vuelve en ${dias}d)`, '#ff8c5b');
    }

    const bolaName = BOLAS[ctx.bola].name;
    const many = player.bolasOwned.length > 1;
    screen.text(PX, 39, `BOLAS: ${many ? '◀ ' : ''}${bolaName}${many ? ' ▶' : ''}`, '#88c8e8');
    screen.text(PX + 10 + bolaName.length + (many ? 4 : 0) + 3, 39, BOLAS[ctx.bola].desc.slice(0, 60), '#6a86a0');

    if (ctx.bet) {
      if (ctx.bet.accepted) screen.text(PX, 41, `✔ Apuesta aceptada: ${ctx.bet.desc}`, '#ffcf8a');
      else screen.text(PX, 41, `EL DEL BAR: "${ctx.bet.desc}"   [A] aceptar`, frame % 30 < 22 ? '#ffcf8a' : '#a08050');
    }

    if (this.game.deathEvent) screen.text(PX, 42, this.game.deathEvent.text, '#c9c2a8');
    else if (this.game.calendarEvent) screen.text(PX, 42, this.game.calendarEvent.text, '#ff9c5b');

    const canStart = ctx.teamSel.length === ctx.formato;
    const baseHelp = ctx.formato === 1
      ? '[↑/↓] abuelo · ratón = detalle/elegir   [ENTER] jugar   [←/→] bolas   [F] simular (debug)'
      : `[↑/↓] abuelo · ratón = detalle/elegir   [ENTER] elegir/quitar   [←/→] bolas   [F] simular (debug)   (${ctx.teamSel.length}/${ctx.formato})`;
    screen.text(PX + Math.floor((130 - baseHelp.length) / 2), 44, baseHelp, '#c9c2a8');
    if (ctx.formato > 1 && canStart && frame % 24 < 16) {
      const goLabel = '▶ [S] ¡A LA PISTA! ◀';
      screen.text(PX + Math.floor((130 - goLabel.length) / 2), 45, goLabel, '#7CFC00');
    }

    this._input(ctx, canStart, available, important);

    // los tooltips se pintan al final de todo, para quedar siempre por
    // encima del resto (paneles, plantilla, avisos...)
    if (rowHover) this._drawAbueloTooltip(rowHover.id, input.mouse.cx, input.mouse.cy);
    if (rivalHover) this._drawRivalTooltip(rivalHover.opponent, rivalHover.r, input.mouse.cx, input.mouse.cy);
    if (rowHover && input.mouse.clicked) { this.cursor = rowHover.k; this._select(ctx, available); }
  }

  _available() {
    const { player } = this.game;
    return player.roster.ids.filter((id) => !player.roster.get(id).isInjured(player.seasonClock.day));
  }

  // misma acción que hace [ENTER] sobre el abuelo bajo el cursor, para que
  // el clic del ratón se comporte igual que el teclado
  _select(ctx, available) {
    const id = available[this.cursor];
    if (ctx.formato === 1) this._launch(ctx, [id]);
    else if (ctx.teamSel.includes(id)) ctx.teamSel = ctx.teamSel.filter((x) => x !== id);
    else if (ctx.teamSel.length < ctx.formato) ctx.teamSel.push(id);
  }

  // aplica el coste de STA del calentamiento (si se pidió) a quien vaya a
  // jugar de verdad, y solo entonces arranca el partido
  _launch(ctx, ids) {
    const { player } = this.game;
    if (ctx.warmup && ctx.warmup.wanted) {
      for (const id of ids) player.roster.get(id).st = Math.max(0, player.roster.get(id).st - WARMUP_COST);
      ctx.warmup.done = true;
    }
    this.game.startMatch(ids);
  }

  _fillBlack(x, y, w, h) {
    const { screen } = this.game;
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) screen.put(x + c, y + r, '█', '#000');
  }

  // tooltip de un abuelo propio: retrato grande + stats completas, igual
  // que en Mi Peña, para no tener que ir y volver de pantalla para mirarlo
  _drawAbueloTooltip(id, mx, my) {
    const { screen, player, faces } = this.game;
    const s = player.roster.get(id);
    const f = faces[id];
    const lines = [];
    lines.push([this.game.displayName(id), '#ffe680']);
    lines.push([`edad ${s.age}  ·  moral ${s.mo >= 0 ? '+' : ''}${s.mo}  ·  STA ${Math.round(s.st)}`, '#c9c2a8']);
    lines.push([`Nv.${s.level}  ·  ${STAT_KEYS.map((k) => `${STAT_LABEL[k][0]}${s.getStatDisplay(k)}`).join('  ')}`, '#88c8e8']);
    if (s.points > 0) lines.push([`${s.points} puntos por repartir en Mi Peña`, '#ffd75e']);
    if (!s.signed) wrapText(ABUELO_DATA[id].trait, 42).forEach((l) => lines.push(['  ' + l, '#d8b8e8']));
    lines.push([`${s.career.wins}V ${s.career.losses}D`, '#9a927a']);

    const tw = Math.min(56, Math.max(...lines.map((l) => l[0].length)) + 4);
    const th = lines.length + 2;
    const tx = Math.min(mx + 2, screen.cols - tw - 1);
    const ty = Math.min(my + 1, screen.rows - th - 1);
    this._fillBlack(tx, ty, tw, th);
    screen.box(tx, ty, tw, th, '#ffe14d', 'double');
    lines.forEach((l, i) => screen.text(tx + 2, ty + 1 + i, l[0].slice(0, tw - 3), l[1]));

    const art = s.signed ? s.signed.portrait : f.photo;
    if (!art) return;
    const pw = art.cols + 2, ph = art.rows + 3;
    const py = Math.max(1, Math.min(screen.rows - ph - 1, Math.floor((screen.rows - ph) / 2)));
    let px = tx + tw + 1;
    if (px + pw > screen.cols) px = tx - pw - 1;
    if (px < 0) return;
    this._fillBlack(px, py, pw, ph);
    screen.box(px, py, pw, ph, '#ffe14d', 'double');
    screen.drawAnyPortrait(art, px + 1, py + 1);
  }

  // del rival solo conocemos nombre y nivel (no sus 5 stats reales): el
  // rollover sirve sobre todo para ver el retrato en grande
  _drawRivalTooltip(opponent, r, mx, my) {
    const { screen } = this.game;
    const lines = [[opponent.name, '#ef9f9f'], [`Nivel ${r.aiLevel}/10`, '#c9c2a8']];
    const tw = Math.min(40, Math.max(...lines.map((l) => l[0].length)) + 4);
    const th = lines.length + 2;
    const tx = Math.min(mx + 2, screen.cols - tw - 1);
    const ty = Math.min(my + 1, screen.rows - th - 1);
    this._fillBlack(tx, ty, tw, th);
    screen.box(tx, ty, tw, th, '#ef7676', 'double');
    lines.forEach((l, i) => screen.text(tx + 2, ty + 1 + i, l[0], l[1]));

    const art = r.rivalPortrait || RIVAL_FACES[0].photo;
    if (!art) return;
    const pw = art.cols + 2, ph = art.rows + 3;
    const py = Math.max(1, Math.min(screen.rows - ph - 1, Math.floor((screen.rows - ph) / 2)));
    let px = tx + tw + 1;
    if (px + pw > screen.cols) px = tx - pw - 1;
    if (px < 0) return;
    this._fillBlack(px, py, pw, ph);
    screen.box(px, py, pw, ph, '#ef7676', 'double');
    screen.drawAnyPortrait(art, px + 1, py + 1);
  }

  _input(ctx, canStart, available, important) {
    const { input, player } = this.game;
    if (important && (input.hit('w') || input.hit('W'))) {
      if (!ctx.warmup) ctx.warmup = { wanted: false, done: false };
      ctx.warmup.wanted = !ctx.warmup.wanted;
    }
    if (!available.length) return;
    if (input.hit('ArrowUp')) this.cursor = (this.cursor + available.length - 1) % available.length;
    if (input.hit('ArrowDown')) this.cursor = (this.cursor + 1) % available.length;
    if (input.hit('m') || input.hit('M')) {
      const maxF = Math.min(3, available.length);
      do { ctx.formato = ctx.formato % 3 + 1; } while (ctx.formato > maxF);
      ctx.teamSel = [];
    }
    if (input.hit('Enter') || input.hit(' ')) this._select(ctx, available);
    if (input.hit('ArrowLeft') || input.hit('ArrowRight')) {
      const owned = player.bolasOwned;
      let k = owned.indexOf(ctx.bola);
      k = (k + (input.hit('ArrowRight') ? 1 : owned.length - 1)) % owned.length;
      ctx.bola = owned[k]; player.bolaSel = ctx.bola; player.save();
    }
    if ((input.hit('a') || input.hit('A')) && ctx.bet && !ctx.bet.accepted) {
      ctx.acceptBet();
      player.money -= ctx.bet.stake; player.save();
    }
    if (ctx.formato > 1 && (input.hit('s') || input.hit('S')) && canStart) this._launch(ctx, ctx.teamSel);
    if (input.hit('f') || input.hit('F')) this.game.simulateMatch();
  }
}
