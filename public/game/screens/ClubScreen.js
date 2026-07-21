import { wrapText, hitRect, drawTabRow, truncate } from '../core/utils.js';
import { TabsBar } from './TabsBar.js';
import { SHIRT_SPONSOR_POOL } from '../data/sponsors.js';
import { boardPresidentFor, boardAdj } from '../data/boardPresident.js';
import { TRAINING_DRILLS } from '../data/trainingDrills.js';
import { STAT_LABEL } from '../data/abuelos.js';
import { BIG_DIGITS } from '../data/art/staticArt.js';
import { DIFFICULTIES } from '../data/difficulty.js';
import { leagueWageFactor } from '../model/Career.js';

const SECTIONS = ['facilities', 'sponsor', 'junta', 'economia'];
const SECTION_LABEL = { facilities: 'DESCAMPADO', sponsor: 'PATROCINIOS', junta: 'LA JUNTA', economia: 'ECONOMÍA' };
const ECONOMY_WEEKS = 20;

// Gestión del club: mejoras del descampado, patrocinios y la junta
// directiva (objetivos, confianza, presidente). Los ojeadores (contratar
// y asignar) viven ahora en Mi Peña, junto al Mercado que vigilan — ver
// PenyaScreen.js.
export class ClubScreen {
  constructor(game) {
    this.game = game; this.cursor = 0; this.section = 'facilities';
    this.practiceCursor = 0; // qué drill se mira en el panel de Practicar
    this.practiceStep = null; // null | 'abuelo' — abre el selector de abuelo
    this.practiceAbueloCursor = 0;
  }

  draw() {
    const { screen, input } = this.game;
    screen.clear();
    // el selector de abuelo de Practicar tiene su propio cierre por ESC:
    // hay que consumirlo ANTES de que TabsBar vea el atajo global "ESC =
    // Inicio", o se sale de El Club sin querer (mismo patrón que Mi Peña)
    if (input.hit('Escape') && this.practiceStep) { this.practiceStep = null; input.pressed.Escape = false; }
    TabsBar.draw(this.game, 'club');
    screen.textCenter(4, '═══ EL CLUB ═══', '#ffb347');
    // Patrocinios y Junta se desbloquean solos las primeras semanas (ver
    // Player.systemsRevealed / Career._maybeRevealSystems) — Descampado
    // está disponible desde el minuto uno
    const revealed = this.game.player.systemsRevealed;
    const locked = SECTIONS.map((s) => (s === 'sponsor' && !revealed.patrocinios) || (s === 'junta' && !revealed.junta));
    const labels = SECTIONS.map((s) => {
      if (s === 'sponsor' && !revealed.patrocinios) return `${SECTION_LABEL[s]} (semana 4)`;
      if (s === 'junta' && !revealed.junta) return `${SECTION_LABEL[s]} (semana 5)`;
      return SECTION_LABEL[s];
    });
    const clicked = drawTabRow(screen, input, 4, 6, labels, SECTIONS.indexOf(this.section), { activeColor: '#ffe680', color: '#ffe680', disabled: locked });
    // en su propia fila, no en la misma que las pestañas: con 4 pestañas y
    // los sufijos "(semana N)" de las que aún están tapadas, la fila de
    // pestañas puede alargarse bastante y se comía este texto si compartían fila
    screen.text(4, 7, '[Q] cambiar de pestaña', '#8a7f66');
    // misma fórmula que Career.finishWeeklyMatch al descontarla de verdad
    // cada semana: roster.totalUpkeep() a secas es solo la base, sin la
    // dificultad ni el recargo por nivel de liga — mostrar solo eso hacía
    // parecer que la nómina no subía nunca, cuando sí lo hacía por dentro
    const { player } = this.game;
    const diff = DIFFICULTIES.find((d) => d.id === player.difficulty) || DIFFICULTIES[1];
    const nomina = Math.round(player.roster.totalUpkeep() * diff.wageMult * leagueWageFactor(player.currentLeagueLevel));
    screen.text(34, 7, `nómina semanal: ${nomina}€`, '#c98080');

    if (this.section === 'sponsor' && revealed.patrocinios) this._drawSponsor();
    else if (this.section === 'junta' && revealed.junta) this._drawJunta();
    else if (this.section === 'economia') this._drawEconomia();
    else { this._drawFacilities(); this._drawPractice(); }

    if (clicked !== null) { this.section = SECTIONS[clicked]; this.cursor = 0; }
    else if (!this.practiceStep && (input.hit('q') || input.hit('Q'))) {
      let next = SECTIONS.indexOf(this.section);
      for (let i = 0; i < SECTIONS.length; i++) {
        next = (next + 1) % SECTIONS.length;
        if (!locked[next]) break;
      }
      this.section = SECTIONS[next];
      this.cursor = 0;
    }
    if (this.section === 'facilities' && !this.practiceStep) this._inputFacilities();
  }

