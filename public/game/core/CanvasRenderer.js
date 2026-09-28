// Renderer Neo-ASCII: pinta el buffer de Screen (chars/colors/bgs) en un
// <canvas> que ocupa TODA la ventana. La rejilla lógica sigue siendo de
// cols×rows celdas (las pantallas no cambian), pero se escala al tamaño
// real de la pantalla conservando la proporción de celda, con
// devicePixelRatio. El margen que sobra no es negro: fondo ambiental.
//
// Los glifos de bloque (█▀▄▌▐▖…░▒▓) y de caja (─│┌═║╔…) se dibujan por
// código, no con la fuente: así encajan sin huecos entre celdas a
// cualquier tamaño (con la fuente dependen del interlineado). El resto
// de caracteres se centra en su celda.
//
// Capas por frame, en orden: fondo ambiental → fondos de celda → capas
// 'under' (callbacks de las pantallas, p.ej. la pista en perspectiva) →
// texto → capas 'over' → FX (partículas, rótulos) → resplandor →
// líneas CRT → cursor. Ver docs/REDISENO.md, Fase 1.
import { Settings } from './Settings.js';

const FONT_STACK = '"Menlo", "Consolas", "DejaVu Sans Mono", "Liberation Mono", monospace';
const CELL_ASPECT = 0.56; // ancho/alto de una celda
const BASE_BG = '#0b0e14';

// brazos de las líneas de caja: [arriba, derecha, abajo, izquierda],
// 1 = fina, 2 = gruesa, 3 = doble
const BOX = {
  '─': [0, 1, 0, 1], '│': [1, 0, 1, 0], '┌': [0, 1, 1, 0], '┐': [0, 0, 1, 1], '└': [1, 1, 0, 0], '┘': [1, 0, 0, 1],
  '├': [1, 1, 1, 0], '┤': [1, 0, 1, 1], '┬': [0, 1, 1, 1], '┴': [1, 1, 0, 1], '┼': [1, 1, 1, 1],
  '━': [0, 2, 0, 2], '┃': [2, 0, 2, 0],
  '═': [0, 3, 0, 3], '║': [3, 0, 3, 0], '╔': [0, 3, 3, 0], '╗': [0, 0, 3, 3], '╚': [3, 3, 0, 0], '╝': [3, 0, 0, 3],
  '╠': [3, 3, 3, 0], '╣': [3, 0, 3, 3], '╦': [0, 3, 3, 3], '╩': [3, 3, 0, 3], '╬': [3, 3, 3, 3],
};

// bloques: rectángulos en fracciones de celda [x0, y0, x1, y1]
const BLOCK = {
  '█': [[0, 0, 1, 1]], '▀': [[0, 0, 1, 0.5]], '▄': [[0, 0.5, 1, 1]], '▌': [[0, 0, 0.5, 1]], '▐': [[0.5, 0, 1, 1]],
  '▖': [[0, 0.5, 0.5, 1]], '▗': [[0.5, 0.5, 1, 1]], '▘': [[0, 0, 0.5, 0.5]], '▝': [[0.5, 0, 1, 0.5]],
  '▁': [[0, 7 / 8, 1, 1]], '▂': [[0, 6 / 8, 1, 1]], '▃': [[0, 5 / 8, 1, 1]], '▅': [[0, 3 / 8, 1, 1]],
  '▆': [[0, 2 / 8, 1, 1]], '▇': [[0, 1 / 8, 1, 1]], '▏': [[0, 0, 1 / 8, 1]], '▕': [[7 / 8, 0, 1, 1]],
  '▎': [[0, 0, 2 / 8, 1]], '▍': [[0, 0, 3 / 8, 1]], '▋': [[0, 0, 5 / 8, 1]], '▊': [[0, 0, 6 / 8, 1]], '▉': [[0, 0, 7 / 8, 1]],
};
const SHADE = { '░': 0.25, '▒': 0.5, '▓': 0.75 };

