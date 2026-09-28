// Código visual del juego (docs/REDISENO.md, Fase 2): UNA sola fuente de
// verdad para colores semánticos y para cómo se representa cada mecánica.
// La idea es que el jugador aprenda un glifo+color por concepto y lo
// reconozca en todas partes (alineación, HUD del partido, entrenos,
// mercado...), en vez de que cada pantalla invente el suyo.

// --- superficies y texto ---
export const UI = {
  bg: '#0b0e14',
  panel: '#10151f',       // relleno de paneles (box)
  panelHi: '#161d2b',     // panel destacado / hover
  panelDeep: '#0c1018',   // hundido (listas, pistas)
  edge: '#8a7f66',        // borde de panel por defecto
  edgeDim: '#4a4538',
  text: '#e8e0c8',
  textDim: '#9a9484',     // ~6:1 sobre el fondo (antes #8a8474)
  textFaint: '#7a7466',   // ~4:1: pistas y ayudas siguen legibles (antes #5a5448, ~2.5:1)
  accent: '#ffb347',      // ámbar: lo interactivo / seleccionado
  accentHi: '#ffe680',
  focusBg: '#3a2a10',     // fondo de lo seleccionado
};

// --- bandos y estados ---
export const TONE = {
  player: '#4fc3f7',  // tú, tus bolas, tu peña
  rival: '#ef7676',   // el rival
  jack: '#ffe14d',    // el boliche
  good: '#7ec850',
  warn: '#ffe14d',
  bad: '#ff5c5c',
  info: '#88c8e8',
  money: '#7ec850',
  xp: '#c9a8e8',
  gold: '#ffd24a',
};

// --- las 5 stats: glifo + color + qué hace EN el partido (el tooltip de
// cualquier pantalla debería poder decir esto mismo) ---
export const STAT = {
  pulso:   { glyph: '◎', color: '#6fd6e8', short: 'PUL', label: 'Pulso',   does: 'menos temblor al apuntar' },
  brazo:   { glyph: '➤', color: '#ff8c5b', short: 'BRA', label: 'Brazo',   does: 'más alcance y potencia' },
  mana:    { glyph: '∿', color: '#c9a8e8', short: 'MAÑ', label: 'Maña',    does: 'más efecto y guía más larga' },
  temple:  { glyph: '♥', color: '#ff7aa2', short: 'TEM', label: 'Temple',  does: 'aguanta la presión y la barra va más lenta' },
  aguante: { glyph: '◆', color: '#7ec850', short: 'AGU', label: 'Aguante', does: 'se cansa menos entre partidos' },
};

// color de un valor de stat 1..10 (para cifras sueltas)
export function statValueColor(v) {
  return v >= 9 ? '#ffe680' : v >= 7 ? '#b8e07a' : v >= 5 ? '#e8e0c8' : v >= 3 ? '#d8a070' : '#ff7a6a';
}

// --- clima: qué cambia en la pista (chips del HUD y de la alineación) ---
export const WEATHER_FX = {
  SOL: [],
  LLUVIA: ['rueda menos (×1.35 roce)', 'bolas lejanas difusas'],
  VIENTO: ['viento fuerte en el vuelo', 'rachas en cada tiro'],
  CALOR: ['cansa entre manos'],
  NIEBLA: ['boliche y bolas lejanas se pierden'],
  HELADA: ['rueda mucho más (roce ×0.4)'],
  TORMENTA: ['viento muy fuerte', 'rueda menos', 'visibilidad baja'],
};

// --- tipos de tiro (Fase 3: selector del partido) ---
export const SHOT = {
  arrimar:  { glyph: '◡', color: '#88e088', label: 'ARRIMAR',     role: 'apuntar',  loft: 0.32, hint: 'bajo y rodado: se acerca al boliche' },
  media:    { glyph: '◠', color: '#b8e07a', label: 'MEDIA VOLEA', role: 'apuntar',  loft: 0.6,  hint: 'medio arco: cae cerca y rueda poco' },
  bombeo:   { glyph: '⌒', color: '#ffe680', label: 'BOMBEO',      role: 'apuntar',  loft: 0.95, hint: 'globo alto: cae muerta donde apuntas' },
  tirar:    { glyph: '➶', color: '#ff8c5b', label: 'TIRAR',       role: 'tirar',    loft: 0.34, hint: 'tenso y fuerte: saca la bola rival' },
};

// --- utilidades de color ---
function parse(hex) {
  const h = hex.replace('#', '');
  const f = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [parseInt(f.slice(0, 2), 16), parseInt(f.slice(2, 4), 16), parseInt(f.slice(4, 6), 16)];
}
const toHex = (r, g, b) => `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;

// mezcla lineal a→b (t = 0..1)
export function mix(a, b, t) {
  const A = parse(a), B = parse(b);
  return toHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}
// fondo oscuro teñido de un color (insignias, selección)
export function tint(color, k = 0.22) { return mix(UI.bg, color, k); }
// desaturar hacia gris (p.ej. retrato de un abuelo cansado)
export function desaturate(hex, k) {
  const [r, g, b] = parse(hex);
  const l = r * 0.3 + g * 0.59 + b * 0.11;
  return toHex(r + (l - r) * k, g + (l - g) * k, b + (l - b) * k);
}
