import { TabsBar } from './TabsBar.js';
import { wrapText, mulberry32, hashStr, clamp } from '../core/utils.js';

const PAGE_X = 5, PAGE_Y = 4, PAGE_W = 130, PAGE_H = 39;
const FILLER = ['▓', '▓', '▒', '░'];

// Tipografía de bloque para la cabecera del periódico, como el nombre de
// un diario de verdad. Cada glifo es 5 filas de alto (Ñ usa una fila extra
// arriba para la virgulilla, con dy=-1 para no desplazar la línea base).
const BIG_FONT = {
  E: ['█████', '█····', '████·', '█····', '█████'],
  L: ['█····', '█····', '█····', '█····', '█████'],
  C: ['·████', '█····', '█····', '█····', '·████'],
  O: ['·███·', '█···█', '█···█', '█···█', '·███·'],
  D: ['████·', '█···█', '█···█', '█···█', '████·'],
  A: ['·███·', '█···█', '█████', '█···█', '█···█'],
  P: ['████·', '█···█', '████·', '█····', '█····'],
  Ñ: { dy: -1, lines: ['·~~··', '█···█', '██··█', '█·█·█', '█··██', '█···█'] },
};
const BIG_GLYPH_W = 5, BIG_GLYPH_GAP = 1, BIG_SPACE_W = 4;

// Hemeroteca como periódico de verdad: cada titular real de la peña ocupa
// una portada entera, mezclado entre columnas de "texto" ilegible (relleno)
// para que solo lo que de verdad pasó sea legible — y en un sitio distinto
// de la página en cada edición, como si tocara buscarlo. Se pasa página
// con flechas, como quien hojea un diario viejo.
export class HemerotecaScreen {
  constructor(game) { this.game = game; this.page = 0; this.mode = 'normal'; this.annalScroll = 0; }

  draw() {
    const { screen, input, player, frame } = this.game;
    screen.clear();
    TabsBar.draw(this.game, 'hemeroteca');

    if (input.hit('h') || input.hit('H')) {
      this.mode = this.mode === 'normal' ? 'historica' : 'normal';
      this.annalScroll = 0;
    }
    if (this.mode === 'historica') { this._drawHistorica(); return; }

    const news = player.news.latest(30);
    if (this.page >= news.length) this.page = Math.max(0, news.length - 1);

    screen.box(PAGE_X - 1, PAGE_Y - 1, PAGE_W + 2, PAGE_H + 2, '#c9a35d');
    this._fillPaper();

    const edition = news.length ? news.length - this.page : 0;
    this._drawBigTextCenter(PAGE_Y + 1, 'EL ECO DE LA PEÑA', '#e8ddb8');
    screen.textCenter(PAGE_Y + 7, player.seasonClock.dateLabel().toUpperCase(), '#c9a35d');
    screen.textCenter(PAGE_Y + 8, `— Edición Nº ${edition || '0'} · ${player.clubName} —`, '#8a7f66');
    screen.text(PAGE_X + 1, PAGE_Y + 9, '─'.repeat(PAGE_W - 2), '#8a7f66');

    if (!news.length) {
      screen.textCenter(PAGE_Y + 20, 'Aún no hay titulares. Juega tu primer partido de liga.', '#8a8a7a');
    } else {
      this._drawFillerColumns(news[this.page]);
    }

    const canPrev = this.page < news.length - 1;
    const canNext = this.page > 0;
    screen.text(PAGE_X + 2, PAGE_Y + PAGE_H - 1, canPrev && frame % 20 < 14 ? '◀ [←] más antigua' : '', canPrev ? '#ffe680' : '#3a352c');
    screen.textCenter(PAGE_Y + PAGE_H - 1, news.length ? `pág. ${this.page + 1} / ${news.length}` : '', '#8a7f66');
    const nextLabel = 'más reciente [→] ▶';
    screen.text(PAGE_X + PAGE_W - 2 - nextLabel.length, PAGE_Y + PAGE_H - 1, canNext && frame % 20 < 14 ? nextLabel : '', canNext ? '#ffe680' : '#3a352c');

    screen.textCenter(45, '[←/→] pasar página   [H] anales del club   [1] inicio', '#c9c2a8');

    if (input.hit('ArrowLeft') && canPrev) this.page++;
    if (input.hit('ArrowRight') && canNext) this.page--;
  }

