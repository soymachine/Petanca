import { TabsBar } from './TabsBar.js';
import { countryTag } from '../data/countries.js';
import { wrapText } from '../core/utils.js';
import { fillDecisionText } from '../data/decisionEvents.js';

const WD_SHORT = { lunes: 'LUN', martes: 'MAR', miércoles: 'MIÉ', jueves: 'JUE', viernes: 'VIE', sábado: 'SÁB', domingo: 'DOM' };
const AY = 10, PAGE_W = 55, PAGE_GAP = 5, PAGE_H = 33;
const STEP_FRAMES = 12; // ritmo del avance automático por días vacíos
const PAUSE_FRAMES = 60; // pausa (~1s) al caer en un día con evento antes de entrar
const PAGE_STEP = 2; // el pasador siempre mueve las dos semanas visibles a la vez
const MAX_PAGE_AHEAD = 12; // tope de semanas que se puede pasar hacia delante

// La agenda a pantalla completa: un cuaderno abierto de dos semanas, con
// posiciones FIJAS por día de la semana (lunes siempre en su columna) —
// solo cambia de página semana a semana, nunca se desplaza día a día.
// [ENTER] no salta directo al próximo evento: avanza día a día marcando
// cada jornada vacía como completada, y en cuanto cae en un día con algo
// agendado se detiene un segundo y entra a ese evento. Un pasador de
// páginas (◀/▶) permite ver semanas futuras sin tocar el avance real del
// calendario — para planificar fichajes/entrenos con partidos ya a la vista.
export class AgendaScreen {
  constructor(game) { this.game = game; this.schedule = null; this.playing = null; this.pageOffset = 0; this.decisionCursor = 0; }

