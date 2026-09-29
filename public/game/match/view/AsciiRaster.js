// Rasterizador ASCII del partido (docs/REDISENO.md, Fase 6). La escena 3D
// (PerspectiveCourt) se pinta en un lienzo lógico pequeño y aquí se
// convierte, celda a celda, en caracteres: cada celda ASCII mira un bloque
// de SX×SY subpíxeles y elige
//   · la DENSIDAD del glifo según su luminancia, con dithering Bayer 4×4
//     para que los degradados (cielo, niebla) no hagan bandas;
//   · la FORMA del glifo, cuando el bloque tiene contraste (un borde, una
//     línea, una piedra), comparando el bloque con la "máscara" de cada
//     carácter — así el horizonte sale como _ ¯ -, una línea en fuga como
//     / \, la grava como . , : ' ;
//   · DOS colores: fondo = el color medio muy oscurecido (la escena "se
//     llena") y glifo = el mismo tono aclarado y cuantizado a una paleta
//     corta (aspecto retro, no foto).
// Encima se dibujan primitivas ASCII "vectoriales" (líneas con el glifo de
// su pendiente, texto) y sprites (bolas sombreadas carácter a carácter).
//
// Todo son funciones puras sobre arrays: sin canvas funciona igual (con una
// rampa de densidad aproximada en lugar de máscaras medidas) y se prueba en
// tools/verify.mjs.

export const SX = 3, SY = 6; // subpíxeles por celda ASCII en el lienzo lógico

// juego de glifos para emparejar forma: gráficos (bordes, líneas, curvas)
// y unas pocas letras con forma clara; nada de letras sueltas tipo q p d b
// que en una textura solo se leen como ruido
export const GLYPHS = ' .`\',-_:;~^¯=+<>!/\\|()*oO0xXvTLJ7';
// rampa "plana" (zonas sin contraste): cada nivel de densidad tiene varias
// variantes y cada celda elige una con un ruido fijo — la textura se lee
// como grano ASCII orgánico y no como papel pintado
const FLAT = [' ', '.`,', "·:'", ":;'", '~;i', '+rx', 'ovc', '*ae', 'O0&', '#%8', '@MW'];
// cobertura aproximada de cada nivel (para Node, sin medir la fuente)
const FLAT_COV = [0, 0.04, 0.07, 0.1, 0.13, 0.18, 0.23, 0.28, 0.4, 0.5, 0.6];

// luminancia (0..255 entera) → cobertura objetivo: los tonos oscuros y
// planos quedan callados (punteado), los claros se llenan; tope 0.66 para
// que una zona plana muy clara (la helada) no se llene de @ — lo más denso
// queda para bordes y formas
const T_LUT = Float32Array.from({ length: 256 }, (_, l) => Math.min(0.66, Math.pow(l / 255, 1.45) * 1.3));

// brillo del glifo según la luminancia de la celda
const KF_LUT = Float32Array.from({ length: 256 }, (_, l) => (0.42 + 0.6 * Math.sqrt(l / 255)) * 255);
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

export const rgb = (r, g, b) => ((r & 255) << 16) | ((g & 255) << 8) | (b & 255);
export const hexToInt = (hex) => parseInt(hex.replace('#', ''), 16);
export const intToCss = (v) => `#${(v >>> 0).toString(16).padStart(6, '0').slice(-6)}`;
const R_ = (v) => (v >> 16) & 255, G_ = (v) => (v >> 8) & 255, B_ = (v) => v & 255;
// 6 niveles por canal → 216 tonos: la "paleta retro" de los glifos

export function mixInt(a, b, k) {
  return rgb(Math.round(R_(a) + (R_(b) - R_(a)) * k), Math.round(G_(a) + (G_(b) - G_(a)) * k), Math.round(B_(a) + (B_(b) - B_(a)) * k));
}
export function scaleInt(a, k) { return rgb(Math.min(255, R_(a) * k), Math.min(255, G_(a) * k), Math.min(255, B_(a) * k)); }