export class CanvasRenderer {
  constructor(canvas, screen) {
    this.canvas = canvas;
    this.screen = screen;
    this.ctx = canvas.getContext('2d');
    this.fx = null; // core/Fx.js, lo engancha Game
    this.cursor = null; // { fx, fy } en celdas (fraccionarias), lo pone Input
    this.frame = 0;
    this._bloom = document.createElement('canvas');
    this._bloomCtx = this._bloom.getContext('2d');
    screen.renderer = this;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  // --- geometría ---
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const W = Math.round(window.innerWidth * dpr), H = Math.round(window.innerHeight * dpr);
    this.dpr = dpr;
    this.canvas.width = W; this.canvas.height = H;
    this.canvas.style.width = `${window.innerWidth}px`;
    this.canvas.style.height = `${window.innerHeight}px`;
    const { cols, rows } = this.screen;
    // celdas de tamaño ENTERO en píxeles de dispositivo: todas iguales, sin
    // redondeos por celda (los glifos cacheados encajan al píxel)
    const ch = Math.max(4, Math.floor(Math.min(H / rows, W / (cols * CELL_ASPECT))));
    const cw = Math.max(2, Math.floor(ch * CELL_ASPECT));
    // tamaño de fuente: que su avance llene ~94% del ancho de celda (si no,
    // el texto sale "espaciado"), sin pasar del 92% del alto
    const ctx = this.ctx;
    ctx.font = `100px ${FONT_STACK}`;
    const advRatio = ctx.measureText('M').width / 100;
    const fontPx = Math.min((cw * 0.94) / advRatio, ch * 0.92);
    this.cw = cw; this.ch = ch; this.fontPx = fontPx;
    this.ox = Math.floor((W - cols * cw) / 2); this.oy = Math.floor((H - rows * ch) / 2);
    this._glyphs = new Map(); // caché de glifos: se invalida al cambiar el tamaño de celda
    this.W = W; this.H = H;
    this.font = `${fontPx}px ${FONT_STACK}`;
    this.fontFamily = FONT_STACK;
    this.screenRows = rows;
    this._bloom.width = Math.max(1, Math.round(W / 8)); this._bloom.height = Math.max(1, Math.round(H / 8));
    this._bloomFrame = -1;
    this.bloomAutoOff = false; this._avgMs = undefined; this._samples = 0;
    // capa persistente de fondos de celda + texto: solo se repintan las
    // celdas que cambian entre frames (ver _drawText)
    this._textLayer = document.createElement('canvas');
    this._textLayer.width = cols * cw; this._textLayer.height = rows * ch;
    this._textCtx = this._textLayer.getContext('2d');
    this._prevKeys = new Array(cols * rows).fill(null);
    this._ambient = this._makeAmbient();
    this._scan = this._makeScanlines();
  }

  // copia del último frame pintado (para la transición entre pantallas)
  snapshot() {
    const c = document.createElement('canvas');
    c.width = this.W; c.height = this.H;
    c.getContext('2d').drawImage(this.canvas, 0, 0);
    return c;
  }

  // píxel de dispositivo del borde izquierdo/superior de una celda
  // (acepta celdas fraccionarias para dibujo libre en las capas)
  cx(c) { return Math.round(this.ox + c * this.cw); }
  cy(r) { return Math.round(this.oy + r * this.ch); }

  // coordenadas de ventana (CSS px) → celdas fraccionarias
  clientToCell(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    const px = (clientX - r.left) * this.dpr, py = (clientY - r.top) * this.dpr;
    return { fx: (px - this.ox) / this.cw, fy: (py - this.oy) / this.ch };
  }

  // --- fondos precalculados ---
  _makeAmbient() {
    const c = document.createElement('canvas');
    c.width = this.W; c.height = this.H;
    const g = c.getContext('2d');
    g.fillStyle = BASE_BG; g.fillRect(0, 0, c.width, c.height);
    const rg = g.createRadialGradient(c.width / 2, c.height * 0.45, 0, c.width / 2, c.height / 2, Math.max(c.width, c.height) * 0.75);
    rg.addColorStop(0, 'rgba(60,50,30,0.22)');
    rg.addColorStop(0.55, 'rgba(20,24,34,0.10)');
    rg.addColorStop(1, 'rgba(0,0,0,0.55)');
    g.fillStyle = rg; g.fillRect(0, 0, c.width, c.height);
    return c;
  }

  _makeScanlines() {
    const c = document.createElement('canvas');
    const step = Math.max(2, Math.round(this.ch / 5));
    c.width = 8; c.height = step * 2;
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(0,0,0,0.09)';
    g.fillRect(0, 0, 8, Math.max(1, Math.round(step * 0.6)));
    return this.ctx.createPattern(c, 'repeat');
  }

