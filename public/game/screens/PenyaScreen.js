import { ABUELO_DATA, RETIRE_AT, STAT_KEYS, STAT_LABEL } from '../data/abuelos.js';
import { CLIMAS } from '../data/climas.js';
import { ITEMS } from '../data/items.js';
import { wrapText, truncate, drawTabRow, hitRect } from '../core/utils.js';
import { TabsBar } from './TabsBar.js';
import { upkeepFor } from '../model/Roster.js';
import { TransferPool } from '../domain/TransferPool.js';
import { SCOUT_TEMPLATES } from '../data/scouts.js';
import { FOREIGN_COUNTRIES } from '../data/countries.js';
import { generateScoutPortrait } from '../data/art/scoutPortraits.js';
import { resetChemistryFor, bondLabel } from '../domain/Chemistry.js';

const TABLE_X = 4, TABLE_Y0 = 10;
const TABLE_W = 132;
const COLUMNS = [
  { key: 'name', label: 'ABUELO', x: 6, w: 24 },
  { key: 'nivel', label: 'NIVEL', x: 32, w: 15 },
  { key: 'pulso', label: 'PULSO', x: 49, w: 6 },
  { key: 'brazo', label: 'BRAZO', x: 57, w: 6 },
  { key: 'mana', label: 'MAÑA', x: 65, w: 6 },
  { key: 'temple', label: 'TEMPLE', x: 73, w: 7 },
  { key: 'aguante', label: 'AGUANTE', x: 82, w: 8 },
  { key: 'edad', label: 'EDAD', x: 92, w: 5 },
  { key: 'sta', label: 'STAMINA', x: 99, w: 13 },
  { key: 'moral', label: 'ESTADO', x: 114, w: 16 },
];
const STAT_INFO = {
  nivel: 'Nivel de experiencia (se gana jugando) y progreso hasta el siguiente. Clic para repartir puntos si tiene pendientes.',
  pulso: 'Precisión para "arrimar" la bola al boliche. El corazón de la petanca.',
  brazo: 'Potencia de tiro: la fuerza para "matar" o desplazar bolas rivales de un golpe.',
  mana: 'Control del efecto: cuánto puede curvar la bola al rodar tras el bote.',
  temple: 'Aguanta la presión: cuanto más ajustado el marcador, menos le tiembla el pulso.',
  aguante: 'Resistencia física: cuánta stamina gasta por partida antes de fatigarse.',
  edad: 'Los años del abuelo. No afecta a las stats, pero marca cuándo se acerca la jubilación.',
  sta: 'Stamina actual: la energía que le queda. Si baja demasiado, no puede entrenar ni rendir igual.',
  moral: 'Estado de ánimo: sube y baja con resultados y rachas, y afecta a su rendimiento en la mesa.',
};
const MX = 4, MY0 = 10;
const MTABLE_W = 132;
const MCOLS = [
  { key: 'name', label: 'CANDIDATO', x: 6, w: 24 },
  { key: 'nationality', label: 'NACIONALIDAD', x: 32, w: 16 },
  { key: 'nivel', label: 'NIVEL (0-100)', x: 50, w: 22 },
  { key: 'edad', label: 'EDAD', x: 74, w: 6 },
  { key: 'estado', label: 'OJEO', x: 82, w: 24 },
  { key: 'precio', label: 'PRECIO', x: 108, w: 12 },
];

// los 6 países en los que se puede ojear (España + los 5 extranjeros)
const SCOUT_COUNTRIES = [{ code: 'ES', label: 'España' }, ...FOREIGN_COUNTRIES.map((c) => ({ code: c.code, label: c.label }))];

// Mi Peña: tu plantilla, el mercado unificado (a ciegas: solo aparece lo
// que tus ojeadores han descubierto) y la gestión de ojeadores. Un
// jugador en venta no existe de cara a ti hasta que un ojeador asignado a
// su país lo destape; a partir de ahí ves un rango de nivel 0-100 (más
// ancho cuanto peor el ojeador) hasta que lo scouteas a él en concreto.
const MAX_VISIBLE_ROWS = 26;

export class PenyaScreen {
  constructor(game) {
    this.game = game;
    this.cursor = game.player.captain || 0;
    this.mCursor = 0;
    this.section = 'plantilla';
    this.mentorMode = false;
    this.scroll = 0;
    this.mScroll = 0;
    this.allocating = null; // id del abuelo con el overlay de reparto de puntos abierto
    this.allocCursor = 0;
    this._rDrag = false; // arrastrando la barra de scroll de Plantilla
    this._mDrag = false; // arrastrando la barra de scroll de Mercado
    this.mSort = { key: 'nivel', dir: -1 }; // orden del Mercado: nivel de más a menos, por defecto
    this.oSub = 'contratar'; // sub-pestaña de OJEADORES: 'contratar' | 'asignar'
    this.oCursor = 0;
    this.assignCountryFor = null; // modal: { scoutId, cursor } — a qué país lo pones a ojear
    this.assignScoutFor = null; // modal: { seedKey, name, cursor } — qué ojeador vigila a este jugador
    this.panteonCursor = 0; // qué hueco de la plantilla se mira en el Panteón
  }

  // nivel 0-100 de una fila del mercado, tal y como se le puede mostrar al
  // jugador: un rango (si es una transferencia sin scoutear a fondo) o un
  // valor exacto (transferencia ya revelada, o Sin Equipo — sus stats
  // ACTUALES siempre se ven, solo su potencial se oculta hasta scoutear)
  _marketLevel(e) {
    if (e.kind === 'transfer' && !e.statsRevealed) return { known: false, lo: e.levelRange.lo, hi: e.levelRange.hi };
    const avg = (e.stats.pulso + e.stats.brazo + e.stats.mana + e.stats.temple + e.stats.aguante) / 5;
    return { known: true, exact: Math.round(avg * 10) };
  }

  // valor por el que ordenar una fila del mercado según la columna activa
  _marketSortValue(e, key) {
    switch (key) {
      case 'name': return e.name;
      case 'nationality': return e.nationality ? e.nationality.label : '';
      case 'nivel': { const lv = this._marketLevel(e); return lv.known ? lv.exact : (lv.lo + lv.hi) / 2; }
      case 'edad': return e.age;
      case 'estado': return (e.kind === 'transfer' ? e.statsRevealed : e.potentialRevealed) ? 1 : 0;
      case 'precio': return e.price;
      default: return 0;
    }
  }

  _sortedMarketEntries(entries) {
    const { key, dir } = this.mSort;
    return entries.slice().sort((a, b) => {
      const va = this._marketSortValue(a, key), vb = this._marketSortValue(b, key);
      if (typeof va === 'string') return dir * va.localeCompare(vb);
      return dir * (va - vb);
    });
  }

  // interacción real de una barra de scroll vertical: mantener pulsado
  // sobre el raíl (fuera de las flechas) arrastra el scroll en proporción
  // a la posición del ratón, como una barra normal; clicar una flecha
  // avanza una fila. Antes la barra solo se dibujaba — no reaccionaba a
  // nada, ni al arrastre ni al clic.
  _scrollbarInteract(trackX, trackY, visibleRows, maxOffset, get, set, dragFlagKey) {
    const { input } = this.game;
    if (maxOffset <= 0) { this[dragFlagKey] = false; return; }
    const cx = input.mouse.cx, cy = input.mouse.cy;
    const overCol = cx === trackX;
    const trackH = Math.max(1, visibleRows - 2);

    if (!input.mouse.down) this[dragFlagKey] = false;
    else if (overCol && cy > trackY && cy < trackY + visibleRows - 1) this[dragFlagKey] = true;

    if (this[dragFlagKey]) {
      const rel = trackH > 1 ? (cy - (trackY + 1)) / (trackH - 1) : 0;
      set(Math.round(Math.max(0, Math.min(1, rel)) * maxOffset));
    } else if (input.mouse.clicked && overCol) {
      if (cy === trackY) set(Math.max(0, get() - 1));
      else if (cy === trackY + visibleRows - 1) set(Math.min(maxOffset, get() + 1));
    }
  }