// --- buffer de celdas: carácter + color de glifo + color de fondo ---
export class AsciiBuffer {
  constructor(cols, rows) {
    this.cols = cols; this.rows = rows;
    const n = cols * rows;
    this.chars = new Uint16Array(n).fill(32);
    this.fg = new Uint32Array(n);
    this.bg = new Uint32Array(n);
  }
  copyFrom(o) { this.chars.set(o.chars); this.fg.set(o.fg); this.bg.set(o.bg); }
  inside(c, r) { return c >= 0 && r >= 0 && c < this.cols && r < this.rows; }
  set(c, r, ch, fg, bg) {
    c |= 0; r |= 0;
    if (!this.inside(c, r)) return;
    const i = r * this.cols + c;
    this.chars[i] = typeof ch === 'number' ? ch : ch.charCodeAt(0);
    if (fg !== undefined && fg !== null) this.fg[i] = fg;
    if (bg !== undefined && bg !== null) this.bg[i] = bg;
  }
  char(c, r) { return String.fromCharCode(this.chars[(r | 0) * this.cols + (c | 0)]); }
  // oscurece una celda (sombras, franja de narración)
  darken(c, r, k) {
    c |= 0; r |= 0;
    if (!this.inside(c, r)) return;
    const i = r * this.cols + c;
    this.fg[i] = scaleInt(this.fg[i], k); this.bg[i] = scaleInt(this.bg[i], k);
  }
}

// --- juego de glifos: cobertura + máscara SX×SY de cada carácter ---
// measure(ch) → Float32Array(SX*SY) con la tinta de cada subpíxel (0..1),
// o null (Node): entonces solo hay rampa plana.
export function makeGlyphSet(measure) {
  const list = [];
  if (measure) {
    for (const ch of GLYPHS) {
      const mask = measure(ch);
      let cov = 0;
      for (const v of mask) cov += v;
      cov /= mask.length;
      // máscara centrada y su norma: para el emparejamiento por correlación
      const cen = new Float32Array(mask.length);
      let nrm = 0;
      for (let i = 0; i < mask.length; i++) { cen[i] = mask[i] - cov; nrm += cen[i] * cen[i]; }
      list.push({ ch, code: ch.charCodeAt(0), cov, cen, nrm: Math.sqrt(nrm) });
    }
  }
  // rampa plana: cobertura media medida de las variantes de cada nivel
  const flat = FLAT.map((vars, i) => {
    const ms = [...vars].map((ch) => list.find((g) => g.ch === ch)).filter(Boolean);
    const cov = ms.length ? ms.reduce((a, g) => a + g.cov, 0) / ms.length : FLAT_COV[i];
    return { vars: [...vars].map((ch) => ({ ch, code: ch.charCodeAt(0) })), cov };
  });
  const maxCov = Math.max(...flat.map((f) => f.cov)) || 1;
  const shaped = list.filter((g) => g.nrm > 0.05);
  // todo empaquetado para el bucle caliente de convert(): máscaras centradas
  // y ya normalizadas, una tras otra en un solo Float32Array
  const n = SX * SY;
  const W = new Float32Array(shaped.length * n);
  shaped.forEach((g, j) => { for (let i = 0; i < n; i++) W[j * n + i] = g.cen[i] / g.nrm; });
  const covN = Float32Array.from(shaped, (g) => g.cov / maxCov);
  // rampa plana precalculada por luminancia (0..255): nivel de abajo y
  // fracción hacia el siguiente (el dithering decide cuál de los dos)
  const lvl = new Uint8Array(256), frac = new Float32Array(256);
  for (let l = 0; l < 256; l++) {
    const want = T_LUT[l] * maxCov;
    let k = 0;
    while (k < flat.length - 1 && flat[k + 1].cov <= want) k++;
    lvl[l] = k;
    if (k < flat.length - 1) { const a = flat[k].cov, b = flat[k + 1].cov; frac[l] = b > a ? (want - a) / (b - a) : 0; } else frac[l] = 0;
  }
  const codes = flat.map((f) => Uint16Array.from(f.vars, (vv) => vv.code));
  return { list, flat, maxCov, shaped, W, covN, lvl, frac, codes, measured: !!measure };
}

export const FALLBACK_GLYPHS = makeGlyphSet(null);

