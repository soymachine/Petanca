import { clamp, distToSeg } from '../core/utils.js';

// Caja combinada de los 6 países del circuito (España, Francia, Italia,
// Bélgica, Suiza, Portugal). El resto del pipeline (geoNorm/toWorld/extent
// de zoom) no cambia: solo se ensancha el rectángulo lon/lat que se
// reparte en la rejilla. LON_MIN/LAT_MIN no cambian respecto a la caja
// España+Francia original (Portugal y el norte de Bélgica ya caían dentro
// de ese rango); solo LON_MAX crece para dar cabida a Italia.
const LON_MIN = -9.3, LON_MAX = 13.8, LAT_MIN = 35.9, LAT_MAX = 51.1;
function geoNorm(lon, lat) {
  return [(lon - LON_MIN) / (LON_MAX - LON_MIN), (LAT_MAX - lat) / (LAT_MAX - LAT_MIN)];
}

// costa aproximada de la Península (sentido horario desde Fisterra)
const SPAIN_LONLAT = [
  [-9.3, 42.9], [-8.4, 43.4], [-7.0, 43.55], [-5.7, 43.55], [-3.8, 43.47],
  [-2.9, 43.4], [-1.98, 43.32], [0.0, 42.7], [1.4, 42.45], [3.3, 42.3],
  [2.3, 41.35], [1.2, 41.1], [0.0, 39.9], [-0.3, 39.4], [-0.5, 38.35],
  [-0.9, 37.6], [-2.15, 36.75], [-4.4, 36.7], [-5.35, 36.05], [-6.3, 36.5],
  [-7.4, 37.15], [-7.0, 38.0], [-6.85, 39.0], [-6.8, 40.1], [-6.6, 41.0],
  [-6.4, 41.9], [-7.0, 42.3],
];
const SPAIN_POLY = SPAIN_LONLAT.map(([lon, lat]) => geoNorm(lon, lat));

// costa aproximada del Hexágono (sentido horario desde Bretaña); simplificada
// al mismo nivel de detalle que SPAIN_LONLAT — no es un trazado catastral,
// es una silueta reconocible con orografía real encima (ver RANGES/PEAKS).
const FRANCE_LONLAT = [
  [-4.5, 48.4], [-1.9, 49.35], [1.6, 50.95], [2.5, 50.9], [4.8, 49.9],
  [7.6, 48.95], [7.2, 47.6], [7.0, 45.9], [7.4, 43.75], [5.37, 43.3],
  [3.1, 42.45], [-1.4, 43.3], [-1.2, 44.65], [-1.15, 46.15], [-2.35, 47.25],
  [-4.3, 47.9],
];
const FRANCE_POLY = FRANCE_LONLAT.map(([lon, lat]) => geoNorm(lon, lat));

const BALEARES = [
  { lon: 2.65, lat: 39.57, r: 0.018 },
  { lon: 1.43, lat: 38.91, r: 0.010 },
  { lon: 4.26, lat: 39.90, r: 0.010 },
];

// bota italiana simplificada (sentido horario desde la frontera francesa):
// baja por la costa tirrena, toca el dedo del pie en Calabria, salta al
// tacón en Puglia y sube por la costa adriática hasta los Alpes — Sicilia
// y Cerdeña se dejan fuera a propósito, igual que Córcega en Francia
const ITALY_LONLAT = [
  [7.2, 45.3], [8.9, 44.4], [10.3, 43.0], [12.3, 41.75], [14.25, 40.85],
  [15.9, 38.2], [17.9, 40.3], [16.9, 41.2], [14.7, 42.4], [13.7, 43.6],
  [12.6, 44.5], [13.4, 45.6], [13.8, 45.65], [11.0, 46.5], [8.0, 46.3],
];
const ITALY_POLY = ITALY_LONLAT.map(([lon, lat]) => geoNorm(lon, lat));

// Suiza: alpina, sin costa (interior puro) — el mismo pointInPoly/
// distToCoast funciona igual de bien para un país sin litoral
const SWITZERLAND_LONLAT = [
  [6.0, 46.4], [6.8, 47.4], [7.6, 47.6], [8.6, 47.7], [9.5, 47.5],
  [9.6, 46.9], [10.3, 46.5], [9.0, 46.0], [7.0, 45.9], [6.0, 46.0],
];
const SWITZERLAND_POLY = SWITZERLAND_LONLAT.map(([lon, lat]) => geoNorm(lon, lat));

