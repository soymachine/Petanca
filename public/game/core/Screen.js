// Buffer de caracteres + colores y primitivas de dibujo ASCII.
// Responsabilidad única: convertir (x,y,char,color) en el <pre> del DOM.
import { clamp } from './utils.js';

export class Screen {
  constructor(el, cols, rows) {
    this.el = el;
    this.cols = cols;
    this.rows = rows;
    this.chars = new Array(rows * cols);
    this.colors = new Array(rows * cols);
  }

  clear(bg) {
    const n = this.rows * this.cols;
    for (let i = 0; i < n; i++) { this.chars[i] = ' '; this.colors[i] = bg || '#556'; }
  }

  put(x, y, ch, color) {
    x |= 0; y |= 0;
    if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) return;
    const i = y * this.cols + x;
    this.chars[i] = ch;
    this.colors[i] = color;
  }

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

  box(x, y, w, h, color, style) {
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
    let html = '';
    for (let y = 0; y < this.rows; y++) {
      let runColor = null, run = '';
      for (let x = 0; x < this.cols; x++) {
        const i = y * this.cols + x;
        const col = this.colors[i];
        if (col !== runColor) {
          if (run) html += `<span style="color:${runColor}">${escapeHtml(run)}</span>`;
          run = ''; runColor = col;
        }
        run += this.chars[i];
      }
      if (run) html += `<span style="color:${runColor}">${escapeHtml(run)}</span>`;
      html += '\n';
    }
    this.el.innerHTML = html;
  }
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