  // "ANALES DEL CLUB": a diferencia de la hemeroteca normal (un titular
  // escondido entre ruido por página, que se pierde tras 30 ediciones),
  // esto es Player.annals — permanente y sin podar. Se listan en legible
  // de verdad, sin el gimmick de "buscar el titular", porque estos hitos
  // están para encontrarse a la primera, no para rebuscarlos.
  _drawHistorica() {
    const { screen, input, player } = this.game;
    screen.box(PAGE_X - 1, PAGE_Y - 1, PAGE_W + 2, PAGE_H + 2, '#c9a35d');
    this._fillPaper();
    this._drawBigTextCenter(PAGE_Y + 1, 'ANALES DEL CLUB', '#ffe14d');
    screen.textCenter(PAGE_Y + 7, `${player.clubName.toUpperCase()} — LOS HITOS QUE NO SE OLVIDAN`, '#c9a35d');
    screen.text(PAGE_X + 1, PAGE_Y + 8, '─'.repeat(PAGE_W - 2), '#8a7f66');

    const annals = player.annals.slice().reverse(); // más reciente primero
    const listY = PAGE_Y + 10, listBottom = PAGE_Y + PAGE_H - 3;
    if (!annals.length) {
      screen.textCenter(listY + 4, 'Todavía no hay hitos que contar.', '#8a8a7a');
      screen.textCenter(listY + 5, 'Los títulos, ascensos y campanadas quedarán aquí para siempre.', '#8a8a7a');
    } else {
      this.annalScroll = clamp(this.annalScroll, 0, Math.max(0, annals.length - 1));
      let y = listY;
      for (let i = this.annalScroll; i < annals.length; i++) {
        const a = annals[i];
        const lines = wrapText(a.text, PAGE_W - 8);
        const blockH = 1 + lines.length + 1;
        if (y + blockH > listBottom) break;
        screen.text(PAGE_X + 3, y, a.dateLabel.toUpperCase(), '#8a7f66');
        lines.forEach((l, k) => screen.text(PAGE_X + 3, y + 1 + k, l, '#fff6dc'));
        y += blockH;
      }
      if (input.hit('ArrowDown')) this.annalScroll = Math.min(annals.length - 1, this.annalScroll + 1);
      if (input.hit('ArrowUp')) this.annalScroll = Math.max(0, this.annalScroll - 1);
    }

    screen.textCenter(PAGE_Y + PAGE_H - 1, `${annals.length} hito${annals.length === 1 ? '' : 's'} en la historia del club`, '#8a7f66');
    screen.textCenter(45, '[↑/↓] desplazar   [H] volver a la hemeroteca   [1] inicio', '#c9c2a8');
  }

  _fillPaper() {
    const { screen } = this.game;
    for (let r = 0; r < PAGE_H; r++) for (let c = 0; c < PAGE_W; c++) screen.put(PAGE_X + c, PAGE_Y + r, ' ', '#151310');
  }

  _bigTextWidth(str) {
    let w = 0;
    for (const ch of str) w += ch === ' ' ? BIG_SPACE_W : BIG_GLYPH_W + BIG_GLYPH_GAP;
    return w - BIG_GLYPH_GAP;
  }

  _drawBigTextCenter(y, str, color) {
    const { screen } = this.game;
    let x = PAGE_X + Math.floor((PAGE_W - this._bigTextWidth(str)) / 2);
    for (const ch of str) {
      if (ch === ' ') { x += BIG_SPACE_W; continue; }
      const glyph = BIG_FONT[ch];
      if (!glyph) { x += BIG_GLYPH_W + BIG_GLYPH_GAP; continue; }
      const dy = glyph.dy || 0;
      const lines = glyph.lines || glyph;
      screen.block(x, y + dy, lines, color);
      x += BIG_GLYPH_W + BIG_GLYPH_GAP;
    }
  }

  // columnas de texto de relleno, ilegibles a propósito, con el titular de
  // verdad camuflado como uno de los párrafos: densidad de bloque y sitio
  // del titular deterministas por página (no cambian entre frames, sí
  // entre ediciones) usando un RNG con semilla — "cuadrados negros"
  // simulando letra, salvo el único párrafo que sí se puede leer
  _drawFillerColumns(headlineText) {
    const { screen } = this.game;
    const topY = PAGE_Y + 11;
    const bottomY = PAGE_Y + PAGE_H - 3;
    const colW = 28, gap = 3, cols = 4;
    const startX = PAGE_X + Math.floor((PAGE_W - (colW * cols + gap * (cols - 1))) / 2);
    const rng = mulberry32(hashStr(`hemeroteca-${this.page}`));

    // un renglón en blanco antes y después del titular, para que no quede
    // pegado al relleno como si fuera un párrafo más cualquiera
    const headlineLines = wrapText(headlineText, colW - 2);
    const headlineBlock = headlineLines.length + 2;
    const targetCol = Math.floor(rng() * cols);
    const span = Math.max(1, bottomY - headlineBlock - topY);
    const targetY = topY + Math.floor(rng() * span);
    const headlineEnd = targetY + headlineBlock;

    for (let ci = 0; ci < cols; ci++) {
      const cx = startX + ci * (colW + gap);
      const isTargetCol = ci === targetCol;
      let y = topY, hiIndex = 0;
      while (y < bottomY) {
        if (isTargetCol && y >= targetY && y < headlineEnd) {
          if (y > targetY && y < headlineEnd - 1) {
            screen.text(cx, y, headlineLines[hiIndex], '#fff6dc');
            hiIndex++;
          }
          y++; continue;
        }
        if (rng() < 0.14) { y += 1; continue; } // hueco de "párrafo"
        const w = Math.round(colW * (0.55 + rng() * 0.4));
        let line = '';
        for (let i = 0; i < w; i++) line += FILLER[Math.floor(rng() * FILLER.length)];
        const shade = rng() < 0.5 ? '#2a271f' : '#211e18';
        screen.text(cx, y, line, shade);
        y++;
      }
    }
  }
}
