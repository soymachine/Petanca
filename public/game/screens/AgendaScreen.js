import { TabsBar } from './TabsBar.js';
import { countryTag } from '../data/countries.js';
import { wrapText, hitRect, truncate } from '../core/utils.js';
import { fillDecisionText } from '../data/decisionEvents.js';
import { TRAINING_DRILLS } from '../data/trainingDrills.js';
import { STAT_LABEL } from '../data/abuelos.js';
import { UI, TONE, STAT, tint, desaturate } from '../ui/theme.js';
import { panel, bigButton, button, badge, tooltip } from '../ui/widgets.js';

const FONT = '"Menlo", "Consolas", "DejaVu Sans Mono", monospace';
const WD_SHORT = { lunes: 'LUN', martes: 'MAR', miércoles: 'MIÉ', jueves: 'JUE', viernes: 'VIE', sábado: 'SÁB', domingo: 'DOM' };
// tablero: dos semanas, 7 casillas por semana (lunes siempre en su columna)
const TILE_W = 18, TILE_H = 13, GX = 4, GY = 8, WEEK_GAP = 2;
const STATUS_Y = GY + 2 * TILE_H + WEEK_GAP + 1;
// código visual de cada tipo de día (icono + color), el mismo en casilla y tooltip
const KIND = {
  match: { icon: '◉', col: TONE.good, label: 'LIGA' },
  cup: { icon: '♛', col: TONE.gold, label: 'COPA' },
  euro: { icon: '✪', col: '#6fb8ff', label: 'EUROPA' },
  training: { icon: '✎', col: '#9ad0c0', label: 'ENTRENO' },
};
const STEP_FRAMES = 12; // ritmo del avance automático por días vacíos
const PAUSE_FRAMES = 60; // pausa (~1s) al caer en un día con evento antes de entrar
const PAGE_STEP = 2; // el pasador siempre mueve las dos semanas visibles a la vez
const MAX_PAGE_AHEAD = 12; // tope de semanas que se puede pasar hacia delante

// La agenda a pantalla completa: un tablero de dos semanas (Fase 4 del
// rediseño, docs/REDISENO.md) con una casilla grande por día — número en
// grande, icono y color del evento (◉ liga, ♛ Copa, ✪ Europa, ✎ entreno),
// hoy con borde que late, días ya pasados sellados con su marcador. Las
// posiciones son FIJAS por día de la semana (lunes siempre en su columna):
// solo cambia de página semana a semana, nunca se desplaza día a día.
// [ENTER] no salta directo al próximo evento: avanza día a día marcando
// cada jornada vacía como completada, y en cuanto cae en un día con algo
// agendado se detiene un segundo y entra a ese evento. Un pasador de
// páginas (◀/▶) permite ver semanas futuras sin tocar el avance real del
// calendario — para planificar fichajes/entrenos con partidos ya a la vista.
export class AgendaScreen {
  constructor(game) {
    this.game = game; this.schedule = null; this.playing = null; this.pageOffset = 0; this.decisionCursor = 0;
    // qué semana ocupa la página izquierda cuando pageOffset es 0 ("la
    // pareja de semanas de casa"). Normalmente coincide con la semana de
    // hoy, PERO durante el avance automático se mantiene fija hasta que
    // las DOS semanas del libro (izquierda y derecha) quedan en el pasado
    // — si no, cada vez que el reloj cruza a la semana siguiente el libro
    // se desplazaría de una en una, y la derecha nunca llegaría a verse
    // completa antes de desaparecer. Ver draw().
    this.leftWeek = null;
  }

