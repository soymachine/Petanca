import { hitRect } from '../core/utils.js';

// Barra de pestañas compartida por (casi) todas las pantallas del juego,
// incluida la portada, para que el menú esté siempre a mano.
export class TabsBar {
  static TABS = [
    { id: 'hub', label: ' [1]INICIO ' },
    { id: 'agenda', label: ' [2]AGENDA ' },
    { id: 'penya', label: ' [3]MI PEÑA ' },
    { id: 'club', label: ' [4]EL CLUB ' },
    { id: 'leaguemap', label: ' [5]LIGAS ' },
    { id: 'bar', label: ' [6]EL BAR ' },
    { id: 'capitulos', label: ' [7]CAPÍTULOS ' },
    { id: 'hemeroteca', label: ' [8]HEMEROTECA ' },
    { id: 'ayuda', label: ' [9]AYUDA ' },
  ];

  static draw(game, active) {
    const { screen, input } = game;
    let x = 4;
    screen.put(2, 1, '║', '#8a7f66');
    const rects = [];
    for (const t of TabsBar.TABS) {
      const on = t.id === active;
      const w = t.label.length + 2;
      const over = hitRect(input.mouse.cx, input.mouse.cy, x, 0, w, 3);
      rects.push({ id: t.id, x, w });
      const col = on ? '#ffb347' : over ? '#c9a35d' : '#5a5347';
      const labelCol = on ? '#ffe680' : over ? '#ffe680' : '#8a7f66';
      screen.text(x, 0, '┌' + '─'.repeat(t.label.length) + '┐', col);
      screen.text(x, 1, '│', col);
      screen.text(x + 1, 1, t.label, labelCol);
      screen.text(x + 1 + t.label.length, 1, '│', col);
      screen.text(x, 2, on ? '┘' + ' '.repeat(t.label.length) + '└' : '┴' + '─'.repeat(t.label.length) + '┴', col);
      x += t.label.length + 1;
    }
    for (let i = x + 1; i < screen.cols - 2; i++) screen.put(i, 2, '─', '#5a5347');
    screen.text(x + 2, 1, `${game.player.money}€`, '#8a7f66');

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
