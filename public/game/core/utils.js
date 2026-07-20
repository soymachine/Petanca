// Funciones puras compartidas por todo el juego.
export const rnd = (a, b) => a + Math.random() * (b - a);
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function gauss() {
  return (Math.random() + Math.random() + Math.random() + Math.random() - 2) / 2;
}

export function pickWeighted(weights) {
  const entries = Object.entries(weights);
  let tot = 0;
  for (const [, w] of entries) tot += w;
  let r = Math.random() * tot;
  for (const [k, w] of entries) {
    r -= w;
    if (r <= 0) return k;
  }
  return entries[0][0];
}

// distancia real corregida por el aspecto de celda (~1:2, ancho:alto)
export function dist2d(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = (ay - by) * 2;
  return Math.sqrt(dx * dx + dy * dy);
}

export function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// RNG determinista sembrada por texto, para el desafío diario y similares.
export function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

// Trunca (con elipsis) o rellena una cadena a un ancho exacto de columna.
export function truncate(s, w) {
  s = String(s ?? '');
  if (s.length <= w) return s;
  if (w <= 1) return s.slice(0, w);
  return s.slice(0, w - 1) + '…';
}

export function padCol(s, w, align = 'left') {
  s = truncate(s, w);
  const pad = ' '.repeat(Math.max(0, w - s.length));
  return align === 'right' ? pad + s : s + pad;
}

// Test de colisión punto-rectángulo en celdas de pantalla (para hover/click).
export function hitRect(mx, my, x, y, w, h) {
  return mx >= x && mx < x + w && my >= y && my < y + h;
}

// Fila de pestañas de sección clicable (el patrón "▶ NOMBRE ◀ / NOMBRE"
// repetido en Mi Peña, El Club, El Bar y Capítulos): dibuja cada pestaña,
// la resalta al pasar el ratón por encima y devuelve el índice pulsado
// este frame (o null). No sustituye el atajo de teclado, solo lo completa.
// `opts.disabled`: array paralelo a `labels` — una pestaña tapada (ver
// Player.systemsRevealed) se pinta apagada, no reacciona al hover y nunca
// devuelve clic.
export function drawTabRow(screen, input, x, y, labels, activeIndex, opts = {}) {
  const gap = opts.gap ?? 4;
  const disabled = opts.disabled || [];
  let cx = x;
  let clicked = null;
  for (let i = 0; i < labels.length; i++) {
    const isDisabled = !!disabled[i];
    const active = i === activeIndex;
    const text = active ? `▶ ${labels[i]} ◀` : `  ${labels[i]}  `;
    const over = !isDisabled && hitRect(input.mouse.cx, input.mouse.cy, cx, y, text.length, 1);
    const col = isDisabled ? (opts.disabledColor || '#5a5347')
      : active ? (opts.activeColor || '#ffe680')
      : over ? (opts.hoverColor || '#fff')
      : (opts.color || '#8a7f66');
    screen.text(cx, y, text, col);
    if (!isDisabled && over && input.mouse.clicked) clicked = i;
    cx += text.length + gap;
  }
  return clicked;
}

export function wrapText(s, w) {
  const words = s.split(' ');
  const lines = [];
  let cur = '';
  for (const word of words) {
    if ((cur + word).length > w) { lines.push(cur.trim()); cur = ''; }
    cur += word + ' ';
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines;
}