  draw() {
    const { screen, input, player, frame } = this.game;
    screen.clear();
    if (this.schedule && input.hit('Escape')) { this.schedule = null; input.pressed.Escape = false; }
    // un evento de decisión no se puede cancelar con ESC (hay que elegir
    // una opción), pero tampoco debe dejar pasar la tecla al atajo global
    // "ESC = Inicio" de TabsBar, o se sale de la Agenda sin resolverlo
    if (this.game.decisionEvent && input.hit('Escape')) { input.pressed.Escape = false; }
    TabsBar.draw(this.game, 'agenda');

    // el primer amistoso se juega de verdad (pasa por alineación y partido
    // completo) y vuelve aquí al terminar: se recoge el resultado y se
    // muestra con el mismo cartelito que los amistosos instantáneos
    if (this.game.friendlyJustPlayed) {
      this.friendlyResult = { ...this.game.friendlyJustPlayed, frame: 0 };
      this.game.friendlyJustPlayed = null;
    }

    // evento de decisión pendiente: pausa cualquier avance automático hasta
    // que se elija una opción (ver core/Game.js._rollDecision/resolveDecision)
    if (this.game.decisionEvent) { this._drawDecisionModal(); return; }

    // avance automático día a día: cada paso marca el día como completado;
    // si cae en un evento, se detiene un segundo y entra a él
    if (this.playing && !this.schedule && frame >= this.playing.nextAt) {
      if (this.playing.pendingEvent) {
        const ev = this.playing.pendingEvent;
        this.playing = null;
        this.game.triggerEvent(ev);
        return;
      }
      const result = this.game.advanceOneDay();
      if (result.type === 'free') this.playing.nextAt = frame + STEP_FRAMES;
      else { this.playing.pendingEvent = result; this.playing.nextAt = frame + PAUSE_FRAMES; }
      this.pageOffset = 0; // el avance automático siempre vuelve a mostrar la semana real
    }

    const clock = player.seasonClock;
    // this.leftWeek es la semana "de casa" (página izquierda cuando
    // pageOffset=0): se inicializa a la semana de hoy, y solo salta hacia
    // delante de dos en dos, en cuanto el reloj entra en la TERCERA semana
    // — es decir, cuando tanto la izquierda como la derecha ya quedaron
    // atrás. Se resincroniza cada frame (no solo durante el avance
    // automático) por si el reloj avanza por otra vía (modo Debugger).
    // si el ancla venía de una temporada ya cerrada (ascenso/descenso/fin
    // de temporada corrido justo entre un frame y el siguiente), se
    // resincroniza de golpe con la semana real en vez de arrastrar una
    // pareja de semanas de una liga que ya no es la actual
    if (this.leftWeek === null || this.leftWeek < clock.seasonWeekOffset) this.leftWeek = clock.weekIndex;
    while (clock.weekIndex >= this.leftWeek + 2) this.leftWeek += 2;
    // banda de título: AGENDA a la izquierda, HOY a la derecha
    screen.fill(0, 3, screen.cols, 3, '#0f1520');
    const todayLabel = `HOY · ${clock.weekdayName.toUpperCase()} · SEMANA ${clock.weekIndex + 1}`;
    screen.layer('over', (c, R) => {
      c.textBaseline = 'middle'; c.font = `bold ${R.ch * 1.5}px ${FONT}`;
      c.textAlign = 'left'; c.fillStyle = UI.accent; c.shadowColor = UI.accent; c.shadowBlur = R.ch * 0.5;
      c.fillText('AGENDA', R.cx(GX), R.cy(4.5));
      c.font = `bold ${R.ch * 1.0}px ${FONT}`; c.textAlign = 'right';
      c.fillStyle = UI.accentHi; c.shadowColor = UI.accentHi;
      c.fillText(todayLabel, R.cx(screen.cols - GX), R.cy(4.5));
      c.shadowBlur = 0;
    });
    // leyenda del código de colores, en la propia banda
    let lgx = GX + 16;
    for (const k of ['match', 'cup', 'euro', 'training']) {
      screen.text(lgx, 4, `${KIND[k].icon} ${KIND[k].label.toLowerCase()}`, KIND[k].col);
      lgx += KIND[k].label.length + 5;
    }

    // pasador de páginas: qué par de semanas se ve ahora mismo, sin tocar
    // el avance real del calendario (this.pageOffset es solo de cámara).
    // Hacia delante, tope de MAX_PAGE_AHEAD semanas; hacia atrás, se puede
    // retroceder hasta la primera semana de la temporada EN CURSO (no
    // tiene sentido ir más atrás: el calendario de una liga que ya cerró
    // temporada no es el mismo, y matchdayForWeek daría jornadas que ya no
    // corresponden a nada real de la liga actual).
    const minPageOffset = Math.min(0, clock.seasonWeekOffset - this.leftWeek);
    this.pageOffset = Math.max(minPageOffset, Math.min(MAX_PAGE_AHEAD, this.pageOffset));
    const baseWeek = this.leftWeek + this.pageOffset;
    const week1 = clock.weekAt(baseWeek, player.league);
    const week2 = clock.weekAt(baseWeek + 1, player.league);
    const bx = GX, bookW = 7 * TILE_W + 6;

    // flechas de paginación a los lados del tablero (no parpadean: el
    // parpadeo queda reservado a "hoy")
    const canPagePrev = this.pageOffset > minPageOffset;
    const canPageNext = this.pageOffset < MAX_PAGE_AHEAD;
    const midY = GY + TILE_H;
    screen.text(bx - 3, midY, '◀', canPagePrev ? UI.accentHi : '#2a2f3a');
    screen.text(bx + bookW + 1, midY, '▶', canPageNext ? UI.accentHi : '#2a2f3a');

    let hover = null;
    [week1, week2].forEach((week, wi) => {
      const wy = GY + wi * (TILE_H + WEEK_GAP);
      const thisWeek = week.some((d) => d.day === clock.day);
      screen.text(bx, wy - 1, `SEMANA ${baseWeek + 1 + wi}`, thisWeek ? UI.accentHi : UI.textDim);
      if (thisWeek) screen.text(bx + 11, wy - 1, '· esta semana', UI.textDim);
      week.forEach((d, i) => {
        const x = bx + i * (TILE_W + 1);
        const entry = this._dayEntry(d);
        const isToday = d.day === clock.day;
        const completed = d.day < clock.day;
        const over = !this.playing && hitRect(input.mouse.cx, input.mouse.cy, x, wy, TILE_W, TILE_H);
        if (over) hover = { d, entry, completed };
        this._drawTile(x, wy, d, entry, isToday, completed, over, frame);
      });
    });

    const canFriendly = !this.playing && this.pageOffset === 0 && player.league.matchday === 0 && player.friendliesLeft > 0;
    if (this.playing) {
      const label = this.playing.pendingEvent ? '⏸ algo pasa hoy... un momento' : '▶▶ avanzando por la agenda...';
      screen.textCenter(STATUS_Y, label, frame % 20 < 14 ? TONE.good : '#4a8a4a');
    } else if (this.pageOffset > 0) {
      screen.textCenter(STATUS_Y, `estás viendo por delante — [→ ${MAX_PAGE_AHEAD - this.pageOffset} más] · vuelve con [←] hasta la semana actual`, UI.textDim);
    } else if (this.pageOffset < 0) {
      screen.textCenter(STATUS_Y, canPagePrev
        ? 'estás viendo el pasado de esta temporada — vuelve con [→] hasta la semana actual'
        : 'primera semana de la temporada — no se puede ir más atrás', UI.textDim);
    }
    if (this.friendlyResult) {
      this.friendlyResult.frame++;
      const txt = this.friendlyResult.won ? `AMISTOSO GANADO ante ${this.friendlyResult.opponent}` : `Amistoso perdido ante ${this.friendlyResult.opponent}`;
      screen.textCenter(STATUS_Y, txt, this.friendlyResult.won ? TONE.good : '#ff8c5b');
      if (this.friendlyResult.frame > 90) this.friendlyResult = null;
    }

    // botones: avanzar (o volver a hoy si se está mirando otra semana),
    // amistoso de pretemporada y cuadro de Europa
    let clickAdvance = false, clickFriendly = false, clickEuro = false, clickHome = false;
    if (!this.schedule && !this.playing) {
      const by = STATUS_Y + 2;
      if (this.pageOffset === 0) clickAdvance = bigButton(this.game, 45, by, 50, 'AVANZAR DÍA A DÍA ▶▶  [ENTER]', { tone: TONE.good, selected: true });
      else clickHome = bigButton(this.game, 45, by, 50, 'VOLVER A HOY', { tone: UI.accent });
      if (canFriendly) clickFriendly = button(this.game, GX, by + 1, `AMISTOSO (quedan ${player.friendliesLeft})`, { hotkey: 'F', w: 36 });
      if (player.euroCup) clickEuro = button(this.game, screen.cols - GX - 30, by + 1, 'CUADRO DE EUROPA', { hotkey: 'E', w: 30, tone: KIND.euro.col });
    }
    const navHelp = canPagePrev ? '←→ semanas pasadas/futuras' : '→ semanas futuras';
    screen.textCenter(STATUS_Y + 6, `ENTER avanzar · ${navHelp} · clic en un día libre = agendar entreno · clic en un entreno = cancelarlo`, UI.textFaint);

    if (hover) this._drawDayTooltip(hover.d, hover.entry, input.mouse.cx, input.mouse.cy, hover.completed);
    // un día ya pasado (sellado en la agenda con el relleno ▓) no puede
    // recibir un entreno nuevo: por muy "libre" que estuviera ese hueco,
    // ya no hay manera de que SeasonClock lo ejecute — solo comprueba
    // this.trainings[day] según el reloj avanza hacia delante, así que
    // agendar en el pasado dejaba el entreno agendado pero nunca se jugaba
    if (!this.playing && hover && !hover.completed && input.mouse.clicked && hover.entry.kind === 'free' && !hover.d.isMatchDay) {
      this.schedule = { day: hover.d.day, step: 'abuelo', abueloId: null, cursor: 0 };
    }
    if (!this.playing && hover && input.mouse.clicked && hover.entry.kind === 'training') {
      player.seasonClock.clearTraining(hover.d.day);
      player.save();
    }
    if (this.schedule) { this._drawScheduleModal(); return; }
    if (!this.playing) {
      if (input.hit('ArrowLeft') || (input.mouse.clicked && canPagePrev && input.mouse.cx < bx && input.mouse.cx >= bx - 4)) this.pageOffset -= PAGE_STEP;
      if (input.hit('ArrowRight') || (input.mouse.clicked && canPageNext && input.mouse.cx >= bx + bookW && input.mouse.cx < bx + bookW + 4)) this.pageOffset += PAGE_STEP;
      if (clickHome) this.pageOffset = 0;
    }
    if (!this.playing && this.pageOffset === 0 && (clickAdvance || input.hit('Enter') || input.hit(' '))) this.playing = { nextAt: frame, pendingEvent: null };
    if (canFriendly && (clickFriendly || input.hit('f') || input.hit('F'))) {
      const result = this.game.playFriendly();
      if (result) this.friendlyResult = { won: result.won, opponent: result.opponent.name, frame: 0 };
    }
    if (player.euroCup && (clickEuro || input.hit('e') || input.hit('E'))) this.game.state = 'eurocup';
  }

