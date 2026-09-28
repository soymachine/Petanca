// Buffer de caracteres + colores (+ fondo y brillo por celda) y
// primitivas de dibujo ASCII. No dibuja nada por sí mismo: render() lo
// delega en el renderer enganchado (core/CanvasRenderer.js en el
// navegador; en los tests headless no hay ninguno y render() no hace nada).
import { clamp } from './utils.js';

const BOX_FILL = '#10151f'; // = UI.panel de ui/theme.js

export class Screen {
  constructor(el, cols, rows) {
    this.el = el;
    this.cols = cols;
    this.rows = rows;
    this.chars = new Array(rows * cols);
    this.colors = new Array(rows * cols);
    this.bgs = new Array(rows * cols).fill(null);   // fondo por celda (null = transparente)
    this.glows = new Array(rows * cols).fill(null); // true | color de resplandor
    // dibujo libre en píxeles por debajo/encima del texto: fn(ctx, renderer),
    // se vacían en cada render (hay que volver a pedirlas cada frame)
    this.layersUnder = [];
    this.layersOver = [];
    this.renderer = null;
  }

  clear(fg) {
    const n = this.rows * this.cols;
    for (let i = 0; i < n; i++) { this.chars[i] = ' '; this.colors[i] = fg || '#556'; this.bgs[i] = null; this.glows[i] = null; }
  }