// ruido fijo por celda (hash entero): misma celda → mismo valor, sin parpadeo
function hash2(c, r) {
  let h = Math.imul(c, 374761393) + Math.imul(r, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}


// Convierte la imagen del lienzo lógico (cols*SX × rows*SY) en el buffer.
// opts.bgK: cuánto se oscurece el fondo; opts.contrast: umbral de forma.
export function convert(img, buf, gs = FALLBACK_GLYPHS, opts = {}) {
  const { data, width } = img;
  const cols = buf.cols, rows = buf.rows;
  const bgK = opts.bgK ?? 0.3;
  const minContrast = (opts.contrast ?? 0.18) * 255;
  const n = SX * SY;
  const v = new Float32Array(n);
  const lum = new Uint8Array(n);
  const chars = buf.chars, fgA = buf.fg, bgA = buf.bg;
  const shaped = gs.measured;
  const W = gs.W, covN = gs.covN, nG = covN ? covN.length : 0;
  const rowStride = width * 4;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let sr = 0, sg = 0, sb = 0, lo = 255, hi = 0, Ls = 0;
      let k = 0;
      let p0 = (r * SY * width + c * SX) * 4;
      for (let y = 0; y < SY; y++, p0 += rowStride) {
        let p = p0;
        for (let x = 0; x < SX; x++, p += 4, k++) {
          const R = data[p], G = data[p + 1], B = data[p + 2];
          sr += R; sg += G; sb += B;
          const l = (R * 77 + G * 150 + B * 29) >> 8;
          lum[k] = l; Ls += l;
          if (l < lo) lo = l; if (l > hi) hi = l;
        }
      }
      const Li = (Ls / n) | 0;
      const t = T_LUT[Li];
      const noise = hash2(c, r);
      // Bayer + un poco de ruido: sin bandas y sin patrón repetido; el ruido
      // también elige la variante del nivel
      const dither = (BAYER[(r & 3) * 4 + (c & 3)] + 0.5) * 0.04375 + noise * 0.3;
      const lv = gs.frac[Li] > dither ? gs.lvl[Li] + 1 : gs.lvl[Li];
      const vars = gs.codes[lv];
      let code = vars[(noise * 997 | 0) % vars.length];
      // forma: con contraste, el glifo cuya máscara más se parece al bloque
      if (shaped && hi - lo > minContrast) {
        const L = Ls / n;
        let vn = 0;
        for (let i = 0; i < n; i++) { const d = lum[i] - L; v[i] = d; vn += d * d; }
        const inv = 1 / (Math.sqrt(vn) + 1e-6);
        // puntuación = parecido de forma (correlación) − lo que se aleja de
        // la densidad que pide la luz; se prueban todos los glifos con forma
        let best = -1, bestS = 0.5;
        for (let j = 0, o = 0; j < nG; j++, o += n) {
          let s = 0;
          for (let i = 0; i < n; i++) s += W[o + i] * v[i];
          s = s * inv - 0.35 * Math.abs(covN[j] - t);
          if (s > bestS) { bestS = s; best = j; }
        }
        if (best >= 0) code = gs.shaped[best].code;
      }
      // colores: el glifo con el tono de la celda aclarado (y cuantizado a
      // 6 niveles por canal), el fondo con el mismo tono muy oscurecido
      sr /= n; sg /= n; sb /= n;
      const M = sr > sg ? (sr > sb ? sr : sb) : (sg > sb ? sg : sb);
      let kf = KF_LUT[Li] / (M < 1 ? 1 : M);
      if (kf > 3) kf = 3;
      let qr = ((sr * kf) / 51 + 0.5) | 0, qg = ((sg * kf) / 51 + 0.5) | 0, qb = ((sb * kf) / 51 + 0.5) | 0;
      if (qr > 5) qr = 5; if (qg > 5) qg = 5; if (qb > 5) qb = 5;
      const i = r * cols + c;
      fgA[i] = (qr * 51 << 16) | (qg * 51 << 8) | (qb * 51);
      bgA[i] = ((sr * bgK) << 16) | ((sg * bgK) << 8) | (sb * bgK);
      chars[i] = code;
    }
  }
}

// --- primitivas "vectoriales" ---

// glifo de un trazo según su pendiente VISUAL (aspect = alto/ancho de celda)
// y, para los casi horizontales, la altura dentro de la celda (fy 0..1):
// ¯ arriba, - en medio, _ abajo — el truco de sub-celda para líneas suaves
export function lineGlyph(dx, dy, fy = 0.5, aspect = 2) {
  const a = Math.atan2(dy * aspect, dx);
  let deg = (a * 180) / Math.PI;
  if (deg < 0) deg += 180;
  if (deg < 22.5 || deg >= 157.5) return fy < 0.34 ? '¯' : fy > 0.66 ? '_' : '-';
  if (deg < 67.5) return '\\';
  if (deg < 112.5) return '|';
  return '/';
}