  // una casilla del tablero: número grande, icono del evento, qué hay ese
  // día, y el sello de "hecho" (con marcador si se jugó) o el borde de HOY
  _drawTile(x, y, d, entry, isToday, completed, over, frame) {
    const { screen } = this.game;
    const kind = entry.kind === 'cup' ? (entry.european ? KIND.euro : KIND.cup) : KIND[entry.kind] || null;
    const col = kind ? (completed ? desaturate(kind.col, 0.55) : kind.col) : UI.textDim;
    const fill = completed ? '#0d1310' : over ? UI.panelHi : kind ? tint(kind.col, 0.13) : UI.panel;
    const edge = isToday ? UI.accent : over ? UI.accentHi : completed ? '#243224' : kind ? tint(kind.col, 0.6) : UI.edgeDim;
    const wd = WD_SHORT[d.weekdayName];
    panel(screen, x, y, TILE_W, TILE_H, { title: wd, tone: edge, fill, style: isToday ? 'double' : 'single', titleColor: isToday ? UI.accentHi : completed ? '#5a7a5a' : d.isMatchDay ? UI.text : UI.textDim });
    const numCol = isToday ? UI.accentHi : completed ? '#4a6a4a' : UI.text;
    screen.layer('over', (c, R) => {
      c.textBaseline = 'middle';
      c.font = `bold ${R.ch * 1.9}px ${FONT}`; c.textAlign = 'left';
      c.fillStyle = numCol;
      if (isToday) { c.shadowColor = UI.accent; c.shadowBlur = R.ch * 0.6; }
      c.fillText(String(d.day), R.cx(x + 2), R.cy(y + 2.6));
      if (kind) {
        c.font = `${R.ch * 2.1}px ${FONT}`; c.textAlign = 'center';
        c.fillStyle = col; c.shadowColor = col; c.shadowBlur = completed ? 0 : R.ch * 0.5;
        c.fillText(kind.icon, R.cx(x + TILE_W - 4), R.cy(y + 2.6));
      }
      c.shadowBlur = 0;
      if (isToday) {
        // borde de HOY que respira
        c.strokeStyle = UI.accent; c.lineWidth = Math.max(1, R.cw * 0.15);
        c.globalAlpha = 0.35 + 0.35 * Math.abs(Math.sin(frame * 0.08));
        c.shadowColor = UI.accent; c.shadowBlur = R.ch * 0.8;
        c.strokeRect(R.cx(x) - R.cw * 0.3, R.cy(y) - R.ch * 0.3, R.cw * (TILE_W + 0.6), R.ch * (TILE_H + 0.6));
        c.globalAlpha = 1; c.shadowBlur = 0;
      }
    });
    let ly = y + 5;
    for (const [t, c] of this._tileLines(entry)) {
      for (const l of wrapText(t, TILE_W - 4)) {
        if (ly > y + TILE_H - 4) break;
        screen.text(x + 2, ly++, l, completed ? desaturate(c, 0.5) : c);
      }
    }
    const by = y + TILE_H - 2;
    if (entry.result) {
      const r = entry.result;
      screen.text(x + 2, by, `${r.won ? '✔ GANADO' : '✘ PERDIDO'}`, r.won ? '#7ec850' : '#ff8c5b');
      screen.text(x + TILE_W - 2 - `${r.scoreP}-${r.scoreA}`.length, by, `${r.scoreP}-${r.scoreA}`, UI.text);
    } else if (completed) screen.text(x + 2, by, '✔', '#3a5a3a');
    else if (over && entry.kind === 'free' && !d.isMatchDay) screen.text(x + 2, by, '+ entreno', frame % 20 < 14 ? TONE.good : '#4a8a4a');
    else if (over && entry.kind === 'training') screen.text(x + 2, by, '✕ cancelar', '#ff8c5b');
    else if (!kind && d.isMatchDay) screen.text(x + 2, by, 'descanso', UI.textFaint);
    if (isToday) badge(screen, x + TILE_W - 7, y + TILE_H - 1, 'HOY', frame % 20 < 14 ? UI.accentHi : UI.accent);
  }

