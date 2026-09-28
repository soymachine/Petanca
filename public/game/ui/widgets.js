// Componentes de interfaz reutilizables (docs/REDISENO.md, Fase 2).
// Dibujan sobre la rejilla de Screen (celdas), con fondo por celda para
// que parezcan piezas de videojuego (paneles, botones) y no texto suelto.
// Los interactivos reciben `game` (screen + input) y devuelven true el
// frame en que se activan (clic o tecla), como el resto del juego.
import { UI, TONE, STAT, statValueColor, tint, mix } from './theme.js';
import { hitRect } from '../core/utils.js';

// panel: relleno + borde + título incrustado en el borde superior
// opaque: tapa por completo lo de debajo (texto y capas de píxeles), para
// modales y tooltips
export function panel(screen, x, y, w, h, { title = null, tone = UI.edge, fill = UI.panel, style = 'single', titleColor = UI.accent, glow = false, opaque = false } = {}) {
  if (opaque && screen.opaque) screen.opaque(x, y, w, h);
  screen.fill(x, y, w, h, fill);
  screen.box(x, y, w, h, tone, style);
  if (title) {
    const t = ` ${title} `;
    screen.text(x + 2, y, t, titleColor);
    screen.fill(x + 2, y, t.length, 1, fill);
    if (glow) screen.glow(x + 2, y, t.length, 1);
  }
}

// botón de una fila: "▌ [K] ETIQUETA ". Devuelve true si se activa.
// selected = marcado por teclado (cursor de lista); hover = ratón encima
export function button(game, x, y, label, { hotkey = null, tone = UI.accent, w = null, disabled = false, selected = false } = {}) {
  const { screen, input } = game;
  const text = hotkey ? `[${hotkey}] ${label}` : label;
  const width = w || text.length + 3;
  const over = !disabled && hitRect(input.mouse.cx, input.mouse.cy, x, y, width, 1);
  const hot = over || selected;
  const bg = disabled ? '#12151c' : hot ? tint(tone, 0.32) : tint(tone, 0.12);
  const fg = disabled ? UI.textFaint : hot ? mix(tone, '#ffffff', 0.35) : tone;
  screen.fill(x, y, width, 1, bg);
  screen.put(x, y, '▌', disabled ? UI.edgeDim : tone);
  screen.text(x + 2, y, text.slice(0, width - 3), fg);
  if (hot) screen.glow(x + 2, y, Math.min(text.length, width - 3), 1);
  if (disabled) return false;
  return (over && input.mouse.clicked) || (hotkey ? input.hit(hotkey.toLowerCase()) || input.hit(hotkey.toUpperCase()) : false);
}

// botón grande de 3 filas, 4 con subtítulo (acciones principales: "JUGAR",
// "AVANZAR DÍA")
export function bigButton(game, x, y, w, label, { hotkey = null, tone = UI.accent, sub = null, disabled = false, selected = false } = {}) {
  const { screen, input } = game;
  const h = sub ? 4 : 3;
  const over = !disabled && hitRect(input.mouse.cx, input.mouse.cy, x, y, w, h);
  const hot = over || selected;
  const pulse = hot ? 0.34 + Math.sin(game.frame * 0.12) * 0.06 : 0.14;
  const bg = disabled ? '#12151c' : tint(tone, pulse);
  screen.fill(x, y, w, h, bg);
  screen.box(x, y, w, h, disabled ? UI.edgeDim : tone, hot ? 'double' : 'single');
  const text = hotkey ? `${label}  [${hotkey}]` : label;
  const tx = x + Math.floor((w - text.length) / 2);
  screen.text(tx, y + 1, text, disabled ? UI.textFaint : hot ? '#ffffff' : tone);
  if (hot) screen.glow(tx, y + 1, text.length, 1);
  if (sub) screen.text(x + Math.max(1, Math.floor((w - sub.length) / 2)), y + 2, sub.slice(0, w - 2), hot ? UI.text : UI.textDim);
  if (disabled) return false;
  return (over && input.mouse.clicked) || (hotkey ? input.hit(hotkey) || input.hit(hotkey.toLowerCase()) : false);
}

