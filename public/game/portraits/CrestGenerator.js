import { hashStr, mulberry32 } from '../core/utils.js';
import { SHAPES, MINI_SHAPES, CREST_COLORS, CREST_EMBLEM_COLORS, CREST_EMBLEMS } from './CrestParts.js';

const PATTERNS = ['solid', 'pale', 'fess', 'quartered'];

// recorta una silueta a las celdas donde `keep(r,c)` es cierto, con
// `fillChar` en vez de 'X' — así "medio escudo" (partido en palo/faja/
// cuartelado) se saca de la misma silueta en vez de dibujar formas nuevas
function maskLines(shape, keep, fillChar) {
  return shape.map((row, r) => Array.from(row).map((ch, c) => (ch === 'X' && keep(r, c) ? fillChar : ' ')).join(''));
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
  const startRow = midRow - Math.floor(eh / 2) - (h > 5 ? 1 : 0);
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
// rivalArchetypes), eligiendo forma, patrón heráldico, 2 colores base y un
// emblema. Devuelve {layers} en el formato de Screen.drawPortrait.
function buildCrest(seed, shapes) {
  const rng = mulberry32(hashStr(`crest-${seed}`));
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];

  const shape = pick(shapes);
  const h = shape.length, w = shape[0].length;
  const midRow = Math.floor(h / 2), midCol = Math.floor(w / 2);

  const colorA = pick(CREST_COLORS);
  let colorB = pick(CREST_COLORS);
  while (colorB === colorA) colorB = pick(CREST_COLORS);
  const pattern = pick(PATTERNS);

  const layers = [];
  if (pattern === 'solid') {
    layers.push([colorA, maskLines(shape, () => true, '█')]);
  } else if (pattern === 'pale') { // partido en palo: mitad izquierda / derecha
    layers.push([colorA, maskLines(shape, (r, c) => c < midCol, '█')]);
    layers.push([colorB, maskLines(shape, (r, c) => c >= midCol, '█')]);
  } else if (pattern === 'fess') { // partido en faja: mitad arriba / abajo
    layers.push([colorA, maskLines(shape, (r) => r < midRow, '█')]);
    layers.push([colorB, maskLines(shape, (r) => r >= midRow, '█')]);
  } else { // cuartelado: 4 cuadrantes alternos
    layers.push([colorA, maskLines(shape, (r, c) => (r < midRow) === (c < midCol), '█')]);
    layers.push([colorB, maskLines(shape, (r, c) => (r < midRow) !== (c < midCol), '█')]);
  }

  // si el color del emblema coincidiera con el de fondo (posible: algún
  // tono se repite entre las dos paletas), un emblema de bloque sólido
  // (p.ej. la torre, hecha de '█' igual que el relleno) quedaría
  // literalmente invisible — se descarta esa opción en vez de arriesgarse
  const emblem = pick(CREST_EMBLEMS);
  const emblemPool = CREST_EMBLEM_COLORS.filter((c) => c !== colorA && c !== colorB);
  layers.push([pick(emblemPool.length ? emblemPool : CREST_EMBLEM_COLORS), emblemLines(emblem, h, w, midRow, midCol)]);
  return { layers };
}

export class CrestGenerator {
  // escudo "de héroe" (9x9): pantalla de resultado, tooltips con espacio de sobra
  static generate(seed) { return buildCrest(seed, SHAPES); }
  // escudo compacto (5x7): cabeceras y listas donde no cabe el grande
  static generateMini(seed) { return buildCrest(seed, MINI_SHAPES); }
}