  // qué se escribe dentro de la casilla, en líneas [texto, color]
  _tileLines(entry) {
    const r = entry.result;
    if (r) {
      if (r.kind === 'league') return [['LIGA', KIND.match.col], [`vs ${r.oppName}`, UI.text], ...(r.isDerby ? [['¡DERBI!', '#ff9c5b']] : [])];
      const k = r.kind === 'eurocup' ? KIND.euro : KIND.cup;
      return [[k.label, k.col], [r.roundName.toLowerCase(), UI.textDim], [`vs ${r.oppName}`, UI.text]];
    }
    if (entry.kind === 'match') {
      return [[`LIGA · ${entry.home ? 'en casa' : 'fuera'}`, KIND.match.col], [`vs ${entry.opp ? entry.opp.name : '???'}`, UI.text], ...(entry.isDerby ? [['¡DERBI!', '#ff9c5b']] : [])];
    }
    if (entry.kind === 'cup') {
      const k = entry.european ? KIND.euro : KIND.cup;
      return [[k.label, k.col], [entry.roundName.toLowerCase(), UI.textDim], [`vs ${entry.opp ? entry.opp.name : '???'}${entry.tag || ''}`, UI.text]];
    }
    if (entry.kind === 'training') return [['ENTRENO', KIND.training.col], [entry.drill, UI.text], [truncate(this.game.displayName(entry.abueloId), TILE_W - 4), UI.textDim]];
    return [];
  }