  // --- dibujo ---
  render() {
    const { ctx, screen } = this;
    this.frame++;
    const tStart = performance.now();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(this._ambient, 0, 0);
    this._drawMarginDust();

    const shake = this.fx ? this.fx.shakeOffset() : { x: 0, y: 0 };
    ctx.save();
    ctx.translate(Math.round(shake.x * this.cw), Math.round(shake.y * this.ch));

    // panel de fondo de la rejilla: un tono apenas más claro que el margen
    ctx.fillStyle = 'rgba(12,15,22,0.92)';
    ctx.fillRect(this.cx(0), this.cy(0), this.cx(screen.cols) - this.cx(0), this.cy(screen.rows) - this.cy(0));

    for (const fn of screen.layersUnder) fn(ctx, this);
    this._updateTextLayer();
    ctx.drawImage(this._textLayer, this.ox, this.oy);
    this._drawGlows();
    for (const fn of screen.layersOver) fn(ctx, this);
    if (this.fx) this.fx.draw(ctx, this);
    ctx.restore();

    if (Settings.get('bloom') && !this.bloomAutoOff) this._drawBloom();
    if (Settings.get('scanlines')) { ctx.fillStyle = this._scan; ctx.fillRect(0, 0, this.W, this.H); }
    if (this.fx) this.fx.drawOverlay(ctx, this);
    this._drawCursor();

    screen.layersUnder.length = 0;
    screen.layersOver.length = 0;
    this._autoQuality(performance.now() - tStart);
  }

  // calidad automática: si con el resplandor activo el render medio pasa
  // de ~14 ms (equipo sin aceleración gráfica), se apaga el resplandor en
  // esta sesión sin tocar el ajuste guardado. Se vuelve a medir tras un
  // cambio de tamaño de ventana.
  _autoQuality(ms) {
    if (this.bloomAutoOff || !Settings.get('bloom')) return;
    this._avgMs = this._avgMs === undefined ? ms : this._avgMs * 0.95 + ms * 0.05;
    if (++this._samples > 90 && this._avgMs > 14) this.bloomAutoOff = true;
  }

  _drawMarginDust() {
    // polvo de tiza a la deriva en los márgenes (solo donde no hay rejilla)
    const { ctx } = this;
    const gx0 = this.cx(0), gx1 = this.cx(this.screen.cols), gy0 = this.cy(0), gy1 = this.cy(this.screen.rows);
    if (gx0 < 8 && gy0 < 8) return;
    ctx.fillStyle = 'rgba(200,180,130,0.07)';
    const t = this.frame * 0.15;
    for (let i = 0; i < 60; i++) {
      const x = ((i * 977 + t * (1 + (i % 5))) % this.W);
      const y = ((i * 613 + Math.sin(t * 0.02 + i) * 40) % this.H + this.H) % this.H;
      if (x > gx0 && x < gx1 && y > gy0 && y < gy1) continue;
      const s = (1 + (i % 3)) * this.dpr;
      ctx.fillRect(x, y, s, s);
    }
  }