  _drawFacilities() {
    const { screen, input, player } = this.game;
    const list = player.facilities.list();
    screen.box(4, 8, 132, 20, '#8a7f66');
    screen.text(7, 9, 'MEJORAS DEL DESCAMPADO', '#ffb347');
    // 3 columnas en vez de 2: con las 5 instalaciones de entreno por stat
    // (antes solo "gimnasio"), la lista pasó de 7 a 11 y ya no cabía en
    // 2 columnas de 4 filas sin salirse de la caja
    const cols = 3;
    const perCol = Math.ceil(list.length / cols);
    this._facRects = [];
    let hover = null;
    list.forEach((it, i) => {
      const col = Math.floor(i / perCol);
      const row = i % perCol;
      const cx = 8 + col * 43;
      const yy = 11 + row * 4;
      const rx = cx - 3, ry = yy - 1, rw = 40, rh = 4;
      this._facRects.push({ x: rx, y: ry, w: rw, h: rh });
      const sel = i === this.cursor;
      const over = hitRect(input.mouse.cx, input.mouse.cy, rx, ry, rw, rh);
      if (over) hover = i;
      if (sel || over) {
        for (let r = 1; r < rh - 1; r++) screen.text(rx + 1, ry + r, ' '.repeat(rw - 2), '#3a4a3a');
      }
      if (sel) screen.box(rx, ry, rw, rh, '#7CFC00');
      else if (over) screen.box(rx, ry, rw, rh, '#ffe680');
      const maxed = !it.next;
      const nameCol = sel ? '#fff' : over ? '#ffe680' : it.level > 0 ? '#88c8e8' : '#8a8a8a';
      const levelTag = it.level > 0 ? ` (nv.${it.level}/${it.maxLevel})` : '';
      screen.text(cx, yy, truncate(`${it.name}${levelTag}`, 36), nameCol);
      if (maxed) {
        screen.text(cx, yy + 1, '★ AL MÁXIMO', '#ffe14d');
      } else {
        const label = it.level > 0 ? `mejorar: ${it.next.price}€` : `${it.next.price}€`;
        screen.text(cx, yy + 1, label, player.money >= it.next.price ? '#7ec850' : '#ff5c5c');
      }
      const desc = maxed ? it.current.desc : it.next.desc;
      wrapText(desc, 36).slice(0, 2).forEach((l, k) => screen.text(cx, yy + 2 + k, l, '#9a927a'));
    });
    if (hover !== null && input.mouse.clicked) this.cursor = hover;
    screen.text(7, 28, '[↑/↓] mirar · ratón = seleccionar   [ENTER] instalar/mejorar', '#c9c2a8');
  }
  _inputFacilities() {
    const { input, player } = this.game;
    const list = player.facilities.list();
    if (input.hit('ArrowUp')) this.cursor = (this.cursor + list.length - 1) % list.length;
    if (input.hit('ArrowDown')) this.cursor = (this.cursor + 1) % list.length;
    if (input.hit('Enter') || input.hit(' ')) {
      const it = list[this.cursor];
      if (it.next && player.money >= it.next.price) { player.money -= it.next.price; player.facilities.buy(it.id); player.save(); }
    }
  }