// Bélgica: pequeña y plana, costa corta al noroeste
const BELGIUM_LONLAT = [
  [2.55, 51.09], [3.4, 51.35], [4.3, 51.35], [5.9, 51.1], [6.1, 50.3],
  [5.8, 49.5], [4.8, 49.5], [3.5, 50.3],
];
const BELGIUM_POLY = BELGIUM_LONLAT.map(([lon, lat]) => geoNorm(lon, lat));

// Portugal: rectángulo alargado norte-sur pegado al Atlántico, con la
// muesca del Algarve al sur
const PORTUGAL_LONLAT = [
  [-8.85, 42.0], [-8.15, 41.7], [-8.9, 41.15], [-8.6, 40.65], [-9.1, 39.6], [-9.5, 38.75],
  [-8.9, 38.0], [-8.9, 37.0], [-7.4, 36.95], [-7.5, 38.0], [-7.0, 39.6],
  [-6.8, 41.0],
];
const PORTUGAL_POLY = PORTUGAL_LONLAT.map(([lon, lat]) => geoNorm(lon, lat));

// una entrada por país: silueta + islotes propios (Francia, Suiza, Bélgica
// y Portugal no tienen aquí; Sicilia/Cerdeña se dejan fuera de Italia a
// propósito, igual que Córcega en Francia, para no complicar la silueta)
const COUNTRIES = [
  { code: 'ES', poly: SPAIN_POLY, islands: BALEARES },
  { code: 'FR', poly: FRANCE_POLY, islands: [] },
  { code: 'IT', poly: ITALY_POLY, islands: [] },
  { code: 'CH', poly: SWITZERLAND_POLY, islands: [] },
  { code: 'BE', poly: BELGIUM_POLY, islands: [] },
  { code: 'PT', poly: PORTUGAL_POLY, islands: [] },
];

// corredores de tierra en cada frontera compartida: las siluetas de arriba
// se trazaron país a país, así que sus bordes no encajan vértice a vértice
// y dejan algún hueco de mar justo en la raya fronteriza (p.ej. entre
// España y Portugal, o entre España y Francia en el Pirineo). En vez de
// perseguir un encaje perfecto, se refuerza cada frontera con una
// polilínea "de tierra segura" (mismo truco que RANGES/VALLEYS con
// distToSeg) que garantiza que los países vecinos queden unidos sin
// espacio de mar entre ellos — y de paso sirve para dibujar la raya
// fronteriza cuando se hace zoom in (ver Geography.showBorders).
const BORDER_LINKS = [
  { pts: [[-1.98, 43.32], [-1.4, 43.3], [-0.5, 42.65], [0.7, 42.5], [1.9, 42.4], [3.1, 42.45]], landR: 0.02 }, // España-Francia (Pirineos)
  { pts: [[-8.85, 42.0], [-7.0, 42.3], [-6.85, 39.0], [-7.0, 38.0], [-7.4, 36.95]], landR: 0.02 }, // España-Portugal
  { pts: [[7.2, 45.3], [7.3, 43.9]], landR: 0.022 }, // Francia-Italia (Alpes)
  { pts: [[6.8, 47.4], [6.5, 46.4], [7.0, 45.9]], landR: 0.022 }, // Francia-Suiza (Jura/Alpes)
  { pts: [[9.5, 47.5], [9.0, 46.0]], landR: 0.022 }, // Suiza-Italia (Alpes centrales)
  { pts: [[4.8, 49.9], [4.8, 49.5]], landR: 0.018 }, // Francia-Bélgica
];
// segmentos [a,b] a partir de cada polilínea de frontera, ya normalizados
const BORDER_SEGMENTS = BORDER_LINKS.flatMap((link) => {
  const norm = link.pts.map(([lon, lat]) => geoNorm(lon, lat));
  const segs = [];
  for (let i = 0; i < norm.length - 1; i++) segs.push({ a: norm[i], b: norm[i + 1], landR: link.landR });
  return segs;
});