  draw() {
    const { screen, input } = this.game;
    screen.clear();
    // una modal con su propio cierre por ESC tiene que consumir la tecla
    // ANTES de que TabsBar la vea, o el atajo global "ESC = Inicio" se
    // dispara el mismo frame y te saca de la pantalla sin querer
    if (input.hit('Escape')) {
      if (this.allocating !== null) { this.allocating = null; input.pressed.Escape = false; }
      else if (this.assignScoutFor) { this.assignScoutFor = null; input.pressed.Escape = false; }
      else if (this.assignCountryFor) { this.assignCountryFor = null; input.pressed.Escape = false; }
    }
    TabsBar.draw(this.game, 'penya');
    screen.textCenter(4, '═══ MI PEÑA ═══', '#ffb347');
    const sections = ['plantilla', 'mercado', 'ojeadores', 'panteon'];
    const clicked = drawTabRow(screen, input, TABLE_X, 6, ['PLANTILLA', 'MERCADO', 'OJEADORES', 'PANTEÓN'], sections.indexOf(this.section));
    screen.text(TABLE_X + 66, 6, '[Q] cambiar de pestaña', '#8a7f66');

    if (this.section === 'plantilla') this._drawPlantilla();
    else if (this.section === 'mercado') this._drawMercado();
    else if (this.section === 'ojeadores') this._drawOjeadores();
    else this._drawPanteon();

    if (clicked !== null) this.section = sections[clicked];
    else if (input.hit('q') || input.hit('Q')) this.section = sections[(sections.indexOf(this.section) + 1) % sections.length];
  }

  // ============================= PLANTILLA =============================
  _drawPlantilla() {
    const { screen, input, player, faces } = this.game;
    const ids = player.roster.ids;
    if (this.mentorMode) {
      const statLabel = STAT_LABEL[player.roster.mentorStatOf(this._pendingMentor)];
      screen.textCenter(8, `¿A QUIÉN ENSEÑA ${this.game.displayName(this._pendingMentor).toUpperCase()}? · su fuerte es ${statLabel} — solo ayuda extra si el pupilo entrena eso · [ENTER] elegir · [M] cancelar`, '#c8a0e8');
    } else {
      screen.textCenter(8, '[↑/↓] elegir · [ENTER] fichar (fundacional) · [A/T] entrenar · [G] retirar · [M] mentor · [P] repartir puntos · ratón = detalle', '#c9c2a8');
    }

    const visibleRows = Math.min(ids.length, MAX_VISIBLE_ROWS);
    screen.box(TABLE_X - 2, 9, TABLE_W, Math.max(visibleRows, 1) + 4, '#8a7f66');
    let headerHover = null;
    for (const col of COLUMNS) {
      const overHeader = input.mouse.cy === 10 && input.mouse.cx >= col.x - 1 && input.mouse.cx < col.x + col.w;
      if (overHeader && STAT_INFO[col.key]) headerHover = col.key;
      screen.text(col.x, 10, col.label, overHeader ? '#ffe680' : '#c9a35d');
    }
    for (let i = 0; i < COLUMNS.length - 1; i++) screen.put(COLUMNS[i + 1].x - 1, 9, '┬', '#8a7f66');
    screen.text(TABLE_X - 1, 11, '─'.repeat(TABLE_W - 3), '#5a5347');

    if (!ids.length) {
      screen.text(TABLE_X, 13, 'Aún no tienes a nadie en la peña. Ve al Mercado para fichar tu primer abuelo.', '#8a8a7a');
      return;
    }
    if (!ids.includes(this.cursor)) this.cursor = ids[0];

    const maxOffset = Math.max(0, ids.length - visibleRows);
    const plantillaBoxBottom = 9 + Math.max(visibleRows, 1) + 4;
    if (input.mouse.cx >= TABLE_X - 2 && input.mouse.cx < TABLE_X - 2 + TABLE_W && input.mouse.cy >= 9 && input.mouse.cy < plantillaBoxBottom) {
      this.scroll += input.wheel;
    }
    this.scroll = Math.max(0, Math.min(maxOffset, this.scroll));

    let activeHover = null, nivelClicked = null;
    const visibleIds = ids.slice(this.scroll, this.scroll + visibleRows);
    visibleIds.forEach((id, i) => {
      const rowY = TABLE_Y0 + 2 + i;
      const s = player.roster.get(id);
      const overRow = input.mouse.cy === rowY && input.mouse.cx >= TABLE_X - 1 && input.mouse.cx < TABLE_X + TABLE_W - 4;
      if (overRow) activeHover = id;
      const nivelCol = COLUMNS[1];
      const overNivel = input.mouse.cy === rowY && input.mouse.cx >= nivelCol.x - 1 && input.mouse.cx < nivelCol.x + nivelCol.w;
      if (overNivel && input.mouse.clicked) nivelClicked = id;
      const isCursor = id === this.cursor;
      if (overRow) screen.text(TABLE_X - 1, rowY, ' '.repeat(TABLE_W - 4), '#3a4a3a');
      this._drawRow(id, rowY, s, isCursor, overRow);
    });
    if (maxOffset > 0) {
      const trackX = TABLE_X - 2 + TABLE_W - 1, trackY = TABLE_Y0 + 2;
      screen.put(trackX, trackY, this.scroll > 0 ? '▲' : '│', '#8fa08f');
      screen.put(trackX, trackY + visibleRows - 1, this.scroll < maxOffset ? '▼' : '│', '#8fa08f');
      const trackH = Math.max(1, visibleRows - 2);
      const thumbY = Math.round((this.scroll / maxOffset) * (trackH - 1));
      for (let i = 0; i < trackH; i++) screen.put(trackX, trackY + 1 + i, i === thumbY ? '█' : '┊', i === thumbY ? '#cde0cd' : '#3a4a3a');
      this._scrollbarInteract(trackX, trackY, visibleRows, maxOffset, () => this.scroll, (v) => { this.scroll = v; }, '_rDrag');
    }

    if (activeHover !== null) this._drawTooltip(activeHover, input.mouse.cx, input.mouse.cy);
    else if (headerHover) this._drawHeaderTooltip(headerHover, input.mouse.cx, input.mouse.cy);

    if (input.hit('ArrowUp')) {
      this.cursor = ids[(ids.indexOf(this.cursor) + ids.length - 1) % ids.length];
      const idx = ids.indexOf(this.cursor);
      if (idx < this.scroll) this.scroll = idx;
      if (idx >= ids.length - 1) this.scroll = maxOffset;
    }
    if (input.hit('ArrowDown')) {
      this.cursor = ids[(ids.indexOf(this.cursor) + 1) % ids.length];
      const idx = ids.indexOf(this.cursor);
      if (idx >= this.scroll + visibleRows) this.scroll = idx - visibleRows + 1;
      if (idx === 0) this.scroll = 0;
    }
    if (activeHover !== null && input.mouse.clicked && nivelClicked === null) this.cursor = activeHover;
    if (nivelClicked !== null) { this.cursor = nivelClicked; this.allocating = nivelClicked; this.allocCursor = 0; }

    if (this.allocating !== null) {
      this._drawAllocator(this.allocating);
      return;
    }

    const s = player.roster.get(this.cursor);

    if (this.mentorMode) {
      if (input.hit('Enter') || input.hit(' ')) {
        if (player.roster.assignMentor(this._pendingMentor, this.cursor)) player.save();
        this.mentorMode = false;
      }
      if (input.hit('m') || input.hit('M')) this.mentorMode = false;
      return;
    }

    if (input.hit('p') || input.hit('P')) { this.allocating = this.cursor; this.allocCursor = 0; }

    if (s.st >= player.facilities.trainingCost() && !this.game.trainingScheduledFor(this.cursor) && !s.isInjured(player.seasonClock.day)) {
      if (input.hit('a') || input.hit('A')) this.game.scheduleTraining(this.cursor, 'ARRIME');
      if (input.hit('t') || input.hit('T')) this.game.scheduleTraining(this.cursor, 'TIRO');
    }
    if (s.torneos >= RETIRE_AT && (input.hit('g') || input.hit('G'))) {
      const hadLegend = resetChemistryFor(player, this.cursor);
      const { inherited } = s.retireToGrandchild();
      player.news.push(this._inheritanceNews(this.cursor, inherited));
      if (hadLegend) player.news.push(`FIN DE UNA ERA: la pareja de leyenda de ${this.game.displayName(this.cursor)} se deshace con el relevo. Al nieto le toca hacerse un hueco desde cero.`);
      player.save();
    }
    if (input.hit('m') || input.hit('M')) {
      this.mentorMode = true;
      this._pendingMentor = this.cursor;
    }
  }