  // PRACTICAR: los mismos 5 minijuegos que el entreno de verdad, pero
  // gratis, sin límite y sin premio de stat — solo para coger soltura con
  // los controles (apuntar/efecto/potencia) sin gastar un entreno de
  // verdad. La única marca que queda es la mejor puntuación (dailyBest,
  // ver Game.onMatchFinished), puramente cosmética.
  //
  // Solo se elige con el ratón (clic en la fila) en vez de con flechas:
  // esta caja convive en pantalla con la lista de instalaciones de arriba
  // (que SÍ usa flechas) y ambas leyendo el mismo Input a la vez haría que
  // una tecla moviera los dos cursores de golpe — mismo tipo de choque que
  // ya se arregló antes en Mi Peña con el modal de ojeadores.
  _drawPractice() {
    const { screen, input, player } = this.game;
    const x = 4, y = 30, w = 132, h = 13;
    screen.box(x, y, w, h, '#5a8a5a', 'double');
    screen.text(x + 2, y, ' PRACTICAR — gratis, sin coste ni límite ', '#7ec850');

    if (this.practiceStep === 'abuelo') { this._drawPracticeAbueloPicker(x, y, w, h); return; }

    let ry = y + 2;
    TRAINING_DRILLS.forEach((d, i) => {
      const overRow = hitRect(input.mouse.cx, input.mouse.cy, x + 2, ry, w - 4, 1);
      const best = player.dailyBest[d.id] || 0;
      const bestTxt = d.hits ? `mejor: ${best}/${d.target} derribos` : `mejor: ${best} pts`;
      const label = `${overRow ? '▶' : ' '} ${d.label.padEnd(10)} ${STAT_LABEL[d.stat].padEnd(8)} ${bestTxt}`;
      screen.text(x + 2, ry, label, overRow ? '#fff' : '#c9c2a8');
      if (overRow && input.mouse.clicked) { this.practiceStep = 'abuelo'; this.practiceCursor = i; this.practiceAbueloCursor = 0; }
      ry += 2;
    });
    screen.text(x + 2, y + h - 2, 'clic en un minijuego para elegir abuelo y practicar', '#8a7f66');
  }

  _drawPracticeAbueloPicker(x, y, w, h) {
    const { screen, input, player } = this.game;
    const drill = TRAINING_DRILLS[this.practiceCursor];
    screen.text(x + 2, y + 2, `¿QUIÉN PRACTICA ${drill.label}? (sin coste de stamina)`, '#ffe680');
    const ids = player.roster.ids;
    this.practiceAbueloCursor = ((this.practiceAbueloCursor % ids.length) + ids.length) % ids.length;
    ids.forEach((id, i) => {
      const sel = i === this.practiceAbueloCursor;
      const s = player.roster.get(id);
      const ry = y + 4 + i * 2;
      if (ry > y + h - 3) return;
      screen.text(x + 4, ry, `${sel ? '▶' : ' '} ${this.game.displayName(id)}`.padEnd(30) + `${STAT_LABEL[drill.stat]} ${s.getStat(drill.stat)}`, sel ? '#fff' : '#c9c2a8');
    });
    screen.text(x + 2, y + h - 2, '[↑/↓] elegir   [ENTER] practicar   [ESC] volver', '#c9c2a8');
    if (input.hit('ArrowUp')) this.practiceAbueloCursor = (this.practiceAbueloCursor + ids.length - 1) % ids.length;
    if (input.hit('ArrowDown')) this.practiceAbueloCursor = (this.practiceAbueloCursor + 1) % ids.length;
    if (input.hit('Enter') || input.hit(' ')) {
      this.game.startPractice(ids[this.practiceAbueloCursor], drill.id);
      this.practiceStep = null;
    }
  }