  _dayEntry(d) {
    const { player } = this.game;
    // si este día ya se jugó de verdad, la entrada se reconstruye a partir
    // del marcador guardado (player.matchResults) en vez de mirar el
    // estado EN VIVO del cruce — para Copa/Copa de Europa ese cruce ya
    // habrá avanzado de ronda (o hasta terminado del todo) para cuando se
    // navega hacia atrás, así que "¿hay Copa hoy?" ya no valdría para
    // reconstruir qué pasó ese día en concreto
    const result = player.matchResults[d.day];
    if (result) return this._entryFromResult(result);
    // el día de Copa agendado no cae necesariamente en domingo (se busca
    // con firstFreeDayFrom entre semana), así que se comprueba aparte y
    // antes que el resto — antes no se mostraba en la Agenda en absoluto
    if (d.hasEuroCup && player.euroCup && !player.euroCup.finished) {
      const opp = player.euroCup.playerOpponent();
      const tag = opp ? countryTag(opp.country, player.homeCountry) : '';
      return { kind: 'cup', text: `    EUROPA: ${player.euroCup.roundName.toLowerCase()} vs ${opp ? opp.name : '???'}${tag}`, opp, tag, roundName: player.euroCup.roundName, european: true };
    }
    if (d.hasCup && player.cup && !player.cup.finished) {
      const opp = player.cup.playerOpponent();
      return { kind: 'cup', text: `    COPA: ${player.cup.roundName.toLowerCase()} vs ${opp ? opp.name : '???'}`, opp, roundName: player.cup.roundName };
    }
    if (d.hasFixture) {
      const pair = player.league.fixturesForMatchday(d.matchdayIndex).find((p) => p.includes(player.club.id));
      if (!pair) return { kind: 'match', text: '    PARTIDO DE LIGA' };
      const oppId = pair[0] === player.club.id ? pair[1] : pair[0];
      const opp = player.league.clubById(oppId);
      const home = pair[0] === player.club.id;
      const isDerby = opp && player.derbyClub && player.derbyClub.id === opp.id;
      return { kind: 'match', text: `    ${home ? '(C)' : '(F)'} vs ${opp ? opp.name : '???'}${isDerby ? ' ¡DERBI!' : ''}`, opp, home, isDerby };
    }
    if (d.training) {
      return { kind: 'training', text: `    entreno: ${d.training.drill}`, abueloId: d.training.abueloId, drill: d.training.drill };
    }
    return { kind: 'free', text: '' };
  }

