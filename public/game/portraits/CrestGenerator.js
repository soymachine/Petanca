import { hashStr, mulberry32 } from '../core/utils.js';
import { SHIELD_MASK, CREST_COLORS, CREST_EMBLEM_COLORS, CREST_EMBLEMS } from './CrestParts.js';

const H = SHIELD_MASK.length;
const W = SHIELD_MASK[0].length;
const MID_ROW = Math.floor(H / 2);
const MID_COL = Math.floor(W / 2);
const PATTERNS = ['solid', 'pale', 'fess', 'quartered'];

// recorta SHIELD_MASK a las celdas donde `keep(r,c)` es cierto, con
// `fillChar` en vez de 'X' — así "medio escudo" (partido en palo/faja/
// cuartelado) se saca de la misma silueta en vez de dibujar formas nuevas
function maskLines(keep, fillChar) {
  return SHIELD_MASK.map((row, r) => Array.from(row).map((ch, c) => (ch === 'X' && keep(r, c) ? fillChar : ' ')).join(''));
}

// una rejilla HxW en blanco con `emblem` centrado (y un pelín por encima
// del centro real, para no comerse la punta inferior del escudo) — todas
// las capas de un mismo escudo comparten el mismo origen (x,y) al
// dibujarse con Screen.drawPortrait, así que el emblema tiene que traer
// ya su desplazamiento incluido en la rejilla, como hacen las piezas de
// PortraitParts.js
function emblemLines(emblem) {
  const eh = emblem.length;
  const ew = Math.max(...emblem.map((l) => l.length));
  const startRow = MID_ROW - Math.floor(eh / 2) - 1;
  const startCol = MID_COL - Math.floor(ew / 2);
  return Array.from({ length: H }, (_, r) => {
    if (r < startRow || r >= startRow + eh) return ' '.repeat(W);
    const emblemRow = emblem[r - startRow];
    const out = new Array(W).fill(' ');
    for (let c = 0; c < emblemRow.length; c++) {
      const col = startCol + c;
      if (col >= 0 && col < W && emblemRow[c] !== ' ') out[col] = emblemRow[c];
    }
    return out.join('');
  });
}

// Escudo de club procedural: determinista por nombre (mismo escudo toda la
// carrera, sin persistir nada nuevo), mismo truco que boardPresidentFor/
// rivalArchetypes. Devuelve {layers} en el formato de Screen.drawPortrait.
export class CrestGenerator {
  static generate(seed) {
    const rng = mulberry32(hashStr(`crest-${seed}`));
    const pick = (arr) => arr[Math.floor(rng() * arr.length)];

    const colorA = pick(CREST_COLORS);
    let colorB = pick(CREST_COLORS);
    while (colorB === colorA) colorB = pick(CREST_COLORS);
    const pattern = pick(PATTERNS);

    const layers = [];
    if (pattern === 'solid') {
      layers.push([colorA, maskLines(() => true, '█')]);
    } else if (pattern === 'pale') { // partido en palo: mitad izquierda / derecha
      layers.push([colorA, maskLines((r, c) => c < MID_COL, '█')]);
      layers.push([colorB, maskLines((r, c) => c >= MID_COL, '█')]);
    } else if (pattern === 'fess') { // partido en faja: mitad arriba / abajo
      layers.push([colorA, maskLines((r) => r < MID_ROW, '█')]);
      layers.push([colorB, maskLines((r) => r >= MID_ROW, '█')]);
    } else { // cuartelado: 4 cuadrantes alternos
      layers.push([colorA, maskLines((r, c) => (r < MID_ROW) === (c < MID_COL), '█')]);
      layers.push([colorB, maskLines((r, c) => (r < MID_ROW) !== (c < MID_COL), '█')]);
    }

    // si el color del emblema coincidiera con el de fondo (posible: algún
    // tono se repite entre las dos paletas), un emblema de bloque sólido
    // (p.ej. la torre, hecha de '█' igual que el relleno) quedaría
    // literalmente invisible — se descarta esa opción en vez de arriesgarse
    const emblem = pick(CREST_EMBLEMS);
    const emblemPool = CREST_EMBLEM_COLORS.filter((c) => c !== colorA && c !== colorB);
    layers.push([pick(emblemPool.length ? emblemPool : CREST_EMBLEM_COLORS), emblemLines(emblem)]);
    return { layers };
  }
}