// línea en coordenadas de celda (fraccionarias): paso a paso por la
// dirección dominante, un glifo por celda con la pendiente del trazo
export function drawLine(buf, x0, y0, x1, y1, fg, { aspect = 2, glyph = null, bg = null, every = 1, from = 0, to = 1 } = {}) {
  const dx = x1 - x0, dy = y1 - y0;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
  const ch = glyph;
  for (let s = Math.ceil(steps * from); s <= Math.floor(steps * to); s += every) {
    const k = s / steps;
    const x = x0 + dx * k, y = y0 + dy * k;
    const cy = Math.floor(y);
    buf.set(Math.floor(x), cy, ch || lineGlyph(dx, dy, y - cy, aspect), fg, bg);
  }
}

export function drawText(buf, c, r, str, fg, bg = null) {
  for (let i = 0; i < str.length; i++) buf.set(c + i, r, str[i], fg, bg);
}

// rampa de las bolas: de la cara en sombra a la iluminada
const BALL_RAMP = '.:-=+*oO0@';

// Bola como disco ASCII sombreado. (cx, cy) centro en celdas, rx/ry radio en
// celdas; cols = [claro, medio, oscuro] (enteros rgb). Devuelve las celdas
// tocadas. Pequeña → un solo glifo según tamaño; grande → cada celda con su
// normal de esfera iluminada desde arriba a la izquierda, el borde con los
// caracteres del contorno ( ) / \ _ ¯ y un brillo °.
export function drawBall(buf, cx, cy, rx, ry, cols, { grooves = false, ring = null } = {}) {
  const [light, mid, dark] = cols;
  if (rx < 0.75) {
    const ch = rx < 0.3 ? '·' : rx < 0.5 ? '•' : 'o';
    // fondo oscuro detrás: una bola lejana tiene que destacar sobre la grava
    buf.set(Math.floor(cx), Math.floor(cy), rx < 0.5 ? ch : '●', light, mixInt(dark, 0, 0.55));
    return 1;
  }
  let n = 0;
  const c0 = Math.floor(cx - rx - 1), c1 = Math.ceil(cx + rx + 1);
  const r0 = Math.floor(cy - ry - 1), r1 = Math.ceil(cy + ry + 1);
  const Lx = -0.5, Ly = -0.62, Lz = 0.6;
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const dx = (c + 0.5 - cx) / rx, dy = (r + 0.5 - cy) / ry;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 1.08) continue;
      if (ring && d > 1.0) continue;
      n++;
      if (d > 0.8) {
        // contorno: el carácter que "dibuja" el borde en ese punto
        let ch;
        const ax = Math.abs(dx), ay = Math.abs(dy);
        if (ax > ay * 2.2) ch = dx < 0 ? '(' : ')';
        else if (ay > ax * 2.2) ch = dy < 0 ? '¯' : '_';
        else ch = (dx < 0) === (dy < 0) ? '/' : '\\';
        buf.set(c, r, ch, dy < 0 && dx < 0.3 ? light : mid, mixInt(dark, 0, 0.35));
        continue;
      }
      const nz = Math.sqrt(Math.max(0, 1 - d * d));
      const lam = Math.max(0, dx * Lx + dy * Ly + nz * Lz);
      if (lam > 0.93) { buf.set(c, r, '°', 0xffffff, mixInt(light, mid, 0.4)); continue; }
      let ch = BALL_RAMP[Math.min(BALL_RAMP.length - 1, Math.floor(lam * BALL_RAMP.length))];
      // estrías de las bolas de acero: una banda en diagonal
      if (grooves && Math.abs(dy - dx * 0.35 - 0.1) < 0.09) ch = '=';
      const fg = lam > 0.55 ? mixInt(mid, light, (lam - 0.55) / 0.45) : mixInt(dark, mid, lam / 0.55);
      buf.set(c, r, ch, fg, mixInt(dark, mid, lam * 0.35));
    }
  }
  return n;
}

// sombra en el suelo: oscurece las celdas de una elipse (sin tocar glifos)
export function shadeEllipse(buf, cx, cy, rx, ry, k) {
  for (let r = Math.floor(cy - ry); r <= Math.ceil(cy + ry); r++) {
    for (let c = Math.floor(cx - rx); c <= Math.ceil(cx + rx); c++) {
      const dx = (c + 0.5 - cx) / Math.max(0.5, rx), dy = (r + 0.5 - cy) / Math.max(0.5, ry);
      if (dx * dx + dy * dy <= 1) buf.darken(c, r, k);
    }
  }
}
