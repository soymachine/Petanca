import { hitRect } from '../core/utils.js';
import { UI, TONE, tint } from '../ui/theme.js';

// Barra de navegación compartida por (casi) todas las pantallas del juego
// (filas 0-2). Rediseño Neo-ASCII (docs/REDISENO.md, Fase 2): franja de
// cabecera con fondo propio, un icono por sección, la activa resaltada con
// fondo teñido, brillo y subrayado grueso; el dinero como insignia a la
// derecha. Mismas teclas 1-9 / Tab / Esc de siempre.
const HEADER_BG = '#141b28';

export class TabsBar {
  static TABS = [
    { id: 'hub', key: '1', icon: '⌂', label: 'INICIO' },
    { id: 'agenda', key: '2', icon: '☰', label: 'AGENDA' },
    { id: 'penya', key: '3', icon: '☺', label: 'MI PEÑA' },
    { id: 'club', key: '4', icon: '♜', label: 'EL CLUB' },
    { id: 'leaguemap', key: '5', icon: '★', label: 'LIGAS' },
    { id: 'bar', key: '6', icon: '⚑', label: 'EL BAR' },
    { id: 'capitulos', key: '7', icon: '✦', label: 'HISTORIA' },
    { id: 'hemeroteca', key: '8', icon: '✉', label: 'HEMEROTECA' },
    { id: 'ayuda', key: '9', icon: '?', label: 'AYUDA' },
  ];

  static draw(game, active) {
    const { screen, input } = game;
    screen.fill(0, 0, screen.cols, 3, HEADER_BG);
    for (let i = 0; i < screen.cols; i++) screen.put(i, 2, '─', UI.edgeDim);
    let x = 2;
    const rects = [];
    for (const t of TabsBar.TABS) {
      const on = t.id === active;
      const w = t.label.length + 7;
      const over = hitRect(input.mouse.cx, input.mouse.cy, x, 0, w, 3);
      rects.push({ id: t.id, x, w });
      const bg = on ? tint(UI.accent, 0.26) : over ? tint(UI.accent, 0.12) : HEADER_BG;
      screen.fill(x, 0, w, 3, bg);
      screen.text(x + 1, 1, t.key, on ? UI.accent : UI.textFaint);
      screen.put(x + 3, 1, t.icon, on ? UI.accentHi : over ? UI.accent : UI.textDim);
      screen.text(x + 5, 1, t.label, on ? UI.accentHi : over ? UI.text : UI.textDim);
      if (on) {
        screen.glow(x + 3, 1, t.label.length + 2, 1);
        for (let i = 0; i < w; i++) screen.put(x + i, 2, '▀', UI.accent);
      } else if (over) {
        for (let i = 0; i < w; i++) screen.put(x + i, 2, '▀', UI.edge);
      }
      x += w + 1;
    }
    // dinero como insignia a la derecha
    const money = `${game.player.money}€`;
    const mx = Math.max(x + 1, screen.cols - money.length - 4);
    const mcol = game.player.money < 0 ? TONE.bad : TONE.money;
    screen.fill(mx, 0, money.length + 2, 3, tint(mcol, 0.16));
    screen.text(mx + 1, 1, money, mcol);

    // modo Debugger simulando: indicador visible (y parable) desde
    // cualquier pantalla, no solo desde Inicio — para poder mirar ligas y
    // Mercado mientras los días siguen pasando solos en segundo plano
    let simRect = null;
    if (game.simulating) {
      const label = ' ● SIMULANDO — [X] Detener ';
      const sx = screen.cols - label.length - 3;
      simRect = { x: sx, y: 0, w: label.length, h: 3 };
      const over = hitRect(input.mouse.cx, input.mouse.cy, sx, 0, label.length, 3);
      screen.text(sx, 1, label, over ? '#ffe680' : '#ffb347');
    }

    if (input.mouse.clicked) {
      if (simRect && hitRect(input.mouse.cx, input.mouse.cy, simRect.x, simRect.y, simRect.w, simRect.h)) {
        game.stopSimulating();
      } else {
        const hit = rects.find((r) => hitRect(input.mouse.cx, input.mouse.cy, r.x, 0, r.w, 3));
        if (hit) game.state = hit.id;
      }
    }
    if (game.simulating && (input.hit('x') || input.hit('X'))) game.stopSimulating();

    if (input.hit('1')) game.state = 'hub';
    if (input.hit('2')) game.state = 'agenda';
    if (input.hit('3')) game.state = 'penya';
    if (input.hit('4')) game.state = 'club';
    if (input.hit('5')) game.state = 'leaguemap';
    if (input.hit('6')) game.state = 'bar';
    if (input.hit('7')) game.state = 'capitulos';
    if (input.hit('8')) game.state = 'hemeroteca';
    if (input.hit('9')) game.state = 'ayuda';
    if (input.hit('Tab')) {
      const order = TabsBar.TABS.map((t) => t.id);
      game.state = order[(order.indexOf(active) + 1) % order.length];
    }
    if (input.hit('Escape')) game.state = 'hub';
  }
}