  // dos patrocinios a la vez: el local por objetivos (temporal, como
  // siempre) y el de camiseta (permanente, fijo hasta que se cambie)
  _drawSponsor() {
    const { screen, player, input } = this.game;
    screen.box(4, 8, 64, 20, '#8a7f66');
    screen.text(7, 9, 'PATROCINIO LOCAL', '#ffb347');
    screen.text(7, 10, '(por objetivos, con plazo)', '#8a7f66');
    if (player.sponsorship.active) {
      const deal = player.sponsorship.currentDeal();
      screen.text(7, 12, `${deal.name}:`, '#ffe680');
      wrapText(deal.desc, 56).forEach((l, k) => screen.text(7, 13 + k, l, '#c9c2a8'));
      screen.text(7, 15, `progreso ${player.sponsorship.active.progress}/${deal.target} · plazo semana ${player.sponsorship.active.deadlineJornada}`, '#9a927a');
    } else {
      screen.text(7, 12, 'Sin patrocinio activo ahora mismo.', '#8a8a7a');
      screen.text(7, 13, '[P] pedir un patrocinio nuevo', '#7CFC00');
      if (input.hit('p') || input.hit('P')) {
        const deal = player.sponsorship.offerNew(player.seasonClock.weekIndex, player.managerRep);
        player.news.push(`${deal.name} patrocina a la peña: ${deal.desc}.`);
        player.save();
      }
    }
    this._drawShirtSponsor();
  }

  _drawShirtSponsor() {
    const { screen, input, player } = this.game;
    const bx = 72;
    screen.box(bx, 8, 64, 20, '#8a7f66');
    screen.text(bx + 3, 9, 'PATROCINADOR DE CAMISETA', '#ffb347');
    screen.text(bx + 3, 10, '(fijo, hasta que lo cambies)', '#8a7f66');
    const current = player.sponsorship.shirtDeal();
    screen.text(bx + 3, 12, current ? `Actual: ${current.name} (+${current.perWin}€ por victoria de liga)` : 'Sin patrocinador de camiseta.', current ? '#ffe14d' : '#8a8a7a');

    const rep = player.managerRep;
    let yy = 14;
    SHIRT_SPONSOR_POOL.forEach((s, i) => {
      const locked = rep < s.repRequired;
      const isCurrent = current && current.id === s.id;
      const sel = i === this.cursor;
      if (sel) screen.box(bx + 2, yy - 1, 60, 3, '#7CFC00');
      screen.text(bx + 4, yy, s.name, locked ? '#5a5347' : isCurrent ? '#ffe14d' : sel ? '#fff' : '#88c8e8');
      screen.text(bx + 4, yy + 1, locked ? `req. rep ${s.repRequired}` : isCurrent ? 'firmado ahora mismo' : `+${s.perWin}€/victoria · firma: ${s.signBonus}€`, locked ? '#ff8c5b' : isCurrent ? '#8a7f66' : '#9a927a');
      yy += 3;
    });
    screen.text(bx + 3, yy, '[↑/↓] elegir   [ENTER] firmar', '#c9c2a8');

    if (input.hit('ArrowUp')) this.cursor = (this.cursor + SHIRT_SPONSOR_POOL.length - 1) % SHIRT_SPONSOR_POOL.length;
    if (input.hit('ArrowDown')) this.cursor = (this.cursor + 1) % SHIRT_SPONSOR_POOL.length;
    if (input.hit('Enter') || input.hit(' ')) {
      const s = SHIRT_SPONSOR_POOL[this.cursor];
      if (rep >= s.repRequired && !(current && current.id === s.id)) {
        player.sponsorship.signShirt(s.id);
        player.money += s.signBonus;
        player.news.push(`${s.name} se convierte en el nuevo patrocinador de camiseta de ${player.clubName}. +${s.signBonus}€.`);
        player.save();
      }
    }
  }