const RANGES = [
  { seg: [[-1.5, 42.6], [2.0, 42.5]], r: 0.022, peak: 0.85 }, // Pirineos (frontera ES-FR, relieve a ambos lados)
  { seg: [[-7.0, 43.2], [-3.0, 43.05]], r: 0.022, peak: 0.6 }, // Cordillera Cantábrica
  { seg: [[-6.8, 40.35], [-3.0, 40.85]], r: 0.024, peak: 0.5 }, // Sistema Central
  { seg: [[-3.0, 41.8], [-1.0, 40.0]], r: 0.022, peak: 0.46 }, // Sistema Ibérico
  { seg: [[-6.8, 38.25], [-3.0, 38.0]], r: 0.02, peak: 0.38 }, // Sierra Morena
  { seg: [[-5.4, 36.9], [-2.0, 36.9]], r: 0.026, peak: 0.48 }, // Cordillera Bética
  { seg: [[6.9, 45.0], [7.3, 43.9]], r: 0.02, peak: 0.9 }, // Alpes franceses (Saboya-Niza)
  { seg: [[2.2, 45.6], [3.8, 44.5]], r: 0.03, peak: 0.42 }, // Macizo Central
  { seg: [[6.2, 48.3], [7.4, 47.9]], r: 0.018, peak: 0.4 }, // Vosgos (Alsacia)
  { seg: [[7.0, 46.5], [9.6, 46.6]], r: 0.022, peak: 0.9 }, // Alpes suizos
  { seg: [[10.8, 43.6], [15.5, 39.0]], r: 0.024, peak: 0.55 }, // Apeninos (espina dorsal de Italia)
];
const PEAKS = [
  { p: [-3.31, 37.06], r: 0.018, peak: 1.0 }, // Mulhacén
  { p: [-0.65, 42.63], r: 0.016, peak: 1.0 }, // Pirineo aragonés
  { p: [6.86, 45.83], r: 0.014, peak: 1.0 }, // Mont Blanc
  { p: [7.87, 45.98], r: 0.014, peak: 1.0 }, // Cervino/Matterhorn
];
const VALLEYS = [
  { seg: [[-1.7, 41.9], [0.5, 41.6]], r: 0.05, dip: 0.35 }, // valle del Ebro
  { seg: [[-6.0, 37.9], [-3.5, 37.4]], r: 0.05, dip: 0.35 }, // valle del Guadalquivir
  { seg: [[2.5, 47.0], [1.0, 47.4]], r: 0.05, dip: 0.3 }, // valle del Loira
  { seg: [[4.8, 45.7], [4.9, 43.8]], r: 0.045, dip: 0.28 }, // valle del Ródano
];

const RELIEF_TIERS = [
  { max: 0.10, ch: '.', color: '#8fc25a' },
  { max: 0.20, ch: ',', color: '#7ec850' },
  { max: 0.30, ch: ':', color: '#a3b25a' },
  { max: 0.40, ch: ';', color: '#b09a4a' },
  { max: 0.52, ch: '^', color: '#9a7a42' },
  { max: 0.65, ch: 'n', color: '#8a6a3a' },
  { max: 0.86, ch: 'M', color: '#6b5636' },
  { max: 2.00, ch: '▲', color: '#f0f4f8' },
];
function reliefFor(h) {
  for (const t of RELIEF_TIERS) if (h <= t.max) return t;
  return RELIEF_TIERS[RELIEF_TIERS.length - 1];
}