  // entrada para un día ya jugado, a partir de player.matchResults[day] —
  // ver _dayEntry. Guarda el marcador consigo (entry.result) para que la
  // fila y el tooltip puedan enseñarlo sin tener que volver a mirar el
  // estado (ya adelantado) de la liga/Copa/Copa de Europa.
  _entryFromResult(r) {
    const scoreTxt = `${r.scoreP}-${r.scoreA}`;
    if (r.kind === 'league') {
      return { kind: 'match', text: `    vs ${r.oppName}${r.isDerby ? ' ¡DERBI!' : ''}  (${scoreTxt})`, result: r };
    }
    const label = r.kind === 'eurocup' ? 'EUROPA' : 'COPA';
    return { kind: 'cup', text: `    ${label}: ${r.roundName.toLowerCase()} vs ${r.oppName}  (${scoreTxt})`, result: r, european: r.kind === 'eurocup' };
  }

  _drawDayTooltip(d, entry, mx, my, completed) {
    const { screen } = this.game;
    const lines = [];
    lines.push([`${d.weekdayName.toUpperCase()} · día ${d.day}`, '#ffe680']);
    if (entry.result) {
      const r = entry.result;
      const wonCol = r.won ? '#7ec850' : '#ff8c5b';
      if (r.kind === 'league') {
        lines.push([`Partido de liga — ${r.won ? 'GANADO' : 'PERDIDO'}`, wonCol]);
      } else {
        lines.push([`${r.kind === 'eurocup' ? 'Copa de Europa' : 'Copa de España'} — ${r.roundName.toLowerCase()} — ${r.won ? 'GANADO' : 'PERDIDO'}`, wonCol]);
      }
      lines.push([`${this.game.player.clubName} ${r.scoreP} - ${r.scoreA} ${r.oppName}`, '#c9c2a8']);
      if (r.isDerby) {
        const h = this.game.player.derbyHistory;
        lines.push([`¡EL DERBI DE SIEMPRE! historial: ${h.wins}-${h.losses}`, '#ffb347']);
      }
    } else if (entry.kind === 'match') {
      const aiLevel = entry.opp ? Math.round(entry.opp.avgSkill()) : '?';
      lines.push([`Partido de liga ${entry.home ? '(en casa)' : '(fuera)'}`, '#7ec850']);
      lines.push([`Rival: ${entry.opp ? entry.opp.name : '???'}`, '#c9c2a8']);
      lines.push([`Nivel del rival: ${aiLevel}/10`, '#9a927a']);
      if (entry.isDerby) {
        const h = this.game.player.derbyHistory;
        lines.push([`¡EL DERBI DE SIEMPRE! historial: ${h.wins}-${h.losses}`, '#ffb347']);
      }
    } else if (entry.kind === 'cup') {
      const aiLevel = entry.opp ? Math.round(entry.opp.skill ?? entry.opp.avgSkill?.() ?? 0) : '?';
      lines.push([`${entry.european ? 'Copa de Europa' : 'Copa de España'} — ${entry.roundName.toLowerCase()}`, entry.european ? '#88c8e8' : '#ffd75e']);
      lines.push([`Rival: ${entry.opp ? entry.opp.name : '???'}${entry.opp && entry.opp.country ? countryTag(entry.opp.country, this.game.player.homeCountry) : ''}`, '#c9c2a8']);
      if (aiLevel) lines.push([`Nivel del rival: ${aiLevel}/10`, '#9a927a']);
      lines.push(['Partido único: quien gana, pasa de ronda.', '#9a927a']);
      if (entry.european) lines.push(['[E] ver el cuadro completo de Europa', '#5a8aa8']);
    } else if (entry.kind === 'training') {
      lines.push(['Entreno agendado', '#88c8e8']);
      lines.push([`${entry.drill} — ${this.game.displayName(entry.abueloId)}`, '#c9c2a8']);
      lines.push(['[click] cancelar este entreno', '#ff8c5b']);
    } else if (completed) {
      lines.push(['Día ya pasado.', '#8a8a7a']);
    } else {
      lines.push(['Día libre.', '#8a8a7a']);
      lines.push(['[click] agendar un entreno aquí', '#7CFC00']);
    }
    tooltip(screen, mx + 2, my + 1, lines.map(([t, c]) => [truncate(t, 60), c]), { tone: UI.accentHi });
  }

  // opción de un modal: fila(s) resaltables con ratón y teclado. Devuelve
  // true si se ha hecho clic en ella (nunca en el mismo frame en que se abrió
  // el modal, para que el clic que lo abre no elija ya una opción)
  _option(x, y, w, h, sel, armed) {
    const { screen, input } = this.game;
    const over = hitRect(input.mouse.cx, input.mouse.cy, x, y, w, h);
    screen.fill(x, y, w, h, sel || over ? tint(UI.accent, 0.2) : UI.panel);
    screen.put(x, y, '▌', sel ? UI.accent : over ? UI.accentHi : UI.edgeDim);
    return { over, clicked: armed && over && input.mouse.clicked };
  }