  // toda la información de la junta directiva en un sitio: quién es el
  // presidente (nombre/arquetipo/tono ya deterministas por club, ver
  // data/boardPresident.js), la confianza y sus ultimátums, y el detalle
  // completo de los objetivos de temporada y semanal — Inicio solo enseña
  // un resumen clicable de esto último (ver HubScreen._drawBoardCard)
  _drawJunta() {
    const { screen, player } = this.game;
    const pres = boardPresidentFor(player.clubName);

    screen.box(4, 8, 64, 20, '#8a7f66');
    screen.text(7, 9, 'LA JUNTA DIRECTIVA', '#ffb347');
    screen.text(7, 11, pres.name, '#ffe680');
    screen.text(7, 12, `presidente${boardAdj(pres, '', 'a')} ${pres.archetype}`, '#c9a35d');
    wrapText(`"${pres.tone}."`, 56).forEach((l, i) => screen.text(7, 14 + i, l, '#9a927a'));

    const confCol = player.boardConfidence <= 25 ? '#ff5c5c' : player.boardConfidence <= 50 ? '#ffe14d' : '#88e088';
    const filled = Math.round((player.boardConfidence / 100) * 40);
    const bar = `${'▓'.repeat(filled)}${'░'.repeat(40 - filled)}`;
    screen.text(7, 19, 'Confianza:', '#8a7f66');
    screen.text(7, 20, bar, confCol);
    screen.text(7, 21, `${player.boardConfidence}/100`, confCol);

    screen.text(7, 23, `Ultimátums esta temporada: ${player.boardUltimatums}`, player.boardUltimatums > 0 ? '#ff8c5b' : '#8a8a7a');
    if (player.boardCrisis) {
      screen.text(7, 25, '⚠ un ultimátum más y os bajan de categoría sin miramientos.', '#ff5c5c');
    } else {
      screen.text(7, 25, 'La junta no ha tenido que dar ningún ultimátum esta temporada.', '#8a8a7a');
    }

    const bx = 72;
    screen.box(bx, 8, 64, 20, '#8a7f66');
    screen.text(bx + 3, 9, 'OBJETIVOS', '#ffb347');
    screen.text(bx + 3, 11, 'DE TEMPORADA', '#c9a35d');
    wrapText(player.boardGoal.desc, 56).forEach((l, i) => screen.text(bx + 3, 12 + i, l, '#c8a0e8'));
    screen.text(bx + 3, 15, `Si se cumple: +${player.boardGoal.rewardMoney}€`, '#7ec850');
    screen.text(bx + 3, 16, `Si no: -${player.boardGoal.penaltyMoney}€`, '#ff8c5b');

    screen.text(bx + 3, 19, 'DE ESTA SEMANA', '#c9a35d');
    if (player.weeklyGoal) {
      wrapText(player.weeklyGoal.desc, 56).forEach((l, i) => screen.text(bx + 3, 20 + i, l, '#c8a0e8'));
      screen.text(bx + 3, 23, `Si se cumple: +${player.weeklyGoal.reward}€`, '#7ec850');
      if (player.weeklyGoal.penalty > 0) screen.text(bx + 3, 24, `Si no: -${player.weeklyGoal.penalty}€`, '#ff8c5b');
    } else {
      screen.text(bx + 3, 20, 'Sin objetivo semanal activo ahora mismo.', '#8a8a7a');
    }
  }