  draw() {
    const { screen, input, player, frame } = this.game;
    screen.clear();
    if (this.schedule && input.hit('Escape')) { this.schedule = null; input.pressed.Escape = false; }
    // un evento de decisión no se puede cancelar con ESC (hay que elegir
    // una opción), pero tampoco debe dejar pasar la tecla al atajo global
    // "ESC = Inicio" de TabsBar, o se sale de la Agenda sin resolverlo
    if (this.game.decisionEvent && input.hit('Escape')) { input.pressed.Escape = false; }
    TabsBar.draw(this.game, 'agenda');
    screen.textCenter(4, '═══ AGENDA DE LA PEÑA ═══', '#ffb347');

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
    const bookW = PAGE_W * 2 + PAGE_GAP;
    const bx = Math.floor((screen.cols - bookW) / 2);
    screen.box(bx, AY - 3, bookW, 3, '#c9a35d', 'double');
    const todayLabel = `H O Y   ·   ${clock.weekdayName.toUpperCase()}   ·   SEMANA ${clock.weekIndex + 1}`;
    screen.text(bx + Math.floor((bookW - todayLabel.length) / 2), AY - 2, todayLabel, '#ffe680');

    // pasador de páginas: qué par de semanas se ve ahora mismo, sin tocar
    // el avance real del calendario (this.pageOffset es solo de cámara)
    this.pageOffset = Math.max(0, Math.min(MAX_PAGE_AHEAD, this.pageOffset));
    const baseWeek = clock.weekIndex + this.pageOffset;
    const week1 = clock.weekAt(baseWeek, player.league);
    const week2 = clock.weekAt(baseWeek + 1, player.league);
    screen.box(bx, AY, PAGE_W, PAGE_H, '#8a7f66', 'double');
    screen.box(bx + PAGE_W + PAGE_GAP, AY, PAGE_W, PAGE_H, '#8a7f66', 'double');

    // flechas de paginación, a los lados del libro
    const canPagePrev = this.pageOffset > 0;
    const canPageNext = this.pageOffset < MAX_PAGE_AHEAD;
    screen.text(bx - 3, AY + PAGE_H / 2, canPagePrev ? '◀' : ' ', canPagePrev ? (frame % 20 < 14 ? '#ffe680' : '#a8901a') : '#3a352c');
    screen.text(bx + bookW + 1, AY + PAGE_H / 2, canPageNext ? '▶' : ' ', canPageNext ? (frame % 20 < 14 ? '#ffe680' : '#a8901a') : '#3a352c');

    // lomo del cuaderno: degradado de caracteres para sugerir la curva del
    // papel encuadernado, en vez de un simple relleno de '│'
    const spineGlyphs = ['▏', '│', '║', '│', '▕'];
    const spineCols = ['#3a2f1a', '#5a4f3a', '#7a6a4a', '#5a4f3a', '#3a2f1a'];
    for (let i = 0; i < PAGE_GAP; i++) {
      for (let r = 1; r < PAGE_H - 1; r++) screen.put(bx + PAGE_W + i, AY + r, spineGlyphs[i] || '│', spineCols[i] || '#5a4f3a');
    }
    // anillas de encuadernación sobre el lomo, como una agenda de anillas real
    for (let r = 3; r < PAGE_H - 1; r += 7) screen.put(bx + PAGE_W + 2, AY + r, '◎', '#2a2418');

    // textura de papel: puntos tenues y esquina "doblada" en cada página
    for (const px of [bx, bx + PAGE_W + PAGE_GAP]) {
      for (let r = 2; r < PAGE_H - 1; r++) {
        for (let c = 3; c < PAGE_W - 2; c++) {
          if ((c + r * 3) % 11 === 0) screen.put(px + c, AY + r, '·', '#2e2a1e');
        }
      }
      screen.put(px + PAGE_W - 3, AY + PAGE_H - 2, '◢', '#6b5f42');
      screen.put(px + PAGE_W - 2, AY + PAGE_H - 2, '◤', '#4a4230');
    }

    screen.text(bx + 2, AY + 1, `SEMANA ${baseWeek + 1}`, '#c9a35d');
    screen.text(bx + PAGE_W + PAGE_GAP + 2, AY + 1, `SEMANA ${baseWeek + 2}`, '#c9a35d');

    let hover = null;
    [[week1, bx], [week2, bx + PAGE_W + PAGE_GAP]].forEach(([week, px]) => {
      // margen tipo cuaderno: una línea vertical tenue a la izquierda
      const marginX = px + 4;
      for (let r = 2; r < PAGE_H - 1; r++) screen.put(marginX, AY + r, '│', '#6b3d3d');

      let yy = AY + 3;
      for (const d of week) {
        const entry = this._dayEntry(d);
        const isToday = d.day === clock.day;
        const completed = d.day < clock.day;
        const rowOver = !this.playing && input.mouse.cy >= yy && input.mouse.cy <= yy + 2 && input.mouse.cx >= px + 1 && input.mouse.cx < px + PAGE_W - 1;
        if (rowOver) hover = { d, entry, px, yy, completed };
        const wd = WD_SHORT[d.weekdayName];
        const dayCol = isToday ? '#ffe14d' : d.isMatchDay ? '#e8ddb8' : '#c9c2a8';
        const tabCol = rowOver ? '#fff' : dayCol;

        // fondo de la fila teñido según qué haya ese día: partido de liga
        // o de Copa se ven de un vistazo por el color, sin tener que leer
        // el texto — los días "libres"/entreno quedan con el papel normal.
        // No hay capa de "background" de verdad (el buffer es char+color
        // plano): se simula rellenando con un carácter de sombreado y
        // dibujando el texto encima después, en vez de un espacio en
        // blanco (que con solo color de texto no pintaría nada visible).
        if (!completed && (entry.kind === 'match' || entry.kind === 'cup')) {
          const bg = entry.kind === 'cup' ? (entry.european ? '#1a3a4a' : '#4a3a18') : '#20401f';
          for (let r = 0; r < 3; r++) screen.text(px + 5, yy + r, '░'.repeat(PAGE_W - 6), bg);
        }

        // "pestaña" del día: una mini casilla con el número, como una
        // agenda física de verdad. Los días ya pasados quedan "sellados":
        // el relleno ahora ocupa todo el ancho de la fila, no solo la
        // casilla del número, para que se note de un vistazo cuánto se ha
        // avanzado en la semana.
        if (completed) {
          for (let r = 0; r < 3; r++) screen.text(px + 1, yy + r, '▓'.repeat(PAGE_W - 2), '#1f3d1f');
          screen.text(px + 1, yy, '▓▓▓▓', '#3a6a3a');
          screen.text(px + 1, yy + 1, `▓${String(d.day).padStart(2)}▓`, '#9fe89f');
          screen.text(px + 1, yy + 2, '▓▓▓▓', '#3a6a3a');
        } else {
          screen.text(px + 1, yy, '┌──┐', tabCol);
          screen.text(px + 1, yy + 1, `│${String(d.day).padStart(2)}│`, tabCol);
          screen.text(px + 1, yy + 2, '└──┘', tabCol);
        }
        screen.text(px + 6, yy, wd, isToday ? '#ffe14d' : completed ? '#bcdcbc' : '#8a7f66');
        if (isToday) screen.text(px, yy + 1, '▶', frame % 20 < 14 ? '#ffe14d' : '#a8901a');

        // cintita roja de "hoy" en el margen derecho de la fila, como el
        // marcapáginas de tela de una agenda de verdad
        if (isToday) screen.text(px + PAGE_W - 4, yy + 1, '▐█▌', '#a83a3a');

        if (entry.kind === 'match') screen.text(px + 6, yy + 1, entry.text, completed ? '#bfe8bf' : '#7ec850');
        else if (entry.kind === 'cup') screen.text(px + 6, yy + 1, entry.text, completed ? '#c9b970' : (entry.european ? '#88c8e8' : '#ffd75e'));
        else if (entry.kind === 'training') screen.text(px + 6, yy + 1, rowOver && !completed ? entry.text + '  ✕ cancelar' : entry.text, completed ? '#bfe8e8' : rowOver ? '#ff8c5b' : '#88c8e8');
        else if (rowOver && !completed && entry.kind === 'free') screen.text(px + 6, yy + 1, '+ agendar entreno', frame % 20 < 14 ? '#7CFC00' : '#4a8a4a');

        // regla horizontal punteada, como las líneas de una libreta real
        // (solo si cabe dentro de la página, el último día no lleva línea)
        if (yy + 3 < AY + PAGE_H - 1) screen.text(px + 1, yy + 3, '·'.repeat(PAGE_W - 2), '#3a352a');
        yy += 4;
      }
    });

    const canFriendly = !this.playing && this.pageOffset === 0 && player.league.matchday === 0 && player.friendliesLeft > 0;
    if (this.playing) {
      const label = this.playing.pendingEvent ? '⏸ algo pasa hoy... un momento' : '▶▶ avanzando por la agenda...';
      screen.textCenter(AY + PAGE_H + 1, label, frame % 20 < 14 ? '#7CFC00' : '#4a8a4a');
    } else if (this.pageOffset > 0) {
      screen.textCenter(AY + PAGE_H + 1, '[←/→] cambiar de semana    click en un día libre para agendar un entreno', '#c9c2a8');
      screen.textCenter(AY + PAGE_H + 2, `estás viendo por delante — [→ ${MAX_PAGE_AHEAD - this.pageOffset} más] · vuelve con [←] hasta la semana actual`, '#8a7f66');
    } else {
      const baseHelp = '[ENTER] avanzar día a día    [→] ver semanas futuras    click en un día libre para agendar un entreno';
      screen.textCenter(AY + PAGE_H + 1, canFriendly ? `${baseHelp}    [F] amistoso de pretemporada (quedan ${player.friendliesLeft})` : baseHelp, '#c9c2a8');
    }

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
    }
    if (!this.playing && this.pageOffset === 0 && (input.hit('Enter') || input.hit(' '))) this.playing = { nextAt: frame, pendingEvent: null };
    if (canFriendly && (input.hit('f') || input.hit('F'))) {
      const result = this.game.playFriendly();
      if (result) this.friendlyResult = { won: result.won, opponent: result.opponent.name, frame: 0 };
    }
    if (this.friendlyResult) {
      this.friendlyResult.frame++;
      const txt = this.friendlyResult.won ? `AMISTOSO GANADO ante ${this.friendlyResult.opponent}` : `Amistoso perdido ante ${this.friendlyResult.opponent}`;
      screen.textCenter(AY + PAGE_H + 2, txt, this.friendlyResult.won ? '#7CFC00' : '#ff8c5b');
      if (this.friendlyResult.frame > 90) this.friendlyResult = null;
    }
  }

  _dayEntry(d) {
    const { player } = this.game;
    // el día de Copa agendado no cae necesariamente en domingo (se busca
    // con firstFreeDayFrom entre semana), así que se comprueba aparte y
    // antes que el resto — antes no se mostraba en la Agenda en absoluto
    if (d.hasEuroCup && player.euroCup && !player.euroCup.finished) {
      const opp = player.euroCup.playerOpponent();
      const tag = opp ? (countryTag(opp.country) || ' (España)') : '';
      return { kind: 'cup', text: `    EUROPA: ${player.euroCup.roundName.toLowerCase()} vs ${opp ? opp.name : '???'}${tag}`, opp, roundName: player.euroCup.roundName, european: true };
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

  _drawDayTooltip(d, entry, mx, my, completed) {
    const { screen } = this.game;
    const lines = [];
    lines.push([`${d.weekdayName.toUpperCase()} · día ${d.day}`, '#ffe680']);
    if (entry.kind === 'match') {
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
      lines.push([`Rival: ${entry.opp ? entry.opp.name : '???'}${entry.opp && entry.opp.country ? (countryTag(entry.opp.country) || ' (España)') : ''}`, '#c9c2a8']);
      if (aiLevel) lines.push([`Nivel del rival: ${aiLevel}/10`, '#9a927a']);
      lines.push(['Partido único: quien gana, pasa de ronda.', '#9a927a']);
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
    const tw = Math.min(50, Math.max(...lines.map((l) => l[0].length)) + 4);
    const th = lines.length + 2;
    const tx = Math.min(mx + 2, screen.cols - tw - 1);
    const ty = Math.min(my + 1, screen.rows - th - 1);
    this._fillBlack(tx, ty, tw, th);
    screen.box(tx, ty, tw, th, '#ffe14d', 'double');
    lines.forEach((l, i) => screen.text(tx + 2, ty + 1 + i, l[0], l[1]));
  }

  _fillBlack(x, y, w, h) {
    const { screen } = this.game;
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) screen.put(x + c, y + r, '█', '#000');
  }

  // evento de decisión: 2-3 opciones, cada una con su efecto a la vista
  // antes de elegir — nada de letra pequeña ni sorpresas.
  _drawDecisionModal() {
    const { screen, input } = this.game;
    const { event, ctx } = this.game.decisionEvent;
    const w = 76, h = 10 + event.options.length * 4;
    const x = Math.floor((screen.cols - w) / 2), y = Math.floor((screen.rows - h) / 2);
    this._fillBlack(x, y, w, h);
    screen.box(x, y, w, h, '#c8a0e8', 'double');
    screen.textCenter(y + 1, event.title, '#ffe680');
    const bodyLines = wrapText(fillDecisionText(event.text, ctx, (id) => this.game.displayName(id)), w - 6);
    bodyLines.forEach((l, i) => screen.text(x + 3, y + 3 + i, l, '#c9c2a8'));

    const optY0 = y + 3 + bodyLines.length + 1;
    this.decisionCursor = ((this.decisionCursor % event.options.length) + event.options.length) % event.options.length;
    event.options.forEach((opt, i) => {
      const sel = i === this.decisionCursor;
      const oy = optY0 + i * 4;
      screen.text(x + 3, oy, `${sel ? '▶' : ' '} ${opt.label}`, sel ? '#fff' : '#c9c2a8');
      const effectLines = wrapText(describeDecisionEffects(opt.effects), w - 10);
      effectLines.forEach((l, k) => screen.text(x + 5, oy + 1 + k, l, sel ? '#a8e8c8' : '#6a8a7a'));
    });

    screen.textCenter(y + h - 2, '[↑/↓] elegir   [ENTER] confirmar', '#c9c2a8');

    if (input.hit('ArrowUp')) this.decisionCursor = (this.decisionCursor + event.options.length - 1) % event.options.length;
    if (input.hit('ArrowDown')) this.decisionCursor = (this.decisionCursor + 1) % event.options.length;
    if (input.hit('Enter') || input.hit(' ')) {
      this.game.resolveDecision(this.decisionCursor);
      this.decisionCursor = 0;
    }
  }

  _drawScheduleModal() {
    const { screen, input, player } = this.game;
    const w = 60, h = 22;
    const x = Math.floor((screen.cols - w) / 2), y = Math.floor((screen.rows - h) / 2);
    this._fillBlack(x, y, w, h);
    screen.box(x, y, w, h, '#ffe14d', 'double');

    if (this.schedule.step === 'abuelo') {
      const cost = player.facilities.trainingCost();
      const eligible = player.roster.ids.filter((id) => player.roster.get(id).st >= cost && !this.game.trainingScheduledFor(id) && !player.roster.get(id).isInjured(player.seasonClock.day));
      screen.textCenter(y + 1, `¿QUIÉN ENTRENA EL ${this.schedule.day}?`, '#ffe680');
      if (!eligible.length) {
        screen.textCenter(y + 4, 'Nadie tiene energía libre para entrenar ahora mismo.', '#8a8a7a');
        screen.textCenter(y + h - 2, '[ESC] cerrar', '#c9c2a8');
        if (input.hit('Escape') || input.hit('Enter')) this.schedule = null;
        return;
      }
      this.schedule.cursor = ((this.schedule.cursor % eligible.length) + eligible.length) % eligible.length;
      eligible.forEach((id, i) => {
        const sel = i === this.schedule.cursor;
        const s = player.roster.get(id);
        screen.text(x + 4, y + 3 + i * 2, `${sel ? '▶' : ' '} ${this.game.displayName(id)}`.padEnd(30) + `STA ${Math.round(s.st)}`, sel ? '#fff' : '#c9c2a8');
      });
      screen.textCenter(y + h - 2, '[↑/↓] elegir   [ENTER] confirmar   [ESC] cancelar', '#c9c2a8');
      if (input.hit('ArrowUp')) this.schedule.cursor = (this.schedule.cursor + eligible.length - 1) % eligible.length;
      if (input.hit('ArrowDown')) this.schedule.cursor = (this.schedule.cursor + 1) % eligible.length;
      if (input.hit('Enter') || input.hit(' ')) {
        this.schedule.abueloId = eligible[this.schedule.cursor];
        this.schedule.step = 'drill';
      }
    } else {
      const drills = ['ARRIME', 'TIRO'];
      const bonus = player.facilities.trainingStatBonus();
      screen.textCenter(y + 1, `¿QUÉ ENTRENA ${this.game.displayName(this.schedule.abueloId)}?`, '#ffe680');
      drills.forEach((drill, i) => {
        const sel = i === this.schedule.cursor;
        const stat = drill === 'ARRIME' ? 'pulso' : 'brazo';
        screen.text(x + 4, y + 4 + i * 3, `${sel ? '▶' : ' '} ${drill}  (+${bonus} ${stat})`, sel ? '#fff' : '#c9c2a8');
      });
      screen.textCenter(y + h - 2, '[↑/↓] elegir   [ENTER] agendar   [ESC] cancelar', '#c9c2a8');
      if (input.hit('ArrowUp') || input.hit('ArrowDown')) this.schedule.cursor = this.schedule.cursor === 0 ? 1 : 0;
      if (input.hit('Enter') || input.hit(' ')) {
        this.game.scheduleTrainingOnDay(this.schedule.day, this.schedule.abueloId, drills[this.schedule.cursor]);
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