  // evento de decisión: 2-3 opciones, cada una con su efecto a la vista
  // antes de elegir — nada de letra pequeña ni sorpresas.
  _drawDecisionModal() {
    const { screen, input } = this.game;
    const { event, ctx } = this.game.decisionEvent;
    const armed = this._decisionArmed === event;
    this._decisionArmed = event;
    const w = 80;
    const bodyLines = wrapText(fillDecisionText(event.text, ctx, (id) => this.game.displayName(id)), w - 6);
    const opts = event.options.map((opt) => {
      const label = fillDecisionText(opt.label, ctx, (id) => this.game.displayName(id));
      const effectDesc = opt.resolve ? fillDecisionText(opt.previewText, ctx, (id) => this.game.displayName(id)) : describeDecisionEffects(opt.effects);
      return { label, effects: wrapText(effectDesc, w - 12) };
    });
    const h = 6 + bodyLines.length + opts.reduce((n, o) => n + o.effects.length + 2, 0);
    const x = Math.floor((screen.cols - w) / 2), y = Math.max(1, Math.floor((screen.rows - h) / 2));
    panel(screen, x, y, w, h, { title: event.title, tone: '#c8a0e8', titleColor: UI.accentHi, fill: '#12101a', style: 'double', opaque: true });
    bodyLines.forEach((l, i) => screen.text(x + 3, y + 2 + i, l, UI.text));

    const n = opts.length;
    this.decisionCursor = ((this.decisionCursor % n) + n) % n;
    let oy = y + 3 + bodyLines.length;
    let chosen = -1;
    opts.forEach((o, i) => {
      const oh = o.effects.length + 1;
      const r = this._option(x + 3, oy, w - 6, oh, i === this.decisionCursor, armed);
      if (r.over && input.mouse.clicked) this.decisionCursor = i;
      if (r.clicked) chosen = i;
      const sel = i === this.decisionCursor;
      screen.text(x + 5, oy, `${i + 1}. ${o.label}`, sel ? '#ffffff' : UI.text);
      o.effects.forEach((l, k) => screen.text(x + 8, oy + 1 + k, l, sel ? '#a8e8c8' : '#6a8a7a'));
      oy += oh + 1;
    });

    screen.textCenter(y + h - 2, '↑↓ o 1-' + n + ' elegir · ENTER / clic confirmar', UI.textDim);

    if (input.hit('ArrowUp')) this.decisionCursor = (this.decisionCursor + n - 1) % n;
    if (input.hit('ArrowDown')) this.decisionCursor = (this.decisionCursor + 1) % n;
    for (let i = 0; i < n; i++) if (input.hit(String(i + 1))) this.decisionCursor = i;
    if (chosen >= 0 || input.hit('Enter') || input.hit(' ')) {
      this.game.resolveDecision(chosen >= 0 ? chosen : this.decisionCursor);
      this.decisionCursor = 0;
      this._decisionArmed = null;
    }
  }