  // bg (opcional): fondo de la celda; sin él, el fondo que hubiera se
  // conserva (texto encima de un panel ya rellenado con fill)
  put(x, y, ch, color, bg) {
    x |= 0; y |= 0;
    if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) return;
    const i = y * this.cols + x;
    this.chars[i] = ch;
    this.colors[i] = color;
    if (bg !== undefined) this.bgs[i] = bg;
  }

  // rellena el fondo de un rectángulo de celdas (sin tocar el texto)
  fill(x, y, w, h, bg) {
    for (let r = Math.max(0, y | 0); r < Math.min(this.rows, (y | 0) + h); r++) {
      for (let c = Math.max(0, x | 0); c < Math.min(this.cols, (x | 0) + w); c++) this.bgs[r * this.cols + c] = bg;
    }
  }

  // resplandor en un rectángulo de celdas (true = del color del texto)
  glow(x, y, w, h, color = true) {
    for (let r = Math.max(0, y | 0); r < Math.min(this.rows, (y | 0) + h); r++) {
      for (let c = Math.max(0, x | 0); c < Math.min(this.cols, (x | 0) + w); c++) this.glows[r * this.cols + c] = color;
    }
  }

  // capa de píxeles libre, por debajo ('under') o encima ('over') del texto
  layer(kind, fn) { (kind === 'under' ? this.layersUnder : this.layersOver).push(fn); }

  text(x, y, str, color) {
    for (let i = 0; i < str.length; i++) this.put(x + i, y, str[i], color);
  }

  textCenter(y, str, color) {
    this.text(Math.floor((this.cols - str.length) / 2), y, str, color);
  }

  // arte multilínea; los espacios son transparentes (no pintan)
  block(x, y, lines, color) {
    for (let r = 0; r < lines.length; r++) {
      const line = lines[r];
      for (let c = 0; c < line.length; c++) {
        if (line[c] !== ' ') this.put(x + c, y + r, line[c], color);
      }
    }
  }

  // marco con relleno de panel (fill = null para solo el marco): así todas
  // las pantallas ganan aspecto de tarjeta sin tocarlas una a una
  box(x, y, w, h, color, style, fill = BOX_FILL) {
    if (fill) this.fill(x, y, w, h, fill);
    const S = style === 'double'
      ? { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║' }
      : { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│' };
    for (let i = 1; i < w - 1; i++) { this.put(x + i, y, S.h, color); this.put(x + i, y + h - 1, S.h, color); }
    for (let i = 1; i < h - 1; i++) { this.put(x, y + i, S.v, color); this.put(x + w - 1, y + i, S.v, color); }
    this.put(x, y, S.tl, color); this.put(x + w - 1, y, S.tr, color);
    this.put(x, y + h - 1, S.bl, color); this.put(x + w - 1, y + h - 1, S.br, color);
  }

  // arte fotográfico ASCII indexado a paleta (ver src/data/art)
  drawPhotoArt(art, x, y) {
    for (let r = 0; r < art.rows; r++) {
      const line = art.chars[r], idx = art.colorIdx[r];
      for (let c = 0; c < art.cols; c++) {
        if (line[c] !== ' ') this.put(x + c, y + r, line[c], art.palette[idx[c]]);
      }
    }
  }

  // arte fotográfico reescalado (muestreo del vecino más cercano): no hay
  // ningún activo pre-generado a un tamaño intermedio (solo la foto
  // completa y una miniatura mucho más pequeña, "mini"), así que para un
  // tamaño arbitrario (p.ej. la vista de detalle de un abuelo, ~80% del
  // original) hace falta reescalar sobre la marcha en vez de dibujar un
  // activo ya hecho a ese tamaño
  drawPhotoArtScaled(art, x, y, scale) {
    const newCols = Math.max(1, Math.round(art.cols * scale));
    const newRows = Math.max(1, Math.round(art.rows * scale));
    for (let r = 0; r < newRows; r++) {
      const sr = Math.min(art.rows - 1, Math.floor(r / scale));
      const line = art.chars[sr], idx = art.colorIdx[sr];
      for (let c = 0; c < newCols; c++) {
        const sc = Math.min(art.cols - 1, Math.floor(c / scale));
        if (line[sc] !== ' ') this.put(x + c, y + r, line[sc], art.palette[idx[sc]]);
      }
    }
  }

  // retrato procedural por capas (ver PortraitGenerator): cada capa se
  // dibuja encima de la anterior, dejando huecos en los espacios en blanco
  drawPortrait(portrait, x, y) {
    for (const [color, lines] of portrait.layers) this.block(x, y, lines, color);
  }

  // dibuja un retrato sin importar su formato: fotográfico (nuevo, {cols,
  // rows, chars, colorIdx}) o el antiguo por capas ({layers}) que puede
  // seguir apareciendo en partidas guardadas antes del cambio a fotos reales
  drawAnyPortrait(art, x, y) {
    if (!art) return;
    if (art.layers) this.drawPortrait(art, x, y);
    else this.drawPhotoArt(art, x, y);
  }

  // pinta ch/color en (x,y) solo si cae dentro del rectángulo de recorte
  // (x0,y0,w,h); usado por drawList para clipar filas que exceden su caja
  putClipped(x, y, ch, color, x0, y0, w, h) {
    if (x < x0 || x >= x0 + w || y < y0 || y >= y0 + h) return;
    this.put(x, y, ch, color);
  }

  // Lista con recorte vertical y scroll. `items` es el array completo,
  // `rowH` la altura en filas de cada item, `scrollOffset` el índice del
  // primer item visible (clampeado internamente). `rowRenderer(item, index,
  // x, y)` dibuja un item ya posicionado; sus put() deben pasar por
  // putClipped si pueden salirse del recuadro (normalmente basta con no
  // dibujar fuera de [y, y+h)). Devuelve { maxOffset, offset } tras
  // clampear, para que el caller persista el scroll real usado.
  drawList(x, y, w, h, items, rowH, rowRenderer, scrollOffset) {
    const visibleRows = Math.max(1, Math.floor(h / rowH));
    const maxOffset = Math.max(0, items.length - visibleRows);
    const offset = clamp(Math.round(scrollOffset || 0), 0, maxOffset);
    const n = Math.min(visibleRows, items.length - offset);
    for (let i = 0; i < n; i++) {
      const item = items[offset + i];
      rowRenderer(item, offset + i, x, y + i * rowH);
    }
    if (maxOffset > 0) {
      const trackX = x + w - 1;
      this.put(trackX, y, offset > 0 ? '▲' : '│', '#8fa08f');
      this.put(trackX, y + visibleRows - 1, offset < maxOffset ? '▼' : '│', '#8fa08f');
      const trackH = Math.max(1, visibleRows - 2);
      if (trackH > 0) {
        const thumbY = 1 + Math.round((offset / maxOffset) * (trackH - 1));
        for (let i = 0; i < trackH; i++) {
          this.put(trackX, y + 1 + i, i === thumbY ? '█' : '┊', i === thumbY ? '#cde0cd' : '#3a4a3a');
        }
      }
    }
    return { maxOffset, offset };
  }

  render() {
    if (this.renderer) this.renderer.render();
    else { this.layersUnder.length = 0; this.layersOver.length = 0; }
  }
}
