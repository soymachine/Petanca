// Salida del ASCII del partido a la pantalla (docs/REDISENO.md, Fase 6).
// Solo navegador. Dos lienzos:
//   · fondos: un lienzo diminuto de cols×rows píxeles (un píxel por celda)
//     que se escala sin suavizado — todos los fondos de celda en UN
//     drawImage;
//   · glifos: lienzo a tamaño real que solo repinta las celdas cuyo
//     carácter o color han cambiado desde el frame anterior, con cada
//     glifo cacheado por (carácter, color).
// Además mide la fuente real para el emparejamiento de forma de
// AsciiRaster (máscara SX×SY de cada carácter).
import { makeGlyphSet, SX, SY, intToCss } from './AsciiRaster.js';

// ASCII a doble densidad; si la letra quedara diminuta (< MIN_CH px de
// alto), baja a 1.5× o a la densidad de la interfaz
const DENSITIES = [2, 1.5, 1];
const MIN_CH = 7;

export class AsciiOut {
  constructor() {
    this.lay = null;
    this._cache = new Map();
    this._gs = null;
  }

  // rejilla ASCII dentro del rectángulo de la vista (px de dispositivo),
  // a partir de la celda de la interfaz (R.cw × R.ch)
  layout(R, x, y, w, h) {
    const k = DENSITIES.find((d) => R.ch / d >= MIN_CH) || 1;
    const acw = Math.max(2, Math.floor(R.cw / k)), ach = Math.max(4, Math.floor(R.ch / k));
    const cols = Math.floor(w / acw), rows = Math.floor(h / ach);
    const gx = Math.round(x + (w - cols * acw) / 2), gy = Math.round(y + (h - rows * ach) / 2);
    const key = `${acw}x${ach}:${cols}x${rows}:${gx},${gy}:${R.fontFamily}`;
    if (!this.lay || this.lay.key !== key) {
      this.lay = { key, x: gx, y: gy, w: cols * acw, h: rows * ach, acw, ach, cols, rows, density: k, aspect: ach / acw };
      this._alloc(R);
    }
    return this.lay;
  }

  _alloc(R) {
    const { cols, rows, acw, ach } = this.lay;
    this._bg = document.createElement('canvas');
    this._bg.width = cols; this._bg.height = rows;
    this._bgCtx = this._bg.getContext('2d');
    this._bgImg = this._bgCtx.createImageData(cols, rows);
    this._bg32 = new Uint32Array(this._bgImg.data.buffer);
    this._gl = document.createElement('canvas');
    this._gl.width = cols * acw; this._gl.height = rows * ach;
    this._glCtx = this._gl.getContext('2d');
    this._prevCh = new Uint16Array(cols * rows).fill(0xffff);
    this._prevFg = new Uint32Array(cols * rows);
    this._cache.clear();
    // tamaño de letra: que el avance llene la celda sin pasarse de alto
    const m = document.createElement('canvas').getContext('2d');
    m.font = `100px ${R.fontFamily}`;
    const adv = m.measureText('M').width / 100;
    this._fontPx = Math.min((acw * 0.96) / adv, ach * 0.95);
    this._font = `${this._fontPx}px ${R.fontFamily}`;
  }

  // juego de glifos medido con la fuente de verdad (una vez)
  glyphSet(fontFamily) {
    if (this._gs) return this._gs;
    const cw = SX * 8, ch = SY * 8;
    const c = document.createElement('canvas');
    c.width = cw; c.height = ch;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.font = `100px ${fontFamily}`;
    const adv = x.measureText('M').width / 100;
    const px = Math.min((cw * 0.96) / adv, ch * 0.95);
    const measure = (g) => {
      x.clearRect(0, 0, cw, ch);
      x.fillStyle = '#fff'; x.font = `${px}px ${fontFamily}`;
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(g, cw / 2, ch / 2 + ch * 0.04);
      const d = x.getImageData(0, 0, cw, ch).data;
      const mask = new Float32Array(SX * SY);
      for (let yy = 0; yy < ch; yy++) {
        for (let xx = 0; xx < cw; xx++) {
          mask[((yy / 8) | 0) * SX + ((xx / 8) | 0)] += d[(yy * cw + xx) * 4 + 3] / 255 / 64;
        }
      }
      return mask;
    };
    this._gs = makeGlyphSet(measure);
    return this._gs;
  }

  _glyph(code, fg) {
    const key = code * 16777216 + fg;
    let g = this._cache.get(key);
    if (g) return g;
    if (this._cache.size > 12000) this._cache.clear();
    const { acw, ach } = this.lay;
    g = document.createElement('canvas');
    g.width = acw; g.height = ach;
    const x = g.getContext('2d');
    x.font = this._font; x.fillStyle = intToCss(fg);
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(String.fromCharCode(code), acw / 2, ach / 2 + ach * 0.04);
    this._cache.set(key, g);
    return g;
  }

  // pinta el buffer (AsciiRaster.AsciiBuffer) en ctx
  blit(ctx, buf) {
    const { cols, rows, acw, ach, x, y, w, h } = this.lay;
    const n = cols * rows;
    // fondos: ABGR en little-endian
    const b32 = this._bg32, bg = buf.bg;
    for (let i = 0; i < n; i++) {
      const v = bg[i];
      b32[i] = 0xff000000 | ((v & 255) << 16) | (v & 0xff00) | ((v >> 16) & 255);
    }
    this._bgCtx.putImageData(this._bgImg, 0, 0);
    // glifos: solo lo que ha cambiado
    const t = this._glCtx, pc = this._prevCh, pf = this._prevFg, chars = buf.chars, fg = buf.fg;
    for (let i = 0; i < n; i++) {
      const code = chars[i], f = fg[i];
      if (pc[i] === code && pf[i] === f) continue;
      pc[i] = code; pf[i] = f;
      const cx = (i % cols) * acw, cy = ((i / cols) | 0) * ach;
      t.clearRect(cx, cy, acw, ach);
      if (code !== 32) t.drawImage(this._glyph(code, f), cx, cy);
    }
    const sm = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this._bg, x, y, w, h);
    ctx.imageSmoothingEnabled = sm;
    ctx.drawImage(this._gl, x, y);
  }
}
