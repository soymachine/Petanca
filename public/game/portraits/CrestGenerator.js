import { hashStr, mulberry32 } from '../core/utils.js';
import { SHAPES, MINI_SHAPES, CREST_COLORS, CREST_EMBLEM_COLORS, CREST_EMBLEMS } from './CrestParts.js';

// direcciones de degradado: vertical/horizontal/diagonal son un barrido
// lineal de color A a color B; radial va del centro (color A) al borde
// (color B), como un sol — cada una da una "personalidad" de escudo bien
// distinta con solo 2 colores de entrada
const GRADIENTS = ['vertical', 'horizontal', 'diagonal', 'radial'];

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}
function lerpColor(c1, c2, t) {
  const a = hexToRgb(c1), b = hexToRgb(c2);
  return rgbToHex(a.map((v, i) => v + (b[i] - v) * t));
}

// posición normalizada (0..1) de una celda a lo largo del degradado
// elegido — 0 = color A puro, 1 = color B puro
function gradientT(axis, r, c, h, w) {
  if (axis === 'vertical') return r / (h - 1);
  if (axis === 'horizontal') return c / (w - 1);
  if (axis === 'diagonal') return (r + c) / (h + w - 2);
  // radial: distancia al centro normalizada por la distancia máxima (la esquina)
  const midR = (h - 1) / 2, midC = (w - 1) / 2;
  const maxD = Math.hypot(midR, midC);
  return Math.hypot(r - midR, c - midC) / maxD;
}

// una capa de Screen.drawPortrait por cada "banda" del degradado: el
// buffer de pantalla solo admite un color por carácter, así que un
// degradado de verdad no existe — se aproxima con varias bandas finas,
// cada una en un tono interpolado, como el dithering de un pixel art
// retro. `bands` controla la suavidad (más bandas = transición más fina).
function gradientLayers(shape, axis, colorA, colorB, bands) {
  const h = shape.length, w = shape[0].length;
  const layers = [];
  for (let b = 0; b < bands; b++) {
    const t0 = b / bands, t1 = (b + 1) / bands;
    const color = lerpColor(colorA, colorB, (t0 + t1) / 2);
    const lines = shape.map((row, r) => Array.from(row).map((ch, c) => {
      if (ch !== 'X') return ' ';
      const t = gradientT(axis, r, c, h, w);
      return (t >= t0 && (t < t1 || b === bands - 1)) ? '█' : ' ';
    }).join(''));
    layers.push([color, lines]);
  }
  return layers;
}

// una rejilla HxW en blanco con `emblem` centrado (y un pelín por encima
// del centro real, para no comerse la punta inferior de las formas que
// afilan hacia abajo) — todas las capas de un mismo escudo comparten el
// mismo origen (x,y) al dibujarse con Screen.drawPortrait, así que el
// emblema tiene que traer ya su desplazamiento incluido en la rejilla,
// como hacen las piezas de PortraitParts.js
function emblemLines(emblem, h, w, midRow, midCol) {
  const eh = emblem.length;
  const ew = Math.max(...emblem.map((l) => l.length));
  const startRow = midRow - Math.floor(eh / 2) - (h > 8 ? 1 : 0);
  const startCol = midCol - Math.floor(ew / 2);
  return Array.from({ length: h }, (_, r) => {
    if (r < startRow || r >= startRow + eh) return ' '.repeat(w);
    const emblemRow = emblem[r - startRow];
    const out = new Array(w).fill(' ');
    for (let c = 0; c < emblemRow.length; c++) {
      const col = startCol + c;
      if (col >= 0 && col < w && emblemRow[c] !== ' ') out[col] = emblemRow[c];
    }
    return out.join('');
  });
}

// núcleo compartido: determinista por semilla (mismo escudo toda la
// carrera, sin persistir nada nuevo — mismo truco que boardPresidentFor/
// rivalArchetypes), eligiendo forma, degradado, 2 colores base y un
// emblema. Devuelve {layers} en el formato de Screen.drawPortrait.
function buildCrest(seed, shapes, bands) {
  const rng = mulberry32(hashStr(`crest-${seed}`));
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];

  const shape = pick(shapes);
  const h = shape.length, w = shape[0].length;
  const midRow = Math.floor(h / 2), midCol = Math.floor(w / 2);

  const colorA = pick(CREST_COLORS);
  let colorB = pick(CREST_COLORS);
  while (colorB === colorA) colorB = pick(CREST_COLORS);
  const axis = pick(GRADIENTS);

  const layers = gradientLayers(shape, axis, colorA, colorB, bands);

  // si el color del emblema coincidiera con el de un extremo del
  // degradado, un emblema de bloque sólido (p.ej. la torre, hecha de '█'
  // igual que el relleno) podría camuflarse en esa zona del escudo — se
  // descarta esa opción en vez de arriesgarse
  const emblem = pick(CREST_EMBLEMS);
  const emblemPool = CREST_EMBLEM_COLORS.filter((c) => c !== colorA && c !== colorB);
  layers.push([pick(emblemPool.length ? emblemPool : CREST_EMBLEM_COLORS), emblemLines(emblem, h, w, midRow, midCol)]);
  return { layers };
}

export class CrestGenerator {
  // escudo "de héroe" (13x13): pantalla de resultado, tooltips con espacio de sobra
  static generate(seed) { return buildCrest(seed, SHAPES, 10); }
  // escudo compacto (8x11): cabeceras y listas donde no cabe el grande
  static generateMini(seed) { return buildCrest(seed, MINI_SHAPES, 6); }
}