  // titular del relevo generacional: cita el eco heredado (ver
  // AbueloState.retireToGrandchild) con el nombre de la familia del hueco
  _inheritanceNews(id, inherited) {
    const name = this.game.displayName(id);
    if (inherited.clima) {
      const cl = CLIMAS[inherited.clima];
      return `RELEVO EN LA PEÑA: el nieto de ${name} coge el testigo. Dicen que ${cl.label.toLowerCase()} tampoco le hace mella — ha salido a su abuelo.`;
    }
    return `RELEVO EN LA PEÑA: el nieto de ${name} coge el testigo. Se le nota de familia el ${STAT_LABEL[inherited.stat].toLowerCase()}.`;
  }

  _levelInfo(s) {
    const stats = {};
    for (const k of STAT_KEYS) stats[k] = s.getStatDisplay(k);
    return { stats };
  }

  _drawRow(id, rowY, s, isCursor, overRow) {
    const { screen, frame } = this.game;
    const { stats } = this._levelInfo(s);
    const col = isCursor ? '#fff' : overRow ? '#ffe680' : '#88c8e8';

    if (isCursor) screen.text(TABLE_X - 2, rowY, '▶', '#7CFC00');
    const streakTag = s.formStreak >= 3 ? ` x${s.formStreak}` : '';
    const nameW = COLUMNS[0].w - 1;
    screen.text(COLUMNS[0].x, rowY, truncate(this.game.displayName(id), nameW - streakTag.length), col);
    if (streakTag) screen.text(COLUMNS[0].x + nameW - streakTag.length, rowY, streakTag, '#ffb347');

    // nivel de experiencia (se gana jugando) + progreso hasta el siguiente;
    // si hay puntos pendientes de repartir, parpadea en dorado — clic aquí
    // abre el overlay de reparto (ver _nivelHitRect/_drawAllocator)
    const pct = Math.max(0, Math.min(1, s.xp / s.xpToNextLevel()));
    const bar = Math.round(pct * 5);
    const hasPoints = s.points > 0;
    const nivelCol = hasPoints ? (frame % 20 < 12 ? '#ffe14d' : '#a08838') : '#88c8e8';
    const nivelTxt = `Nv${s.level} ${'▓'.repeat(bar)}${'░'.repeat(5 - bar)}${hasPoints ? ` +${s.points}` : ''}`;
    screen.text(COLUMNS[1].x, rowY, nivelTxt, nivelCol);

    for (const k of STAT_KEYS) {
      const colDef = COLUMNS.find((c) => c.key === k);
      const trained = (s.bonus[k] || 0) > 0;
      screen.text(colDef.x, rowY, `${stats[k]}${trained ? '▲' : ''}`.padEnd(colDef.w - 1), trained ? '#a8e8a8' : col);
    }

    screen.text(COLUMNS[7].x, rowY, `${s.age}`, col);

    const stCol = s.st > 60 ? '#7ec850' : s.st > 30 ? '#ffe14d' : '#ff5c5c';
    const stBar = Math.round(s.st / 10);
    screen.text(COLUMNS[8].x, rowY, `${'▮'.repeat(stBar)}${'▯'.repeat(10 - stBar)}`, stCol);
    const day = this.game.player.seasonClock.day;
    if (s.isInjured(day)) {
      screen.text(COLUMNS[9].x, rowY, `LESIONADO (${s.injuredUntil - day}d)`, '#ff8c5b');
    } else {
      const moCol = s.mo >= 0 ? '#88e088' : '#ef9f9f';
      screen.text(COLUMNS[9].x, rowY, `moral ${s.mo >= 0 ? '+' : ''}${s.mo}`, moCol);
    }
  }

  _drawHeaderTooltip(key, mx, my) {
    const { screen } = this.game;
    const text = STAT_INFO[key];
    const col = COLUMNS.find((c) => c.key === key);
    const lines = [[col.label, '#ffe680'], ...wrapText(text, 42).map((l) => [l, '#c9c2a8'])];
    const tw = Math.min(46, Math.max(...lines.map((l) => l[0].length)) + 4);
    const th = lines.length + 2;
    const tx = Math.min(mx + 1, screen.cols - tw - 1);
    const ty = Math.min(my + 1, screen.rows - th - 1);
    this._fillBlack(tx, ty, tw, th);
    screen.box(tx, ty, tw, th, '#88c8e8', 'double');
    lines.forEach((l, i) => screen.text(tx + 2, ty + 1 + i, l[0], l[1]));
  }