  // Repinta en la capa persistente solo las celdas cuya clave (carácter +
  // color + fondo) cambió desde el frame anterior. En un menú quieto eso
  // son un puñado de celdas (parpadeos); en el partido, las partículas.
  _updateTextLayer() {
    const t = this._textCtx;
    const { screen, cw, ch } = this;
    const { cols, rows, chars, colors, bgs } = screen;
    const prev = this._prevKeys;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        let g = chars[i];
        if (g === undefined) g = ' ';
        const code = g.charCodeAt(0);
        let span = 1;
        if (code >= 0xd800 && code <= 0xdbff) { g += chars[i + 1] || ''; span = 2; }
        const lowHalf = code >= 0xdc00 && code <= 0xdfff;
        const col = colors[i] || '#556';
        const bg = bgs[i];
        const phase = SHADE[g] !== undefined ? ((c + r) & 1) + 2 * (r & 1) : 0;
        // borde de panel con fondo: el trazo pasa por el CENTRO de la celda,
        // así que solo se rellena el lado que da al interior (el vecino con
        // el mismo fondo) — si no, el relleno asoma media celda por fuera
        let bgMask = 15;
        if (bg && BOX[g]) {
          bgMask = (c > 0 && bgs[i - 1] === bg ? 1 : 0) | (c < cols - 1 && bgs[i + 1] === bg ? 2 : 0)
            | (r > 0 && bgs[i - cols] === bg ? 4 : 0) | (r < rows - 1 && bgs[i + cols] === bg ? 8 : 0);
        }
        const key = lowHalf ? `~${bg || ''}` : `${g}\u0001${col}\u0001${bg || ''}\u0001${phase}\u0001${bgMask}`;
        if (key === prev[i]) continue;
        prev[i] = key;
        const x = c * cw, y = r * ch;
        if (lowHalf) {
          // mitad derecha de un emoji: lo pinta la celda de su izquierda
          // (que se marca como sucia para repintar el emoji entero)
          prev[i - 1] = null;
          continue;
        }
        t.clearRect(x, y, cw * span, ch);
        if (bg) {
          t.fillStyle = bg;
          if (bgMask === 15) t.fillRect(x, y, cw * span, ch);
          else {
            const hx = Math.floor(cw / 2), hy = Math.floor(ch / 2);
            const fx0 = bgMask & 1 ? 0 : hx, fx1 = bgMask & 2 ? cw : hx;
            const fy0 = bgMask & 4 ? 0 : hy, fy1 = bgMask & 8 ? ch : hy;
            if (fx1 > fx0 && fy1 > fy0) t.fillRect(x + fx0, y + fy0, fx1 - fx0, fy1 - fy0);
          }
        }
        if (g !== ' ') {
          const img = this._glyph(g, col, null, span, phase);
          t.drawImage(img.canvas, x, y);
        }
        if (span === 2) { prev[i + 1] = `~${bgs[i + 1] || ''}`; c++; }
      }
    }
  }

  // el resplandor desborda la celda: no va en la capa persistente, se
  // dibuja encima cada frame (son pocas celdas)
  _drawGlows() {
    const { ctx, screen, cw, ch } = this;
    const { cols, rows, chars, colors, glows } = screen;
    for (let i = 0; i < glows.length; i++) {
      const glow = glows[i];
      if (!glow) continue;
      const g = chars[i];
      if (!g || g === ' ') continue;
      const c = i % cols, r = (i / cols) | 0;
      const img = this._glyph(g, colors[i] || '#556', glow, 1, 0);
      ctx.drawImage(img.canvas, this.ox + c * cw - img.pad, this.oy + r * ch - img.pad);
    }
  }

  _glyph(g, col, glow, span, phase) {
    const key = `${g}\u0001${col}\u0001${glow || ''}\u0001${phase}`;
    let img = this._glyphs.get(key);
    if (img) return img;
    if (this._glyphs.size > 6000) this._glyphs.clear();
    const { cw, ch } = this;
    const pad = glow ? Math.ceil(ch * 0.7) : 0;
    const canvas = document.createElement('canvas');
    canvas.width = cw * span + pad * 2; canvas.height = ch + pad * 2;
    const x = canvas.getContext('2d');
    x.fillStyle = col; x.strokeStyle = col;
    if (glow) { x.shadowColor = glow === true ? col : glow; x.shadowBlur = ch * 0.55; }
    const x0 = pad, y0 = pad, x1 = pad + cw * span, y1 = pad + ch;
    if (BLOCK[g]) {
      for (const [a, b, d, e] of BLOCK[g]) {
        const bx0 = Math.round(x0 + cw * a), by0 = Math.round(y0 + ch * b);
        x.fillRect(bx0, by0, Math.round(x0 + cw * d) - bx0, Math.round(y0 + ch * e) - by0);
      }
    } else if (SHADE[g] !== undefined) {
      this._drawShade(x, SHADE[g], x0, y0, x1, y1, phase & 1, phase >> 1);
    } else if (BOX[g]) {
      this._drawBox(x, BOX[g], x0, y0, x1, y1);
    } else {
      x.font = this.font;
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText(g, (x0 + x1) / 2, (y0 + y1) / 2 + ch * 0.04);
    }
    img = { canvas, pad };
    this._glyphs.set(key, img);
    return img;
  }

  // ░▒▓ como trama de puntos (no relleno sólido): se lee como textura
  // ASCII y un carácter vecino encima no queda como una "caja" recortada.
  // La trama se desfasa por celda para que no forme rejilla visible.
  _drawShade(ctx, level, x0, y0, x1, y1, c, r) {
    const nx = 2, ny = 4;
    const w = x1 - x0, h = y1 - y0;
    const d = Math.max(1, Math.round(Math.min(w / nx, h / ny) * (0.35 + level * 0.5)));
    const a = ctx.globalAlpha;
    ctx.globalAlpha = 0.55 + level * 0.45;
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        if (level < 0.5 && (i + j + c + r) % 2) continue;
        const px = x0 + ((i + 0.5 + ((j + r) % 2) * 0.5) / nx) * w;
        const py = y0 + ((j + 0.5) / ny) * h;
        ctx.fillRect(Math.round(px - d / 2), Math.round(py - d / 2), d, d);
      }
    }
    ctx.globalAlpha = a;
  }

  // Cada brazo va del centro de la celda a su borde. En las dobles, cada
  // una de las dos líneas empieza: +g (se queda corta) si en su lado hay un
  // brazo perpendicular, 0 si sigue recta al brazo opuesto, o −g (se pasa
  // del centro) si es la línea exterior de una esquina — así ╔╠╬ cierran
  // limpias sin cruces ni huecos.
  _drawBox(ctx, arms, x0, y0, x1, y1) {
    const mx = Math.round((x0 + x1) / 2), my = Math.round((y0 + y1) / 2);
    const t = Math.max(1, Math.round(this.ch * 0.07));
    const g = Math.max(2, Math.round(this.ch * 0.09));
    const [up, right, down, left] = arms;
    // dir: vector unitario del brazo; perp: [brazo del lado −, brazo del lado +]
    const specs = [
      { kind: up, dx: 0, dy: -1, L: my - y0, opp: down, perp: [left, right] },
      { kind: right, dx: 1, dy: 0, L: x1 - mx, opp: left, perp: [up, down] },
      { kind: down, dx: 0, dy: 1, L: y1 - my, opp: up, perp: [left, right] },
      { kind: left, dx: -1, dy: 0, L: mx - x0, opp: right, perp: [up, down] },
    ];
    for (const s of specs) {
      if (!s.kind) continue;
      const w = s.kind === 2 ? t * 2 : t;
      const lines = s.kind === 3 ? [[-g, s.perp[0]], [g, s.perp[1]]] : [[0, null]];
      for (const [o, sideArm] of lines) {
        let s0;
        if (s.kind !== 3) s0 = -w / 2;
        else if (sideArm) s0 = g;
        else if (s.opp) s0 = 0;
        else s0 = -g;
        s0 -= s.kind === 3 ? w / 2 : 0;
        const len = s.L - s0;
        if (s.dx !== 0) {
          const xa = s.dx > 0 ? mx + s0 : mx - s0 - len;
          ctx.fillRect(Math.round(xa), Math.round(my + o - w / 2), Math.round(len), w);
        } else {
          const ya = s.dy > 0 ? my + s0 : my - s0 - len;
          ctx.fillRect(Math.round(mx + o - w / 2), Math.round(ya), w, Math.round(len));
        }
      }
    }
  }

  // resplandor: copia a 1/8 de resolución, desenfocada, sumada encima.
  // Se recalcula cada 2 frames (el ojo no nota el retraso y es lo más caro)
  _drawBloom() {
    const { ctx } = this;
    if (this.frame - this._bloomFrame >= 2) {
      const b = this._bloomCtx;
      b.globalCompositeOperation = 'copy';
      b.filter = `blur(${Math.max(1, Math.round(this.ch / 14))}px)`;
      b.drawImage(this.canvas, 0, 0, this._bloom.width, this._bloom.height);
      b.filter = 'none';
      this._bloomFrame = this.frame;
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.32;
    ctx.drawImage(this._bloom, 0, 0, this.W, this.H);
    ctx.restore();
  }

  _drawCursor() {
    const cur = this.cursor;
    if (!cur) return;
    const { ctx } = this;
    const x = this.ox + cur.fx * this.cw, y = this.oy + cur.fy * this.ch;
    const s = this.ch * 0.9;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x + s * 0.72, y + s * 0.62); ctx.lineTo(x + s * 0.3, y + s * 0.7); ctx.lineTo(x, y + s);
    ctx.closePath();
    ctx.shadowColor = 'rgba(255,230,160,0.8)'; ctx.shadowBlur = s * 0.5;
    ctx.fillStyle = '#fff6dc'; ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = Math.max(1, this.dpr); ctx.strokeStyle = '#1a140a'; ctx.stroke();
    ctx.restore();
  }
}