  // resumen de caja (gastado/ingresado/resultado de toda la vida, ver
  // Player.js — el dinero es un getter/setter que intercepta cualquier
  // += / -= sobre player.money en TODO el juego, sin tener que tocar cada
  // sitio) más el gráfico de barras semana a semana de las últimas 20
  // semanas (Player.economyLastWeeks)
  _drawEconomia() {
    const { screen, input, player } = this.game;
    // altura suficiente para título + etiqueta + subtítulo + los 5 renglones
    // de BIG_DIGITS: con menos de esto el propio marco cortaba los números
    // grandes por la mitad
    screen.box(4, 8, 132, 11, '#8a7f66');
    screen.text(7, 9, 'RESUMEN DE LA CAJA', '#ffb347');
    const cols = [
      { key: 'expense', label: 'GASTADO', value: player.totalSpent, color: '#ff6a5c' },
      { key: 'income', label: 'INGRESADO', value: player.totalEarned, color: '#7ec850' },
      { key: 'net', label: 'RESULTADO', sub: '(para invertir ahora mismo)', value: player.money, color: '#ffe14d' },
    ];
    const colW = Math.floor(128 / 3);
    let hovered = null;
    cols.forEach((c, i) => {
      const cx = 6 + i * colW + Math.floor(colW / 2);
      const rect = { x: 6 + i * colW, y: 10, w: colW, h: 8 };
      const over = hitRect(input.mouse.cx, input.mouse.cy, rect.x, rect.y, rect.w, rect.h);
      if (over) hovered = c;
      screen.text(cx - Math.floor(c.label.length / 2), 11, c.label, over ? '#fff' : '#c9c2a8');
      if (c.sub) screen.text(cx - Math.floor(c.sub.length / 2), 12, c.sub, '#6a6355');
      this._drawBigNumber(cx, 13, c.value, c.color);
    });

    this._drawEconomyChart();
    // el tooltip se pinta el último para quedar por encima del gráfico
    // (mismo patrón que LeagueMapScreen._drawClubTooltip / HubScreen)
    if (hovered) this._drawEconomyTooltip(hovered, input.mouse.cx, input.mouse.cy);
  }

  _drawBigNumber(cx, y, value, color) {
    const { screen } = this.game;
    const str = `${Math.round(value)}€`;
    const digits = str.replace('€', '');
    const w = digits.length * 5 - 1;
    let bx = cx - Math.floor(w / 2);
    for (const c of digits) {
      const glyph = BIG_DIGITS[c];
      if (glyph) screen.block(bx, y, glyph, color);
      bx += 5;
    }
    screen.text(bx + 1, y + 2, '€', color);
  }

  // ventana al pasar el ratón por GASTADO/INGRESADO/RESULTADO: desglose de
  // las últimas 5 semanas de esa misma cifra, para no depender solo de leer
  // la altura de las barras del gráfico a ojo
  _drawEconomyTooltip(col, mx, my) {
    const { screen, player } = this.game;
    const weeks = player.economyLastWeeks(5);
    const lines = [[`${col.label} — últimas 5 semanas`, '#ffe680']];
    for (const w of weeks) {
      if (w.weekIndex < 0) { lines.push(['(la partida no había empezado)', '#5a5347']); continue; }
      const val = col.key === 'expense' ? w.expense : col.key === 'income' ? w.income : w.income - w.expense;
      const sign = col.key === 'net' && val > 0 ? '+' : '';
      lines.push([`semana ${w.weekIndex + 1}: ${sign}${Math.round(val)}€`, val === 0 ? '#8a8a7a' : col.color]);
    }
    const tw = Math.max(...lines.map((l) => l[0].length)) + 4;
    const th = lines.length + 2;
    const tx = Math.min(mx + 2, screen.cols - tw - 1);
    const ty = Math.min(my + 1, screen.rows - th - 1);
    for (let r = 0; r < th; r++) for (let c = 0; c < tw; c++) screen.put(tx + c, ty + r, '█', '#000');
    screen.box(tx, ty, tw, th, '#ffe14d', 'double');
    lines.forEach((l, i) => screen.text(tx + 2, ty + 1 + i, l[0], l[1]));
  }