  _fillBlack(x, y, w, h) {
    const { screen } = this.game;
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) screen.put(x + c, y + r, '█', '#000');
  }

  // retrato a tamaño original, pegado al tooltip: a la derecha si cabe,
  // si no a la izquierda, y siempre centrado en Y para que quepa entero
  _drawPortraitAddon(art, displayName, statusLabel, tx, ty, tw) {
    const { screen } = this.game;
    if (!art) return;
    const artW = art.layers ? Math.max(...art.layers.map(([, lines]) => Math.max(...lines.map((l) => l.length)))) : art.cols;
    const artH = art.layers ? Math.max(...art.layers.map(([, lines]) => lines.length)) : art.rows;
    const pw = artW + 2, ph = artH + 3;
    const py = Math.max(1, Math.min(screen.rows - ph - 1, Math.floor((screen.rows - ph) / 2)));
    let px = tx + tw + 1;
    if (px + pw > screen.cols) px = tx - pw - 1;
    if (px < 0) return;

    this._fillBlack(px, py, pw, ph);
    screen.box(px, py, pw, ph, '#ffe14d', 'double');
    screen.drawAnyPortrait(art, px + 1, py + 1);
    screen.text(px + 1, py + ph - 2, displayName.slice(0, pw - 2), statusLabel === 'owned' ? '#ffe14d' : '#c9c2a8');
  }

  // overlay de reparto de puntos: se abre al clicar el badge de nivel de un
  // abuelo (o con [P] sobre el seleccionado). Centrado en pantalla, capta
  // todo el input mientras está abierto (ver el `return` en _drawPlantilla)
  _drawAllocator(id) {
    const { screen, input, player } = this.game;
    const s = player.roster.get(id);
    const w = 54, h = 6 + STAT_KEYS.length * 2;
    const x = Math.floor((screen.cols - w) / 2), y = 11;
    this._fillBlack(x, y, w, h);
    screen.box(x, y, w, h, '#ffe14d', 'double');
    screen.text(x + 2, y, ` REPARTIR PUNTOS — ${this.game.displayName(id)} `, '#ffe680');
    screen.text(x + 2, y + 1, `Nivel ${s.level}  ·  ${s.xp}/${s.xpToNextLevel()} XP  ·  ${s.points} puntos disponibles`, '#c9c2a8');

    let ry = y + 3;
    STAT_KEYS.forEach((k, i) => {
      const sel = i === this.allocCursor;
      const val = s.getStatDisplay(k);
      const bar = Math.round(val / 5); // barra de 20 segmentos (100/5)
      const overRow = input.mouse.cy === ry && input.mouse.cx >= x + 2 && input.mouse.cx < x + w - 2;
      if (sel || overRow) screen.text(x + 2, ry, ' '.repeat(w - 4), '#3a2a10');
      const label = `${STAT_LABEL[k].padEnd(8)} ${'▮'.repeat(bar)}${'▯'.repeat(20 - bar)} ${val}`;
      screen.text(x + 2, ry, label, sel || overRow ? '#fff' : '#c9c2a8');
      if (overRow && input.mouse.clicked && s.points > 0) {
        this.allocCursor = i;
        if (s.allocatePoint(k, 1) > 0) player.save();
      }
      ry += 2;
    });

    const help = s.points > 0
      ? '[↑/↓] stat   [ENTER] repartir 1 punto   [ESC] cerrar'
      : 'Sin puntos pendientes   ·   [ESC] cerrar';
    screen.text(x + 2, y + h - 2, help, '#8a7f66');

    if (input.hit('ArrowUp')) this.allocCursor = (this.allocCursor + STAT_KEYS.length - 1) % STAT_KEYS.length;
    if (input.hit('ArrowDown')) this.allocCursor = (this.allocCursor + 1) % STAT_KEYS.length;
    if ((input.hit('Enter') || input.hit(' ') || input.hit('+') || input.hit('=')) && s.points > 0) {
      if (s.allocatePoint(STAT_KEYS[this.allocCursor], 1) > 0) player.save();
    }
    if (input.hit('Escape') || input.hit('p') || input.hit('P')) this.allocating = null;
  }

  _drawTooltip(id, mx, my) {
    const { screen, player } = this.game;
    const f = this.game.faces[id];
    const s = player.roster.get(id);

    const lines = [];
    lines.push([this.game.displayName(id), '#ffe680']);
    // nivel granular: la barra visual de siempre (más fina aquí que en la
    // tabla, 20 segmentos en vez de 5) más los números exactos de XP —
    // en la fila de la tabla no cabían, aquí sí hay sitio para verlos
    lines.push(['NIVEL:', '#ffb347']);
    if (s.isMaxLevel()) {
      lines.push([`  Nv.${s.level}  ${'▓'.repeat(20)}  NIVEL MÁXIMO`, '#a8d8ff']);
    } else {
      const pct = Math.max(0, Math.min(1, s.xp / s.xpToNextLevel()));
      const filled = Math.round(pct * 20);
      const bar = `${'▓'.repeat(filled)}${'░'.repeat(20 - filled)}`;
      lines.push([`  Nv.${s.level}  ${bar}  ${s.xp}/${s.xpToNextLevel()} XP`, '#a8d8ff']);
    }
    if (s.points > 0) lines.push([`  ${s.points} puntos por repartir (clic en el nivel de la tabla)`, '#ffd75e']);
    lines.push(['CLIMA:', '#ffb347']);
    for (const [k, v] of Object.entries(ABUELO_DATA[id].clima)) {
      const cl = CLIMAS[k];
      const tag = v === 1 ? 'INMUNE' : v === -1 ? 'LE AFECTA DOBLE' : 'normal';
      const c = v === 1 ? '#7ec850' : v === -1 ? '#ff5c5c' : '#999';
      lines.push([`  ${cl.icon} ${cl.label.padEnd(9)} ${tag}`, c]);
    }
    if (s.signed) {
      lines.push(['FICHAJE:', '#ffb347']);
      wrapText(`Llegó del mercado. Ocupa el hueco de ${f.name}.`, 40).forEach((l) => lines.push(['  ' + l, '#c9b98a']));
    } else {
      lines.push(['RASGO:', '#ffb347']);
      wrapText(f.desc, 40).forEach((l) => lines.push(['  ' + l, '#c9b98a']));
      wrapText(ABUELO_DATA[id].trait, 40).forEach((l) => lines.push(['  ' + l, '#d8b8e8']));
    }
    lines.push(['CARRERA:', '#ffb347']);
    lines.push([`  ${s.career.wins}V ${s.career.losses}D  ·  ${s.torneos} PARTIDAS / ${RETIRE_AT}  ·  sueldo ${upkeepFor(id, player.roster)}€/sem`, '#9a927a']);
    if (s.formStreak >= 2) lines.push([`  🔥 racha de ${s.formStreak} victorias seguidas${s.formStreak >= 3 ? ' (llega más firme a la mesa)' : ''}`, '#ffb347']);
    if (s.item) {
      const it = ITEMS[s.item.id];
      lines.push([`  objeto: ${it.name}`, '#ffd9a0']);
    }
    if (s.debt) lines.push([`  ⚔ cuenta pendiente con ${s.debt.label} — se salda ganándole con él en el equipo`, '#ff8c5b']);
    const bonds = player.roster.ids
      .filter((oid) => oid !== id)
      .map((oid) => [oid, bondLabel(player.chemistry, id, oid)])
      .filter(([, label]) => label);
    if (bonds.length) {
      lines.push(['VÍNCULOS:', '#ffb347']);
      for (const [oid, label] of bonds) lines.push([`  con ${this.game.displayName(oid)}: ${label}`, '#a8e8c8']);
    }
    const already = this.game.trainingScheduledFor(id);
    lines.push(['AGENDAR:', '#ffb347']);
    const day = player.seasonClock.day;
    if (s.isInjured(day)) lines.push([`  de baja, vuelve en ${s.injuredUntil - day} días — no puede jugar ni entrenar`, '#ff8c5b']);
    else if (already) lines.push([`  entreno de ${already.drill} el ${already.dayLabel}`, '#88c8e8']);
    else {
      const cost = player.facilities.trainingCost();
      lines.push([s.st >= cost ? `  [A] arrime  [T] tiro  (-${cost} STA)` : `  demasiado cansado (necesita ${cost} STA)`, s.st >= cost ? '#7CFC00' : '#8a7f66']);
    }
    const mentorId = this._mentorOf(id);
    lines.push(['MENTOR:', '#ffb347']);
    if (mentorId !== null) {
      const statLabel = STAT_LABEL[player.roster.mentorStatOf(mentorId)];
      lines.push([`  ${this.game.displayName(mentorId)} — enseña ${statLabel} extra`, '#c8a0e8']);
    } else {
      lines.push(['  sin mentor asignado', '#c8a0e8']);
    }

    const tw = Math.min(56, Math.max(...lines.map((l) => l[0].length)) + 4);
    const th = lines.length + 2;
    const tx = Math.min(mx + 2, screen.cols - tw - 1);
    const ty = Math.min(my + 1, screen.rows - th - 1);
    this._fillBlack(tx, ty, tw, th);
    screen.box(tx, ty, tw, th, '#ffe14d', 'double');
    lines.forEach((l, i) => screen.text(tx + 2, ty + 1 + i, l[0].slice(0, tw - 3), l[1]));

    const art = s.signed ? s.signed.portrait : f.photo;
    this._drawPortraitAddon(art, this.game.displayName(id), 'owned', tx, ty, tw);
  }

  _mentorOf(pupilId) {
    for (const id of this.game.player.roster.ids) {
      if (this.game.player.roster.get(id).mentorOf === pupilId) return id;
    }
    return null;
  }

  // =============================== MERCADO ===============================
  // candidatos de la propia peña sin fichar + prospectos del mercado de
  // transferencias, en una única lista con la misma regla: solo lo básico
  // y una stat al azar es "conocido" (más lo que haya destapado un ojeador
  // asignado desde El Club); el resto es un salto de fe
  _drawMercado() {
    const { screen, input, player } = this.game;
    const entries = this._sortedMarketEntries(this.game.marketEntries());
    screen.textCenter(8, '[↑/↓] elegir · [ENTER] fichar/sustituir · [S] asignar ojeador · clic en columna = ordenar', '#c9c2a8');
    const visibleRows = Math.min(entries.length, MAX_VISIBLE_ROWS);
    screen.box(MX - 2, 9, MTABLE_W, Math.max(visibleRows, 1) + 4, '#8a7f66');
    let sortHeaderHover = null;
    for (const col of MCOLS) {
      const overHeader = input.mouse.cy === 10 && input.mouse.cx >= col.x - 1 && input.mouse.cx < col.x + col.w;
      if (overHeader) sortHeaderHover = col.key;
      const isSort = this.mSort.key === col.key;
      const label = isSort ? `${col.label} ${this.mSort.dir === 1 ? '▲' : '▼'}` : col.label;
      screen.text(col.x, 10, label, isSort ? '#ffe680' : (overHeader ? '#fff' : '#c9a35d'));
    }
    if (input.mouse.clicked && sortHeaderHover) {
      if (this.mSort.key === sortHeaderHover) this.mSort.dir *= -1;
      else { this.mSort.key = sortHeaderHover; this.mSort.dir = 1; }
    }
    for (let i = 0; i < MCOLS.length - 1; i++) screen.put(MCOLS[i + 1].x - 1, 9, '┬', '#8a7f66');
    screen.text(MX - 1, 11, '─'.repeat(MTABLE_W - 3), '#5a5347');

    if (!entries.length) {
      screen.text(MX, 13, 'Nadie descubierto todavía. Manda a un ojeador a ojear un país (pestaña OJEADORES).', '#8a8a7a');
    }
    if (this.mCursor >= entries.length) this.mCursor = Math.max(0, entries.length - 1);

    const maxOffset = Math.max(0, entries.length - visibleRows);
    const boxBottom = 9 + Math.max(visibleRows, 1) + 4;
    if (input.mouse.cx >= MX - 2 && input.mouse.cx < MX - 2 + MTABLE_W && input.mouse.cy >= 9 && input.mouse.cy < boxBottom) {
      this.mScroll += input.wheel;
    }
    this.mScroll = Math.max(0, Math.min(maxOffset, this.mScroll));

    let activeHover = null;
    const visibleEntries = entries.slice(this.mScroll, this.mScroll + visibleRows);
    visibleEntries.forEach((e, i) => {
      const idx = this.mScroll + i;
      const rowY = MY0 + 2 + i;
      const overRow = input.mouse.cy === rowY && input.mouse.cx >= MX - 1 && input.mouse.cx < MX + MTABLE_W - 4;
      if (overRow) activeHover = idx;
      const isCursor = idx === this.mCursor;
      if (overRow) screen.text(MX - 1, rowY, ' '.repeat(MTABLE_W - 4), '#3a4a3a');
      this._drawMarketRow(e, rowY, isCursor, overRow);
    });
    if (maxOffset > 0) {
      const trackX = MX - 2 + MTABLE_W - 1, trackY = MY0 + 2;
      screen.put(trackX, trackY, this.mScroll > 0 ? '▲' : '│', '#8fa08f');
      screen.put(trackX, trackY + visibleRows - 1, this.mScroll < maxOffset ? '▼' : '│', '#8fa08f');
      const trackH = Math.max(1, visibleRows - 2);
      const thumbY = Math.round((this.mScroll / maxOffset) * (trackH - 1));
      for (let i = 0; i < trackH; i++) screen.put(trackX, trackY + 1 + i, i === thumbY ? '█' : '┊', i === thumbY ? '#cde0cd' : '#3a4a3a');
      this._scrollbarInteract(trackX, trackY, visibleRows, maxOffset, () => this.mScroll, (v) => { this.mScroll = v; }, '_mDrag');
    }

    if (activeHover !== null && !this.assignScoutFor) this._drawMarketTooltip(entries[activeHover], input.mouse.cx, input.mouse.cy);

    if (this.assignScoutFor) { this._drawAssignScoutModal(); return; }

    if (entries.length) {
      // el ajuste de mScroll para seguir al cursor va DENTRO de cada rama de
      // tecla: si corriera siempre (como antes), deshacía en el mismo frame
      // cualquier scroll manual (rueda o arrastre de la barra), porque
      // mCursor no se mueve solo al hacer scroll y quedaba "fuera" de la
      // ventana visible, disparando el reajuste cada fotograma.
      if (input.hit('ArrowUp')) {
        this.mCursor = (this.mCursor + entries.length - 1) % entries.length;
        if (this.mCursor < this.mScroll) this.mScroll = this.mCursor;
        if (this.mCursor >= entries.length - 1) this.mScroll = maxOffset;
      }
      if (input.hit('ArrowDown')) {
        this.mCursor = (this.mCursor + 1) % entries.length;
        if (this.mCursor >= this.mScroll + visibleRows) this.mScroll = this.mCursor - visibleRows + 1;
        if (this.mCursor === 0) this.mScroll = 0;
      }
      if (activeHover !== null && input.mouse.clicked) this.mCursor = activeHover;
      if (input.hit('Enter') || input.hit(' ')) this._buy(entries[this.mCursor]);
      if ((input.hit('s') || input.hit('S')) && player.scoutStaff.hired.length) {
        const e = entries[this.mCursor];
        const alreadyKnown = e.kind === 'transfer' ? e.statsRevealed : e.potentialRevealed;
        if (!alreadyKnown) {
          this.assignScoutFor = { seedKey: e.seedKey, name: e.name, cursor: 0 };
          input.pressed.s = false; input.pressed.S = false;
        }
      }
    }
  }

  _drawMarketRow(e, rowY, isCursor, overRow) {
    const { screen, player } = this.game;
    const col = isCursor ? '#fff' : overRow ? '#ffe680' : e.kind === 'transfer' ? '#d8b8e8' : '#7ec8a0';

    if (isCursor) screen.text(MX - 2, rowY, '▶', '#7CFC00');
    screen.text(MCOLS[0].x, rowY, truncate(e.name, MCOLS[0].w - 1), col);
    const natLabel = e.kind === 'transfer' ? e.nationality.label : 'Sin Equipo';
    screen.text(MCOLS[1].x, rowY, truncate(natLabel, MCOLS[1].w - 1), e.kind === 'transfer' ? '#c9c2a8' : '#7a7a6a');

    const lv = this._marketLevel(e);
    const mid = lv.known ? lv.exact : Math.round((lv.lo + lv.hi) / 2);
    const nivelCol = mid >= 70 ? '#ffe14d' : mid >= 40 ? '#88e088' : '#c98080';
    const nivelTxt = lv.known ? `${mid}` : `${lv.lo}-${lv.hi}`;
    screen.text(MCOLS[2].x, rowY, nivelTxt.padEnd(MCOLS[2].w - 1), nivelCol);
    screen.text(MCOLS[3].x, rowY, `${e.age}`, col);

    const scout = player.scoutStaff.scoutOf(e.seedKey);
    const known = e.kind === 'transfer' ? e.statsRevealed : e.potentialRevealed;
    const estadoTxt = known ? 'REVELADO' : scout ? 'scouteando…' : 'rango estimado';
    screen.text(MCOLS[4].x, rowY, truncate(`${estadoTxt}${scout ? ' 🔎' : ''}`, MCOLS[4].w - 1), known ? '#7ec850' : scout ? '#88c8e8' : '#8a7f66');
    screen.text(MCOLS[5].x, rowY, `${e.price}€`, e.afford ? '#7ec850' : '#ff5c5c');
  }

  _drawMarketTooltip(e, mx, my) {
    const { screen, player } = this.game;
    const scout = player.scoutStaff.scoutOf(e.seedKey);
    const known = e.kind === 'transfer' ? e.statsRevealed : e.potentialRevealed;
    const lv = this._marketLevel(e);
    const lines = [];
    lines.push([e.name, '#ffe680']);
    lines.push([`Nivel: ${lv.known ? `${lv.exact}/100` : `${lv.lo}-${lv.hi}/100 (estimado)`}`, '#ffe14d']);
    if (scout) {
      const tpl = SCOUT_TEMPLATES.find((t) => t.id === scout.templateId);
      const left = Math.max(0, tpl.weeksToReveal - (player.seasonClock.weekIndex - scout.assignedWeek));
      lines.push([`🔎 ${tpl.name} scouteándolo — informe completo en ${left} semana(s)`, '#7ec850']);
    } else if (!known) {
      lines.push(['  sin ojeador asignado — [S] para ponerle uno encima', '#8a7f66']);
    }
    lines.push(['STATS:', '#ffb347']);
    for (const k of STAT_KEYS) {
      const detail = known ? `${e.stats[k]}` : '???';
      lines.push([`  ${STAT_LABEL[k].padEnd(8)} ${detail}`, known ? '#a8e8a8' : '#5a5347']);
    }
    if (e.kind === 'freeagent') {
      lines.push([`SIN EQUIPO: techo ${e.potentialRevealed ? `${'★'.repeat(e.potentialStars)}${'☆'.repeat(5 - e.potentialStars)}` : '??? (sin scoutear)'}`, '#7ec8a0']);
      lines.push(['  no juega, no entrena: sus stats de arriba se quedan igual hasta que lo fiches', '#9a927a']);
      lines.push(['  fichado, su potencial (una vez lo sepas) marca hasta dónde puede llegar entrenando', '#9a927a']);
    } else {
      lines.push([`Nacionalidad: ${e.nationality.label}`, '#c9c2a8']);
      lines.push([`Excedente de ${e.clubName} (liga de ${e.cityName})`, '#c9c2a8']);
    }
    const wage = 5 + Math.round(e.price / 100);
    lines.push(['', '#000']);
    lines.push([`Sueldo estimado: ${wage}€/semana`, '#c98080']);
    lines.push([e.kind === 'freeagent' ? '[ENTER] fichar gratis' : (e.afford ? `[ENTER] fichar por ${e.price}€` : `Te faltan ${e.price}€`), e.afford ? '#7CFC00' : '#ff5c5c']);

    const tw = Math.min(70, Math.max(...lines.map((l) => l[0].length)) + 4);
    const th = lines.length + 2;
    const tx = Math.min(mx + 2, screen.cols - tw - 1);
    const ty = Math.min(my + 1, screen.rows - th - 1);
    this._fillBlack(tx, ty, tw, th);
    screen.box(tx, ty, tw, th, '#88c8e8', 'double');
    lines.forEach((l, i) => screen.text(tx + 2, ty + 1 + i, l[0].slice(0, tw - 3), l[1]));

    this._drawPortraitAddon(e.portrait, e.name, 'market', tx, ty, tw);
  }

  // modal: qué ojeador (de los que tienes libres) se pone a vigilar a ESTE
  // jugador en concreto — reemplaza cualquier asignación previa que
  // tuviera ese ojeador (país u otro jugador)
  _drawAssignScoutModal() {
    const { screen, input, player } = this.game;
    const staff = player.scoutStaff.hired;
    const w = 60, h = Math.min(24, 8 + staff.length * 2);
    const x = Math.floor((screen.cols - w) / 2), y = Math.floor((screen.rows - h) / 2);
    this._fillBlack(x, y, w, h);
    screen.box(x, y, w, h, '#ffe14d', 'double');
    screen.textCenter(y + 1, `¿QUIÉN SCOUTEA A ${this.assignScoutFor.name.toUpperCase()}?`, '#ffe680');
    if (!staff.length) {
      screen.textCenter(y + 4, 'No tienes ojeadores contratados.', '#8a8a7a');
      screen.textCenter(y + h - 2, '[ESC] cerrar', '#c9c2a8');
      if (input.hit('Escape') || input.hit('Enter')) this.assignScoutFor = null;
      return;
    }
    this.assignScoutFor.cursor = ((this.assignScoutFor.cursor % staff.length) + staff.length) % staff.length;
    staff.forEach((h2, i) => {
      const tpl = SCOUT_TEMPLATES.find((t) => t.id === h2.templateId);
      const sel = i === this.assignScoutFor.cursor;
      const busyTxt = h2.mode === 'player' && h2.assignedTo !== this.assignScoutFor.seedKey ? ' (vigilando a otro)'
        : h2.mode === 'country' ? ` (ojeando ${h2.country})` : '';
      screen.text(x + 4, y + 3 + i * 2, `${sel ? '▶' : ' '} ${'★'.repeat(tpl.level)} ${tpl.name}${busyTxt}`, sel ? '#fff' : busyTxt ? '#8a7f66' : '#c9c2a8');
    });
    screen.textCenter(y + h - 2, '[↑/↓] elegir   [ENTER] asignar   [ESC] cancelar', '#c9c2a8');
    if (input.hit('ArrowUp')) this.assignScoutFor.cursor = (this.assignScoutFor.cursor + staff.length - 1) % staff.length;
    if (input.hit('ArrowDown')) this.assignScoutFor.cursor = (this.assignScoutFor.cursor + 1) % staff.length;
    if (input.hit('Enter') || input.hit(' ')) {
      const chosen = staff[this.assignScoutFor.cursor];
      player.scoutStaff.assignPlayer(chosen.id, this.assignScoutFor.seedKey, player.seasonClock.weekIndex);
      player.save();
      this.assignScoutFor = null;
    }
    if (input.hit('Escape')) { this.assignScoutFor = null; input.pressed.Escape = false; }
  }

  // hueco de plantilla que ocupará un fichaje nuevo: uno de los huecos base
  // (0..9) que aún no esté en la plantilla si queda alguno libre — así
  // fichar hace crecer la plantilla de verdad — o, si ya están los 10
  // ocupados, el más flojo, al que se sustituye (comportamiento de
  // siempre: un fichaje nuevo relega al peor).
  _pickTargetSlot() {
    const { player } = this.game;
    for (let id = 0; id < ABUELO_DATA.length; id++) {
      if (!player.roster.has(id)) return { id, fresh: true };
    }
    let worst = player.roster.ids[0];
    for (const id of player.roster.ids) {
      if (player.roster.get(id).getStat('pulso') < player.roster.get(worst).getStat('pulso')) worst = id;
    }
    return { id: worst, fresh: false };
  }

  _buy(e) {
    const { player } = this.game;
    if (!e.afford) return;
    player.scoutStaff.releaseTarget(e.seedKey);
    const slot = this._pickTargetSlot();
    if (slot.fresh) player.roster.recruit(slot.id, false);
    if (e.kind === 'freeagent') {
      player.roster.get(slot.id).signPlayer({
        name: e.name, nationality: e.nationality, portrait: e.portrait, miniPortrait: e.ref.miniPortrait,
        stats: e.stats, age: e.age, potentialCap: e.potential,
      });
      player.news.push(`SIN EQUIPO: ${e.name} (${e.age} años) sube al primer equipo.`);
      player.freeAgents.agents = player.freeAgents.agents.filter((c) => c !== e.ref);
      this.cursor = slot.id;
    } else {
      player.money = TransferPool.buyForHuman(e.listing, player.money);
      player.roster.get(slot.id).signPlayer(e.ref);
      player.news.push(`FICHAJE: ${e.name} (${e.nationality.label}), de ${e.clubName}, se une a ${player.clubName} por ${e.price}€.`);
      this.cursor = slot.id;
    }
    const deal = player.sponsorship.currentDeal();
    if (deal && deal.metric === 'fichajes') {
      const res = player.sponsorship.advance('fichajes', 1, player.seasonClock.weekIndex);
      if (res && res.completed) {
        const bonus = Math.round(res.reward * player.facilities.sponsorMultiplier());
        player.money += bonus;
        player.news.push(`Patrocinio cumplido: ${res.deal.name} paga ${bonus}€.`);
      }
    }
    this.section = 'plantilla';
    this.mCursor = 0;
    this.mScroll = 0;
    player.save();
  }

  // =============================== OJEADORES ==============================
  // contratar staff + ponerlo a ojear un país entero (el Mercado solo
  // muestra lo que ellos van descubriendo — ver domain/Scouting.js). Para
  // asignar un ojeador a un jugador YA descubierto en concreto se hace
  // desde la fila del Mercado, con [S] — ahí es donde tiene sentido mirar.
  _drawOjeadores() {
    const { screen, input } = this.game;
    const oSubs = ['contratar', 'asignar'];
    const modalOpen = !!this.assignCountryFor;
    const clicked = modalOpen ? null : drawTabRow(screen, input, TABLE_X, 8, ['CONTRATAR', 'ASIGNAR'], oSubs.indexOf(this.oSub), { activeColor: '#c9a35d', color: '#c9a35d' });
    screen.text(TABLE_X, 9, '[W] cambiar contratar/asignar', '#8a7f66');
    if (this.oSub === 'contratar') this._drawScoutHire();
    else this._drawScoutAssign();
    if (this.assignCountryFor) this._drawAssignCountryModal();
    if (clicked !== null) { this.oSub = oSubs[clicked]; this.oCursor = 0; }
    else if (!modalOpen && (input.hit('w') || input.hit('W'))) { this.oSub = this.oSub === 'contratar' ? 'asignar' : 'contratar'; this.oCursor = 0; }
  }

  // una fila por tipo de ojeador contratable, con retrato en tooltip —
  // mismo patrón visual que el resto de tablas de Mi Peña
  _drawScoutHire() {
    const { screen, input, player } = this.game;
    screen.box(4, 11, 132, 17, '#8a7f66');
    screen.text(7, 12, 'CONTRATAR OJEADORES', '#ffb347');
    screen.text(30, 12, `reputación: ${player.managerRep} (${player.managerRepLabel})`, '#c8a0e8');

    const cols = [
      { key: 'name', label: 'OJEADOR', x: 7, w: 26 },
      { key: 'nivel', label: 'NIVEL', x: 34, w: 11 },
      { key: 'descubre', label: 'DESCUBRE', x: 46, w: 16 },
      { key: 'revela', label: 'REVELA', x: 63, w: 16 },
      { key: 'rango', label: 'RANGO', x: 80, w: 10 },
      { key: 'coste', label: 'COSTE', x: 91, w: 14 },
      { key: 'estado', label: 'CONTRATADOS', x: 106, w: 24 },
    ];
    const tableY = 14;
    for (const c of cols) screen.text(c.x, tableY, c.label, '#c9a35d');
    screen.text(6, tableY + 1, '─'.repeat(125), '#5a5347');

    const rep = player.managerRep;
    let hoverT = null;
    SCOUT_TEMPLATES.forEach((t, i) => {
      const rowY = tableY + 2 + i;
      const locked = rep < t.repRequired;
      const hiredInstances = player.scoutStaff.hired.filter((h) => h.templateId === t.id);
      const owned = hiredInstances.length > 0;
      const sel = i === this.oCursor;
      const overRow = hitRect(input.mouse.cx, input.mouse.cy, 6, rowY, 126, 1);
      if (overRow) hoverT = t;
      if (overRow) screen.text(6, rowY, ' '.repeat(126), '#3a4a3a');
      if (sel) screen.text(4, rowY, '▶', '#7CFC00');
      const col = sel ? '#fff' : overRow ? '#ffe680' : locked ? '#5a5347' : owned ? '#7ec850' : '#88c8e8';

      screen.text(cols[0].x, rowY, truncate(t.name, cols[0].w - 1), col);
      screen.text(cols[1].x, rowY, '★'.repeat(t.level) + '☆'.repeat(4 - t.level), locked ? '#5a5347' : '#ffe14d');
      screen.text(cols[2].x, rowY, truncate(`1 cada ${t.weeksPerDiscovery} sem`, cols[2].w - 1), col);
      screen.text(cols[3].x, rowY, truncate(`${t.weeksToReveal} sem`, cols[3].w - 1), col);
      screen.text(cols[4].x, rowY, `±${t.rangeWidth}`, col);
      screen.text(cols[5].x, rowY, locked ? `req. rep ${t.repRequired}` : `${t.cost}€`, locked ? '#ff8c5b' : player.money >= t.cost ? '#7ec850' : '#ff5c5c');
      screen.text(cols[6].x, rowY, owned ? `${hiredInstances.length} contratado(s)` : 'no contratado', owned ? '#88c8e8' : '#8a7f66');
    });

    screen.text(7, tableY + SCOUT_TEMPLATES.length + 3, '[↑/↓] elegir · ratón = seleccionar   [ENTER] contratar (se puede repetir)', '#c9c2a8');
    if (hoverT) this._drawScoutTooltip(hoverT, input.mouse.cx, input.mouse.cy);

    if (input.hit('ArrowUp')) this.oCursor = (this.oCursor + SCOUT_TEMPLATES.length - 1) % SCOUT_TEMPLATES.length;
    if (input.hit('ArrowDown')) this.oCursor = (this.oCursor + 1) % SCOUT_TEMPLATES.length;
    if (hoverT && input.mouse.clicked) this.oCursor = SCOUT_TEMPLATES.indexOf(hoverT);
    if (input.hit('Enter') || input.hit(' ')) {
      const t = SCOUT_TEMPLATES[this.oCursor];
      if (player.money >= t.cost && player.managerRep >= t.repRequired) { player.money -= t.cost; player.scoutStaff.hire(t.id); player.save(); }
    }
  }

  _drawScoutTooltip(t, mx, my) {
    const { screen, player } = this.game;
    const hiredInstances = player.scoutStaff.hired.filter((h) => h.templateId === t.id);
    const lines = [];
    lines.push([t.name, '#ffe680']);
    lines.push([`${'★'.repeat(t.level)}${'☆'.repeat(4 - t.level)} nivel ${t.level}`, '#ffe14d']);
    wrapText(t.desc, 40).forEach((l) => lines.push(['  ' + l, '#c9b98a']));
    lines.push([`Descubre un excedente nuevo cada ${t.weeksPerDiscovery} semana(s) de país ojeado.`, '#9a927a']);
    lines.push([`Revela las stats reales de un jugador en ${t.weeksToReveal} semana(s).`, '#9a927a']);
    lines.push([`Rango de nivel al descubrir: ±${t.rangeWidth} puntos sobre 100.`, '#9a927a']);
    if (t.repRequired > 0) lines.push([`Requiere reputación ${t.repRequired}`, '#c8a0e8']);
    if (!hiredInstances.length) {
      lines.push([`Coste: ${t.cost}€  ·  [ENTER] contratar`, player.money >= t.cost ? '#7CFC00' : '#ff5c5c']);
    } else {
      lines.push([`CONTRATADOS: ${hiredInstances.length}`, '#7ec850']);
    }

    const tw2 = Math.min(50, Math.max(...lines.map((l) => l[0].length)) + 4);
    const th2 = lines.length + 2;
    const tx2 = Math.min(mx + 2, screen.cols - tw2 - 1);
    const ty2 = Math.min(my + 1, screen.rows - th2 - 1);
    this._fillBlack(tx2, ty2, tw2, th2);
    screen.box(tx2, ty2, tw2, th2, '#88c8e8', 'double');
    lines.forEach((l, i) => screen.text(tx2 + 2, ty2 + 1 + i, l[0].slice(0, tw2 - 3), l[1]));

    const portrait = generateScoutPortrait(t.id);
    const pw = portrait.cols + 2, ph = portrait.rows + 3;
    const py = Math.max(1, Math.min(screen.rows - ph - 1, Math.floor((screen.rows - ph) / 2)));
    let px = tx2 + tw2 + 1;
    if (px + pw > screen.cols) px = tx2 - pw - 1;
    if (px < 0) return;

    this._fillBlack(px, py, pw, ph);
    screen.box(px, py, pw, ph, '#ffe14d', 'double');
    screen.drawAnyPortrait(portrait, px + 1, py + 1);
    screen.text(px + 1, py + ph - 2, truncate(t.name, pw - 2), '#ffe14d');
  }

  // una fila por ojeador YA contratado: su estado (parado / ojeando un
  // país / vigilando a un jugador) y, con ENTER, el modal para ponerlo a
  // ojear un país (o dejarlo libre)
  _drawScoutAssign() {
    const { screen, input, player } = this.game;
    const staff = player.scoutStaff.hired;
    screen.box(4, 11, 132, 17, '#8a7f66');
    screen.text(7, 12, 'ASIGNAR OJEADORES', '#ffb347');
    if (!staff.length) {
      screen.text(7, 14, 'No tienes ojeadores contratados. Ve a CONTRATAR.', '#8a8a7a');
      return;
    }
    this.oCursor = ((this.oCursor % staff.length) + staff.length) % staff.length;

    let yy = 14;
    staff.forEach((h, i) => {
      const tpl = SCOUT_TEMPLATES.find((t) => t.id === h.templateId);
      const sel = i === this.oCursor;
      const overRow = hitRect(input.mouse.cx, input.mouse.cy, 6, yy, 126, 1);
      if (sel || overRow) screen.text(6, yy, ' '.repeat(126), '#3a4a3a');
      const col = sel ? '#fff' : overRow ? '#ffe680' : '#c9c2a8';
      screen.text(7, yy, `${sel ? '▶' : ' '} ${'★'.repeat(tpl.level)} ${tpl.name}`, col);

      let statusTxt, statusCol;
      if (h.mode === 'country') {
        const listings = TransferPool.globalListings(player.leagueWorld, player.foreignLeagues);
        const total = listings.filter((l) => l.player.nationality.code === h.country).length;
        const found = listings.filter((l) => l.player.nationality.code === h.country && l.player.discovered).length;
        statusTxt = `ojeando ${h.country} — ${found}/${total} excedentes descubiertos`;
        statusCol = '#7ec850';
      } else if (h.mode === 'player') {
        const entry = this.game.marketEntries().find((e) => e.seedKey === h.assignedTo);
        statusTxt = `vigilando a ${entry ? entry.name : '(ya no está en venta)'} — asígnalo desde el Mercado`;
        statusCol = '#88c8e8';
      } else {
        statusTxt = 'parado — sin asignar';
        statusCol = '#8a7f66';
      }
      screen.text(46, yy, truncate(statusTxt, 84), statusCol);
      if (overRow && input.mouse.clicked) this.oCursor = i;
      yy += 2;
    });

    screen.text(7, yy + 1, '[↑/↓] elegir · ratón = seleccionar   [ENTER] ojear un país   [U] dejar libre', '#c9c2a8');

    if (input.hit('ArrowUp')) this.oCursor = (this.oCursor + staff.length - 1) % staff.length;
    if (input.hit('ArrowDown')) this.oCursor = (this.oCursor + 1) % staff.length;
    if (input.hit('Enter') || input.hit(' ')) {
      this.assignCountryFor = { scoutId: staff[this.oCursor].id, cursor: 0 };
      input.pressed.Enter = false; input.pressed[' '] = false;
    }
    if (input.hit('u') || input.hit('U')) { player.scoutStaff.unassign(staff[this.oCursor].id); player.save(); }
  }

  // modal: a qué país pones a ojear a este ojeador — muestra cuántos
  // excedentes le quedan por descubrir en cada uno, para decidir con algo
  // de información en vez de a ciegas
  _drawAssignCountryModal() {
    const { screen, input, player } = this.game;
    const listings = TransferPool.globalListings(player.leagueWorld, player.foreignLeagues);
    const w = 72, h = 8 + SCOUT_COUNTRIES.length * 2;
    const x = Math.floor((screen.cols - w) / 2), y = Math.floor((screen.rows - h) / 2);
    this._fillBlack(x, y, w, h);
    screen.box(x, y, w, h, '#ffe14d', 'double');
    screen.textCenter(y + 1, '¿QUÉ PAÍS OJEA?', '#ffe680');

    this.assignCountryFor.cursor = ((this.assignCountryFor.cursor % SCOUT_COUNTRIES.length) + SCOUT_COUNTRIES.length) % SCOUT_COUNTRIES.length;
    SCOUT_COUNTRIES.forEach((c, i) => {
      const total = listings.filter((l) => l.player.nationality.code === c.code).length;
      const pending = listings.filter((l) => l.player.nationality.code === c.code && !l.player.discovered).length;
      const sel = i === this.assignCountryFor.cursor;
      screen.text(x + 4, y + 3 + i * 2, `${sel ? '▶' : ' '} ${c.label}`, sel ? '#fff' : '#c9c2a8');
      screen.text(x + 30, y + 3 + i * 2, `${pending} por descubrir de ${total} excedentes`, sel ? '#ffe680' : '#8a7f66');
    });
    screen.textCenter(y + h - 2, '[↑/↓] elegir   [ENTER] asignar   [ESC] cancelar', '#c9c2a8');

    if (input.hit('ArrowUp')) this.assignCountryFor.cursor = (this.assignCountryFor.cursor + SCOUT_COUNTRIES.length - 1) % SCOUT_COUNTRIES.length;
    if (input.hit('ArrowDown')) this.assignCountryFor.cursor = (this.assignCountryFor.cursor + 1) % SCOUT_COUNTRIES.length;
    if (input.hit('Enter') || input.hit(' ')) {
      const c = SCOUT_COUNTRIES[this.assignCountryFor.cursor];
      player.scoutStaff.assignCountry(this.assignCountryFor.scoutId, c.code, player.seasonClock.weekIndex);
      player.save();
      this.assignCountryFor = null;
    }
    if (input.hit('Escape')) { this.assignCountryFor = null; input.pressed.Escape = false; }
  }

  // ============================= PANTEÓN =============================
  // las generaciones pasadas de cada hueco (AbueloState.legacy ya las
  // guardaba desde hace versiones, pero no se veían en ningún sitio), la
  // herencia/deuda de la generación actual, y el libro de récords del club.
  _recordsSummary() {
    const { player } = this.game;
    let bestStreak = 0, totalGen = 0;
    for (const id of player.roster.ids) {
      const s = player.roster.get(id);
      totalGen += s.gen;
      bestStreak = Math.max(bestStreak, s.career.bestStreak);
      for (const leg of s.legacy) bestStreak = Math.max(bestStreak, leg.bestStreak || 0);
    }
    return { bestStreak, totalGen };
  }

  _drawPanteon() {
    const { screen, input, player } = this.game;
    const ids = player.roster.ids;
    screen.textCenter(8, 'generaciones que han pasado por cada hueco de la peña, y lo que queda para el recuerdo', '#8a7f66');

    if (!ids.length) {
      screen.text(TABLE_X, 12, 'Aún no tienes a nadie en la peña.', '#8a8a7a');
      return;
    }
    if (!ids.includes(this.panteonCursor)) this.panteonCursor = ids[0];

    const leftX = 4, leftY = 10, leftW = 40, leftH = 24;
    screen.box(leftX, leftY, leftW, leftH, '#8a7f66');
    screen.text(leftX + 2, leftY, ' HUECOS DE LA PEÑA ', '#ffb347');
    ids.forEach((id, i) => {
      const y = leftY + 2 + i * 2;
      if (y > leftY + leftH - 2) return;
      const s = player.roster.get(id);
      const sel = id === this.panteonCursor;
      screen.text(leftX + 2, y, `${sel ? '▶' : ' '} ${this.game.displayName(id)}`, sel ? '#fff' : '#c9c2a8');
      screen.text(leftX + 2, y + 1, `  gen. ${s.gen + 1}ª  ·  ${s.legacy.length} antecesor${s.legacy.length === 1 ? '' : 'es'}`, '#8a7f66');
    });
    screen.text(leftX + 2, leftY + leftH - 1, '[↑/↓] elegir hueco', '#8a7f66');

    const rightX = leftX + leftW + 4, rightY = leftY, rightW = 130 - leftW - 4, rightH = leftH;
    screen.box(rightX, rightY, rightW, rightH, '#8a7f66');
    const id = this.panteonCursor;
    const s = player.roster.get(id);
    screen.text(rightX + 2, rightY, ` ${this.game.displayName(id).toUpperCase()} — GENERACIÓN ACTUAL (${s.gen + 1}ª) `, '#ffe680');
    let yy = rightY + 2;
    screen.text(rightX + 2, yy, `${s.career.wins}V ${s.career.losses}D  ·  racha máxima ${s.career.bestStreak}`, '#c9c2a8'); yy++;
    if (s.inherited) {
      const label = s.inherited.clima
        ? `le afecta menos la ${CLIMAS[s.inherited.clima].label.toLowerCase()} — ha salido a su abuelo`
        : `heredó ${STAT_LABEL[s.inherited.stat].toLowerCase()} de familia`;
      screen.text(rightX + 2, yy, `herencia: ${label}`, '#a8e8c8'); yy++;
    }
    if (s.debt) { screen.text(rightX + 2, yy, `⚔ cuenta pendiente con ${s.debt.label}`, '#ff8c5b'); yy++; }
    yy++;
    if (!s.legacy.length) {
      screen.text(rightX + 2, yy, 'Primera generación en este hueco: aún no hay antecesores que contar.', '#8a8a7a');
    } else {
      screen.text(rightX + 2, yy, 'GENERACIONES ANTERIORES:', '#ffb347'); yy++;
      for (const leg of s.legacy.slice().reverse()) {
        if (yy > rightY + rightH - 2) break;
        const reasonTxt = leg.reason === 'fallecimiento' ? 'falleció' : 'se retiró con honores';
        const legName = leg.name || this.game.faces[id].name;
        screen.text(rightX + 2, yy, `${leg.gen + 1}ª gen. — ${legName}, ${reasonTxt} a los ${leg.age} años (${leg.wins}V ${leg.losses}D, racha ${leg.bestStreak})`, '#c9b98a');
        yy++;
      }
    }

    const recX = 4, recY = leftY + leftH + 2, recW = 130, recH = 8;
    screen.box(recX, recY, recW, recH, '#8a7f66');
    screen.text(recX + 2, recY, ' LIBRO DE RÉCORDS DEL CLUB ', '#ffb347');
    const rec = this._recordsSummary();
    const bmw = player.bestMarginWin;
    screen.text(recX + 2, recY + 2, `mayor paliza dada: ${bmw ? `${bmw.margin} puntos de diferencia vs ${bmw.rival} (${bmw.cityName})` : '—'}`, '#c9c2a8');
    screen.text(recX + 2, recY + 3, `racha histórica: ${rec.bestStreak || '—'}`, '#c9c2a8');
    screen.text(recX + 2, recY + 4, `títulos de liga: ${player.seasonTitles}  ·  Copas de España: ${player.cupTitles}  ·  campanadas europeas: ${player.euroUpsets}`, '#c9c2a8');
    screen.text(recX + 2, recY + 5, `generaciones que han pasado por la peña: ${rec.totalGen || '—'}`, '#c9c2a8');

    if (input.hit('ArrowUp')) { const i = ids.indexOf(this.panteonCursor); this.panteonCursor = ids[(i + ids.length - 1) % ids.length]; }
    if (input.hit('ArrowDown')) { const i = ids.indexOf(this.panteonCursor); this.panteonCursor = ids[(i + 1) % ids.length]; }
  }
}
