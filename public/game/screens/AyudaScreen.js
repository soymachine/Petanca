import { TabsBar } from './TabsBar.js';
import { HELP_TOPICS } from '../data/helpTopics.js';
import { CLIMAS } from '../data/climas.js';
import { STAT_KEYS } from '../data/abuelos.js';
import { hitRect, truncate } from '../core/utils.js';
import { UI, TONE, STAT, SHOT, WEATHER_FX } from '../ui/theme.js';
import { panel, titleBand, meter, button } from '../ui/widgets.js';

// dos páginas "dibujadas" (no solo texto) delante de las de siempre: los
// controles del partido arcade y el código visual de todo el juego
const TOPICS = [
  { id: 'controles', title: 'EL PARTIDO: CONTROLES' },
  { id: 'codigo', title: 'EL CÓDIGO DE COLORES' },
  ...HELP_TOPICS.map((t) => ({ id: 'texto', ...t })),
];
const SIDE_X = 4, SIDE_W = 34, BOX_Y = 7, BOX_H = 37, BODY_X = 40, BODY_W = 96;

// Enciclopedia in-game (docs/REDISENO.md, Fase 4): índice de temas a la
// izquierda (clic o ↑↓/←→) y el tema a la derecha. Las dos primeras
// páginas enseñan con los mismos glifos y colores que se ven en el juego.
export class AyudaScreen {
  constructor(game) { this.game = game; this.page = 0; }

  draw() {
    const { screen, input, player } = this.game;
    screen.clear();
    // visitar Ayuda una vez apaga el aviso de bienvenida de Inicio (ver
    // HubScreen) — no hace falta esperar a que pase la primera semana
    if (!player.helpHintSeen) { player.helpHintSeen = true; player.save(); }
    TabsBar.draw(this.game, 'ayuda');
    titleBand(screen, 'CÓMO SE JUEGA', { right: `tema ${this.page + 1} / ${TOPICS.length}`, rightColor: UI.textDim });

    // índice
    panel(screen, SIDE_X, BOX_Y, SIDE_W, BOX_H, { title: 'TEMAS', tone: UI.edge });
    TOPICS.forEach((t, i) => {
      const y = BOX_Y + 2 + i * 2;
      if (y >= BOX_Y + BOX_H - 1) return;
      const sel = i === this.page;
      const over = hitRect(input.mouse.cx, input.mouse.cy, SIDE_X + 1, y, SIDE_W - 2, 1);
      if (sel || over) screen.fill(SIDE_X + 1, y, SIDE_W - 2, 1, sel ? '#3a2a10' : '#1e2636');
      screen.put(SIDE_X + 2, y, sel ? '▶' : '·', sel ? UI.accent : UI.textFaint);
      screen.text(SIDE_X + 4, y, truncate(t.title, SIDE_W - 6), sel ? UI.accentHi : i < 2 ? TONE.info : UI.text);
      if (over && input.mouse.clicked) this.page = i;
    });

    if (button(this.game, SIDE_X + 2, BOX_Y + BOX_H - 2, '[F9] AJUSTES', { w: SIDE_W - 4, tone: TONE.info })) this.game.screens.ajustes.open('ayuda');

    // el tema
    const topic = TOPICS[this.page];
    panel(screen, BODY_X, BOX_Y, BODY_W, BOX_H, { title: topic.title, tone: UI.accent, titleColor: UI.accentHi, style: 'double' });
    const x = BODY_X + 3, y = BOX_Y + 2;
    if (topic.id === 'controles') this._drawControls(x, y);
    else if (topic.id === 'codigo') this._drawCode(x, y);
    else topic.body.forEach((line, i) => screen.text(x, y + i, line, UI.text));

    screen.textCenter(45, '↑↓ / ←→ cambiar de tema · clic en el índice · [1] inicio', UI.textFaint);

    const n = TOPICS.length;
    if (input.hit('ArrowLeft') || input.hit('ArrowUp')) this.page = (this.page + n - 1) % n;
    if (input.hit('ArrowRight') || input.hit('ArrowDown')) this.page = (this.page + 1) % n;
  }

  _section(x, y, label) {
    const { screen } = this.game;
    screen.text(x, y, label, UI.accent);
    screen.text(x + label.length + 1, y, '─'.repeat(Math.max(0, BODY_W - 7 - label.length)), UI.edgeDim);
  }