function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if (((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

// tierra si cae dentro de la silueta de CUALQUIER país (o uno de sus
// islotes), o dentro de un corredor fronterizo (BORDER_SEGMENTS) que une
// dos países vecinos — con los 6 países en el mismo mapa hace falta
// recorrer la lista completa
function landAt(x, y) {
  for (const country of COUNTRIES) {
    if (pointInPoly(x, y, country.poly)) return true;
    for (const isl of country.islands) {
      const [ix, iy] = geoNorm(isl.lon, isl.lat);
      if (Math.hypot(x - ix, y - iy) < isl.r) return true;
    }
  }
  for (const seg of BORDER_SEGMENTS) {
    if (distToSeg(x, y, seg.a[0], seg.a[1], seg.b[0], seg.b[1]) < seg.landR) return true;
  }
  return false;
}

// ¿cae este punto sobre la raya fronteriza (banda mucho más fina que el
// corredor de tierra de arriba)? Solo se consulta cuando el mapa se
// dibuja con `showBorders` (zoom in), para pintar una línea de puntos
// discreta sobre el terreno en vez de dejar la frontera invisible.
const BORDER_LINE_R = 0.006;
function onBorderLine(x, y) {
  for (const seg of BORDER_SEGMENTS) {
    if (distToSeg(x, y, seg.a[0], seg.a[1], seg.b[0], seg.b[1]) < BORDER_LINE_R) return true;
  }
  return false;
}

function distToCoast(x, y) {
  let best = Infinity;
  for (const country of COUNTRIES) {
    const poly = country.poly;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const d = distToSeg(x, y, poly[i][0], poly[i][1], poly[j][0], poly[j][1]);
      if (d < best) best = d;
    }
  }
  return best;
}
function heightAt(x, y) {
  let h = Math.min(0.34, distToCoast(x, y) * 3.4);
  for (const rg of RANGES) {
    const [a, b] = rg.seg.map(([lon, lat]) => geoNorm(lon, lat));
    const d = distToSeg(x, y, a[0], a[1], b[0], b[1]);
    h += rg.peak * Math.exp(-(d * d) / (rg.r * rg.r));
  }
  for (const pk of PEAKS) {
    const [px, py] = geoNorm(pk.p[0], pk.p[1]);
    const d = Math.hypot(x - px, y - py);
    h += pk.peak * Math.exp(-(d * d) / (pk.r * pk.r)) * 0.5;
  }
  for (const v of VALLEYS) {
    const [a, b] = v.seg.map(([lon, lat]) => geoNorm(lon, lat));
    const d = distToSeg(x, y, a[0], a[1], b[0], b[1]);
    h -= v.dip * Math.exp(-(d * d) / (v.r * v.r));
  }
  return clamp(h, 0, 1);
}

// Genera y sirve el relieve de los 6 países del circuito: silueta real por
// polígono lon/lat (uno por país) + heightmap de cordilleras compartido.
// Se construye una sola vez (es caro por celda).
//
// `extent` controla el zoom OUT: con extent=1 (por defecto) la caja de los
// 6 países completa ocupa exactamente la rejilla width×height. Con
// extent>1 el mismo número de celdas representa un área geográfica mayor,
// así que el continente se "encoge" hacia el centro y el resto se
// recalcula como mar. Para zoom IN, en cambio, NO se usa extent<1 (eso
// recortaría la ventana muestreada a un tamaño de rejilla fijo, dejando
// fuera del mapa para siempre cualquier ciudad lejos del centro — así se
// quedaba Sevilla inalcanzable al acercar del todo): en su lugar,
// LeagueMapScreen pide una rejilla más grande (más celdas) con extent=1,
// así que el zoom in es solo más resolución, nunca pérdida de área real.
// Tanto el relieve como las coordenadas de las ciudades (toWorld) se
// recalculan con este mismo factor, así que un cambio de zoom reposiciona
// los POI y recompone la orografía entera en vez de solo reencuadrar una
// imagen fija.
export class Geography {
  constructor(width = 286, height = 92, extent = 1, showBorders = false) {
    this.width = width;
    this.height = height;
    this.extent = extent;
    this.showBorders = showBorders;
    this.land = [];
    this.char = [];
    this.color = [];
    this._build();
  }

  // grid-space [0,1] -> espacio geográfico base [0,1] donde los 6 países
  // encajan exactamente; ambos coinciden cuando extent = 1
  _toBase(x, y) {
    return [0.5 + (x - 0.5) * this.extent, 0.5 + (y - 0.5) * this.extent];
  }

  _build() {
    for (let wy = 0; wy < this.height; wy++) {
      const landRow = new Array(this.width), chRow = new Array(this.width), colRow = new Array(this.width);
      for (let wx = 0; wx < this.width; wx++) {
        const [x, y] = this._toBase(wx / this.width, wy / this.height);
        const isLand = landAt(x, y);
        landRow[wx] = isLand;
        if (isLand) {
          if (this.showBorders && onBorderLine(x, y)) {
            chRow[wx] = '·'; colRow[wx] = '#f0e6c8';
          } else {
            const t = reliefFor(heightAt(x, y));
            chRow[wx] = t.ch; colRow[wx] = t.color;
          }
        }
      }
      this.land.push(landRow); this.char.push(chRow); this.color.push(colRow);
    }
  }

  isLand(wx, wy) {
    return wx >= 0 && wx < this.width && wy >= 0 && wy < this.height && this.land[wy][wx];
  }

  // coloca una ciudad en el mapa-mundo a partir de su lon/lat real, con el
  // mismo factor de zoom que el relieve, para que el punto siga cayendo
  // sobre su sitio real de la costa/interior a cualquier nivel de zoom
  toWorld(lon, lat) {
    const [bx, by] = geoNorm(lon, lat);
    const x = 0.5 + (bx - 0.5) / this.extent;
    const y = 0.5 + (by - 0.5) / this.extent;
    return [Math.round(x * this.width), Math.round(y * this.height)];
  }
}