  // ventana al pasar el ratón por una barra del gráfico: ingreso/gasto/neto
  // de esa semana en concreto, en vez de tener que leer la altura a ojo
  _drawWeekTooltip(w, mx, my) {
    const { screen } = this.game;
    const lines = w.weekIndex < 0
      ? [[`SEMANA ${w.weekIndex + 1}`, '#ffe680'], ['(la partida aún no había empezado)', '#8a8a7a']]
      : [
          [`SEMANA ${w.weekIndex + 1}`, '#ffe680'],
          [`ingreso: ${Math.round(w.income)}€`, '#7ec850'],
          [`gasto: ${Math.round(w.expense)}€`, '#ff6a5c'],
          [`neto: ${w.income - w.expense > 0 ? '+' : ''}${Math.round(w.income - w.expense)}€`, w.income - w.expense >= 0 ? '#7ec850' : '#ff6a5c'],
        ];
    const tw = Math.max(...lines.map((l) => l[0].length)) + 4;
    const th = lines.length + 2;
    const tx = Math.min(mx + 2, screen.cols - tw - 1);
    const ty = Math.min(my + 1, screen.rows - th - 1);
    for (let r = 0; r < th; r++) for (let c = 0; c < tw; c++) screen.put(tx + c, ty + r, '█', '#000');
    screen.box(tx, ty, tw, th, '#ffe14d', 'double');
    lines.forEach((l, i) => screen.text(tx + 2, ty + 1 + i, l[0], l[1]));
  }

  // barras verde (ingreso) / roja (gasto) semana a semana, siempre las
  // últimas ECONOMY_WEEKS (las que aún no han pasado salen a 0, no vacías)
  _drawEconomyChart() {
    const { screen, input, player } = this.game;
    const bx = 4, by = 20, bw = 132, bh = 24;
    screen.box(bx, by, bw, bh, '#8a7f66');
    screen.text(bx + 3, by + 1, `INGRESOS Y GASTOS — ÚLTIMAS ${ECONOMY_WEEKS} SEMANAS`, '#ffb347');
    screen.text(bx + 3, by + 2, '■ ingreso', '#7ec850');
    screen.text(bx + 15, by + 2, '■ gasto', '#ff6a5c');

    const weeks = player.economyLastWeeks(ECONOMY_WEEKS);
    const maxVal = Math.max(1, ...weeks.flatMap((w) => [w.income, w.expense]));
    const hasData = weeks.some((w) => w.income > 0 || w.expense > 0);

    const chartTop = by + 4, chartBottom = by + bh - 6, chartH = chartBottom - chartTop + 1;
    screen.text(bx + 2, chartTop - 1, `${Math.round(maxVal)}€`, '#6a6355');
    screen.text(bx + 2, chartBottom, '0€', '#6a6355');
    for (let r = 0; r < chartH; r++) screen.put(bx + 8, chartTop + r, '│', '#4a453a');

    const stride = 5, x0 = bx + 10;
    let hoveredWeek = null;
    weeks.forEach((w, i) => {
      const gx = x0 + i * stride;
      const incH = w.income > 0 ? Math.max(1, Math.round((w.income / maxVal) * chartH)) : 0;
      const expH = w.expense > 0 ? Math.max(1, Math.round((w.expense / maxVal) * chartH)) : 0;
      const over = hitRect(input.mouse.cx, input.mouse.cy, gx, chartTop, 4, chartH);
      if (over) hoveredWeek = w;
      for (let r = 0; r < chartH; r++) {
        const yy = chartBottom - r;
        screen.text(gx, yy, r < incH ? '██' : '  ', over ? '#a8f0a8' : '#7ec850');
        screen.text(gx + 2, yy, r < expH ? '██' : '  ', over ? '#ffb0a8' : '#ff6a5c');
      }
      if (w.weekIndex >= 0 && (i % 4 === 0 || i === weeks.length - 1)) {
        const label = `${w.weekIndex + 1}`;
        screen.text(gx + 2 - Math.floor(label.length / 2), chartBottom + 2, label, '#8a7f66');
      }
    });
    screen.text(bx + 3, by + bh - 3, 'semana (número absoluto de partida) en el eje X · € en el eje Y · ratón sobre una barra = detalle', '#6a6355');
    if (!hasData) screen.textCenter(chartTop + Math.floor(chartH / 2), 'todavía no hay movimiento de caja que enseñar', '#8a8a7a');
    // el tooltip se pinta el último para quedar por encima de las propias barras
    if (hoveredWeek) this._drawWeekTooltip(hoveredWeek, input.mouse.cx, input.mouse.cy);
  }
}