  _drawScheduleModal() {
    const { screen, input, player } = this.game;
    const armed = !!this.schedule.armed;
    this.schedule.armed = true;
    const w = 64, h = 24;
    const x = Math.floor((screen.cols - w) / 2), y = Math.floor((screen.rows - h) / 2);

    if (this.schedule.step === 'abuelo') {
      const cost = player.facilities.trainingCost();
      const eligible = player.roster.ids.filter((id) => player.roster.get(id).st >= cost && !this.game.trainingScheduledFor(id) && !player.roster.get(id).isInjured(player.seasonClock.day));
      panel(screen, x, y, w, h, { title: `ENTRENO · DÍA ${this.schedule.day}`, tone: KIND.training.col, titleColor: KIND.training.col, fill: '#0f1618', style: 'double', opaque: true });
      screen.textCenter(y + 2, '¿QUIÉN ENTRENA?', UI.accentHi);
      if (!eligible.length) {
        screen.textCenter(y + 5, 'Nadie tiene energía libre para entrenar ahora mismo.', UI.textDim);
        screen.textCenter(y + h - 2, 'ESC / ENTER cerrar', UI.textDim);
        if (input.hit('Escape') || input.hit('Enter') || (armed && input.mouse.clicked)) this.schedule = null;
        return;
      }
      this.schedule.cursor = ((this.schedule.cursor % eligible.length) + eligible.length) % eligible.length;
      let chosen = -1;
      eligible.slice(0, 9).forEach((id, i) => {
        const s = player.roster.get(id);
        const r = this._option(x + 3, y + 4 + i * 2, w - 6, 1, i === this.schedule.cursor, armed);
        if (r.clicked) chosen = i;
        const sel = i === this.schedule.cursor;
        screen.text(x + 5, y + 4 + i * 2, truncate(this.game.displayName(id), 28), sel ? '#ffffff' : UI.text);
        const stCol = s.st > 60 ? TONE.good : s.st > 30 ? TONE.warn : TONE.bad;
        screen.text(x + 36, y + 4 + i * 2, `STA ${String(Math.round(s.st)).padStart(3)}  (−${cost})`, stCol);
      });
      screen.textCenter(y + h - 2, '↑↓ elegir · ENTER / clic confirmar · ESC cancelar', UI.textDim);
      if (input.hit('ArrowUp')) this.schedule.cursor = (this.schedule.cursor + eligible.length - 1) % eligible.length;
      if (input.hit('ArrowDown')) this.schedule.cursor = (this.schedule.cursor + 1) % eligible.length;
      if (chosen >= 0 || input.hit('Enter') || input.hit(' ')) {
        this.schedule.abueloId = eligible[chosen >= 0 ? chosen : this.schedule.cursor];
        this.schedule.step = 'drill';
        this.schedule.cursor = 0;
        this.schedule.armed = false;
      }
    } else {
      panel(screen, x, y, w, h, { title: `ENTRENO · DÍA ${this.schedule.day}`, tone: KIND.training.col, titleColor: KIND.training.col, fill: '#0f1618', style: 'double', opaque: true });
      screen.textCenter(y + 2, `¿QUÉ ENTRENA ${this.game.displayName(this.schedule.abueloId).toUpperCase()}?`, UI.accentHi);
      this.schedule.cursor = ((this.schedule.cursor % TRAINING_DRILLS.length) + TRAINING_DRILLS.length) % TRAINING_DRILLS.length;
      let chosen = -1;
      TRAINING_DRILLS.forEach((drill, i) => {
        const sel = i === this.schedule.cursor;
        const bonus = player.facilities.trainingStatBonus(drill.stat);
        const st = STAT[drill.stat];
        const r = this._option(x + 3, y + 4 + i * 3, w - 6, 2, sel, armed);
        if (r.clicked) chosen = i;
        screen.text(x + 5, y + 4 + i * 3, drill.label, sel ? '#ffffff' : UI.text);
        screen.text(x + 5, y + 5 + i * 3, `${st ? st.glyph : '+'} +${bonus} ${STAT_LABEL[drill.stat]}${st ? ` · ${st.does}` : ''}`, st ? st.color : UI.textDim);
      });
      screen.textCenter(y + h - 2, '↑↓ elegir · ENTER / clic agendar · ESC cancelar', UI.textDim);
      if (input.hit('ArrowUp')) this.schedule.cursor = (this.schedule.cursor + TRAINING_DRILLS.length - 1) % TRAINING_DRILLS.length;
      if (input.hit('ArrowDown')) this.schedule.cursor = (this.schedule.cursor + 1) % TRAINING_DRILLS.length;
      if (chosen >= 0 || input.hit('Enter') || input.hit(' ')) {
        this.game.scheduleTrainingOnDay(this.schedule.day, this.schedule.abueloId, TRAINING_DRILLS[chosen >= 0 ? chosen : this.schedule.cursor].id);
        this.schedule = null;
      }
    }
  }
}

// resumen legible de lo que hace una opción de un evento de decisión, para
// que el jugador vea el efecto ANTES de elegir (ver core/Game.js._applyDecisionEffects)
function describeDecisionEffects(effects) {
  if (!effects || !Object.keys(effects).length) return 'sin efecto directo';
  const parts = [];
  if (effects.money) parts.push(`${effects.money > 0 ? '+' : ''}${effects.money}€`);
  if (effects.boardConfidence) parts.push(`${effects.boardConfidence > 0 ? '+' : ''}${effects.boardConfidence} confianza de la junta`);
  if (effects.moral) parts.push(`${effects.moral.d > 0 ? '+' : ''}${effects.moral.d} moral (${effects.moral.target === 'all' ? 'toda la peña' : 'él'})`);
  if (effects.stamina) parts.push(`${effects.stamina.d > 0 ? '+' : ''}${effects.stamina.d} STA (${effects.stamina.target === 'all' ? 'toda la peña' : 'él'})`);
  if (effects.xp) parts.push(`+${effects.xp.amount} XP`);
  if (effects.item) parts.push('amuleto nuevo');
  return parts.join('  ·  ');
}