  _drawControls(x, y) {
    const { screen } = this.game;
    const row = (yy, key, what, col = UI.accentHi) => { screen.text(x + 2, yy, key, col); screen.text(x + 26, yy, what, UI.text); };
    this._section(x, y, 'CON RATÓN O DEDO');
    row(y + 2, 'mover sobre la pista', 'apuntas: la retícula va donde señalas');
    row(y + 3, 'mantener pulsado', 'arranca la barra de potencia');
    row(y + 4, 'soltar', 'lanzas — suelta dentro del tramo dorado para el tiro perfecto');
    row(y + 5, 'rueda', 'efecto a izquierda / derecha');
    row(y + 6, 'clic en las fichas', 'eliges el tipo de tiro (abajo en la pantalla del partido)');
    this._section(x, y + 8, 'CON TECLADO');
    row(y + 10, '↑ ↓', 'apuntar');
    row(y + 11, '← →', 'efecto');
    row(y + 12, 'TAB', 'cambiar el tipo de tiro');
    row(y + 13, 'ENTER / ESPACIO', 'empezar la potencia y, otra vez, lanzar');
    row(y + 14, 'ESC', 'cancelar la potencia y volver a apuntar');
    this._section(x, y + 16, 'TIPOS DE TIRO');
    let yy = y + 18;
    for (const k of Object.keys(SHOT)) {
      const s = SHOT[k];
      screen.text(x + 2, yy, s.glyph, s.color);
      screen.text(x + 5, yy, s.label, s.color);
      screen.text(x + 26, yy, s.hint, UI.text);
      yy++;
    }
    this._section(x, y + 23, 'SIEMPRE');
    row(y + 25, 'F7', 'vista del partido: arcade (perspectiva) o clásica (cenital)', TONE.info);
    row(y + 26, 'F8', 'efectos CRT (resplandor y líneas)', TONE.info);
    row(y + 27, 'F11', 'pantalla completa', TONE.info);
    row(y + 28, '1 … 9', 'saltar entre pantallas de gestión', TONE.info);
    screen.text(x + 2, y + 31, 'El Pulso hace temblar menos la retícula, la Maña alarga la guía de la trayectoria,', UI.textDim);
    screen.text(x + 2, y + 32, 'el Temple frena la barra en los momentos de presión y el Brazo da alcance.', UI.textDim);
  }

  _drawCode(x, y) {
    const { screen } = this.game;
    this._section(x, y, 'LAS 5 STATS — el mismo glifo y color en todo el juego');
    STAT_KEYS.forEach((k, i) => {
      const s = STAT[k];
      const yy = y + 2 + i;
      screen.text(x + 2, yy, s.glyph, s.color);
      screen.text(x + 4, yy, s.label, s.color);
      meter(screen, x + 14, yy, 10, 4 + i, 10, { color: s.color });
      screen.text(x + 26, yy, s.does, UI.text);
    });
    this._section(x, y + 8, 'EL CLIMA — qué cambia en la pista');
    let yy = y + 10;
    for (const [id, cl] of Object.entries(CLIMAS)) {
      screen.text(x + 2, yy, cl.icon, cl.color);
      screen.text(x + 4, yy, cl.label, cl.color);
      screen.text(x + 26, yy, (WEATHER_FX[id] && WEATHER_FX[id].length ? WEATHER_FX[id].join(' · ') : 'sin efecto'), UI.text);
      yy++;
    }
    this._section(x, y + 18, 'SÍMBOLOS');
    const sym = [
      ['✚', TONE.good, 'a ese abuelo le va el clima de hoy', '▼', TONE.bad, 'ese clima le afecta el doble'],
      ['♥', '#ff8fc0', 'vínculo fuerte con un compañero', '♡', '#a8e8c8', 'vínculo que empieza'],
      ['▲', '#a8e8a8', 'stat subida entrenando', '★', TONE.gold, 'tu club / el mejor del partido'],
      ['◉', TONE.good, 'partido de liga (Agenda)', '♛', TONE.gold, 'Copa de España'],
      ['✪', '#6fb8ff', 'Copa de Europa', '✎', '#9ad0c0', 'entreno agendado'],
    ];
    sym.forEach(([g1, c1, t1, g2, c2, t2], i) => {
      const yy2 = y + 20 + i;
      screen.text(x + 2, yy2, g1, c1); screen.text(x + 5, yy2, t1, UI.text);
      screen.text(x + 46, yy2, g2, c2); screen.text(x + 49, yy2, t2, UI.text);
    });
    this._section(x, y + 26, 'COLORES');
    const cols = [[TONE.player, 'tú / tus bolas'], [TONE.rival, 'el rival'], [TONE.jack, 'el boliche'], [TONE.money, 'dinero'], [TONE.xp, 'experiencia'], [UI.accent, 'lo que se puede pulsar']];
    let cx = x + 2;
    cols.forEach(([c, t], i) => {
      if (i === 3) cx = x + 2;
      const yy2 = y + 28 + (i >= 3 ? 1 : 0);
      screen.fill(cx, yy2, 2, 1, c);
      screen.text(cx + 3, yy2, t, UI.text);
      cx += t.length + 8;
    });
  }
}