// medidor horizontal suave (octavos de celda): value/max en w celdas
const EIGHTHS = ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉'];
export function meter(screen, x, y, w, value, max, { color = TONE.good, track = '#1c2230' } = {}) {
  const k = Math.max(0, Math.min(1, max ? value / max : 0));
  const cells = k * w;
  const full = Math.floor(cells);
  const rem = Math.round((cells - full) * 8);
  screen.fill(x, y, w, 1, track);
  for (let i = 0; i < w; i++) {
    if (i < full) screen.put(x + i, y, '█', color);
    else if (i === full && rem > 0) screen.put(x + i, y, EIGHTHS[rem], color);
    else screen.put(x + i, y, ' ', color);
  }
}

// medidor por segmentos (stamina, confianza): ▮ llenos / ▯ vacíos
export function segments(screen, x, y, n, filled, { color = TONE.good, empty = '#2a3040' } = {}) {
  for (let i = 0; i < n; i++) screen.put(x + i, y, '▮', i < filled ? color : empty);
}

// chip de stat "◎7": glifo en el color de la stat + valor. Devuelve ancho
export function statChip(screen, x, y, key, value, { label = false } = {}) {
  const s = STAT[key];
  let cx = x;
  screen.put(cx++, y, s.glyph, s.color);
  if (label) { screen.text(cx, y, s.short, s.color); cx += s.short.length; }
  const v = String(value);
  screen.text(cx, y, v, statValueColor(value));
  return cx + v.length - x;
}

// fila de stat con barra: "◎ Pulso   ███████░░░  7"
export function statBar(screen, x, y, key, value, { w = 10, labelW = 8, max = 10 } = {}) {
  const s = STAT[key];
  screen.put(x, y, s.glyph, s.color);
  screen.text(x + 2, y, s.label.padEnd(labelW - 1).slice(0, labelW - 1), UI.text);
  meter(screen, x + 1 + labelW, y, w, value, max, { color: s.color });
  screen.text(x + 2 + labelW + w, y, String(value).padStart(2), statValueColor(value));
}

// insignia / chip de estado: " TEXTO " sobre fondo teñido. Devuelve ancho
export function badge(screen, x, y, text, tone = UI.accent) {
  const t = ` ${text} `;
  screen.fill(x, y, t.length, 1, tint(tone, 0.28));
  screen.text(x, y, t, tone);
  return t.length;
}

// tooltip unificado: lines = ['texto' | [texto, color]], se recoloca
// dentro de la pantalla si se sale por la derecha/abajo
export function tooltip(screen, x, y, lines, { tone = UI.accent, title = null, minW = 0 } = {}) {
  const rows = lines.map((l) => (Array.isArray(l) ? l : [l, UI.text]));
  const w = Math.max(minW, title ? title.length + 4 : 0, ...rows.map(([t]) => t.length)) + 4;
  const h = rows.length + 2;
  const bx = Math.max(0, Math.min(x, screen.cols - w - 1));
  const by = Math.max(0, Math.min(y, screen.rows - h - 1));
  panel(screen, bx, by, w, h, { title, tone, fill: '#141a26', titleColor: tone, opaque: true });
  rows.forEach(([t, c], i) => screen.text(bx + 2, by + 1 + i, t, c));
  return { x: bx, y: by, w, h };
}

// banda de título de una pantalla de gestión (debajo de la barra de
// pestañas): título grande en píxeles a la izquierda y, opcional, un texto
// a la derecha. Ocupa las filas y..y+2
export function titleBand(screen, title, { y = 3, right = null, color = UI.accent, rightColor = UI.accentHi, x = 4 } = {}) {
  screen.fill(0, y, screen.cols, 3, '#0f1520');
  screen.layer('over', (c, R) => {
    c.textBaseline = 'middle'; c.textAlign = 'left';
    c.font = `bold ${R.ch * 1.5}px "Menlo", "Consolas", "DejaVu Sans Mono", monospace`;
    c.fillStyle = color; c.shadowColor = color; c.shadowBlur = R.ch * 0.5;
    c.fillText(title, R.cx(x), R.cy(y + 1.5));
    if (right) {
      c.font = `bold ${R.ch}px "Menlo", "Consolas", "DejaVu Sans Mono", monospace`;
      c.textAlign = 'right'; c.fillStyle = rightColor; c.shadowColor = rightColor;
      c.fillText(right, R.cx(screen.cols - x), R.cy(y + 1.5));
    }
    c.shadowBlur = 0;
  });
  // ancho aproximado que ocupa el título, para colocar cosas a su derecha
  return Math.ceil(title.length * 1.5 / 0.56 * 0.6) + x;
}
