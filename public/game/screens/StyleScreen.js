// Hoja de estilo viva (docs/REDISENO.md, Fase 2): muestra el código
// visual del juego — colores, stats, clima, tipos de tiro — y todos los
// componentes de ui/widgets.js. No es parte del juego: se abre con
// ?scene=estilo para revisar el sistema visual de un vistazo (y
// capturarlo con tools/shots.mjs). [ESC] vuelve al inicio.
import { UI, TONE, STAT, SHOT, WEATHER_FX } from '../ui/theme.js';
import { panel, button, bigButton, meter, segments, statChip, statBar, badge, tooltip } from '../ui/widgets.js';
import { CLIMAS } from '../data/climas.js';

export class StyleScreen {
  constructor(game) { this.game = game; this.sel = 1; }

  draw() {
    const { screen, input, fx } = this.game;
    screen.clear();
    screen.textCenter(1, 'PETANKA · CÓDIGO VISUAL NEO-ASCII', UI.accentHi);
    screen.glow(Math.floor((screen.cols - 33) / 2), 1, 33, 1);

    // --- colores ---
    panel(screen, 2, 3, 44, 13, { title: 'COLORES' });
    let y = 5;
    for (const [k, v] of Object.entries(TONE)) {
      screen.fill(4, y, 3, 1, v);
      screen.text(8, y, `${k.padEnd(8)} ${v}`, v);
      y++;
    }

    // --- stats ---
    panel(screen, 48, 3, 44, 13, { title: 'LAS 5 STATS', tone: '#6fd6e8', titleColor: '#6fd6e8' });
    y = 5;
    const demo = { pulso: 8, brazo: 5, mana: 3, temple: 10, aguante: 6 };
    for (const k of Object.keys(STAT)) { statBar(screen, 50, y, k, demo[k], { w: 12 }); y++; }
    y++;
    let x = 50;
    for (const k of Object.keys(STAT)) x += statChip(screen, x, y, k, demo[k]) + 2;
    screen.text(50, y + 2, 'glifo + color fijos en todo el juego', UI.textDim);

    // --- clima ---
    panel(screen, 94, 3, 44, 13, { title: 'CLIMA → QUÉ CAMBIA', tone: '#9fd8e8', titleColor: '#9fd8e8' });
    y = 5;
    for (const [k, c] of Object.entries(CLIMAS)) {
      screen.text(96, y, `${c.icon} ${c.label}`.padEnd(16).slice(0, 16), c.color);
      const eff = (WEATHER_FX[k] || []).join(' · ') || 'sin efecto';
      screen.text(113, y, eff.slice(0, 23), UI.textDim);
      y++;
    }

    // --- botones ---
    panel(screen, 2, 17, 44, 12, { title: 'BOTONES' });
    const labels = ['JUGAR JORNADA', 'ENTRENAR', 'FICHAR', 'NO DISPONIBLE'];
    labels.forEach((l, i) => {
      if (button(this.game, 4, 19 + i * 1, l, { hotkey: String(i + 1), selected: i === this.sel, disabled: i === 3, w: 22 })) this.sel = i;
    });
    button(this.game, 28, 19, 'PELIGRO', { tone: TONE.bad, w: 14 });
    button(this.game, 28, 21, 'CONFIRMAR', { tone: TONE.good, w: 14 });
    if (bigButton(this.game, 4, 24, 40, '▶ AVANZAR DÍA', { hotkey: 'Enter', sub: 'domingo: jornada 3 vs CLUB EL CASINO' })) fx.flash('#ffe14d', 0.2);

    // --- medidores ---
    panel(screen, 48, 17, 44, 12, { title: 'MEDIDORES', tone: TONE.good, titleColor: TONE.good });
    const t = (this.game.frame % 240) / 240;
    screen.text(50, 19, 'confianza', UI.textDim); meter(screen, 62, 19, 20, 60, 100, { color: TONE.good }); screen.text(83, 19, '60', TONE.good);
    screen.text(50, 21, 'potencia', UI.textDim); meter(screen, 62, 21, 20, t, 1, { color: '#ff8c5b' });
    screen.text(50, 23, 'stamina', UI.textDim); segments(screen, 62, 23, 10, 7, { color: TONE.good });
    screen.text(50, 25, 'cansado', UI.textDim); segments(screen, 62, 25, 10, 2, { color: TONE.bad });
    screen.text(50, 27, 'xp', UI.textDim); meter(screen, 62, 27, 20, 37, 50, { color: TONE.xp });

    // --- tipos de tiro ---
    panel(screen, 94, 17, 44, 12, { title: 'TIPOS DE TIRO (partido)', tone: '#ffe680', titleColor: '#ffe680' });
    y = 19;
    for (const s of Object.values(SHOT)) {
      screen.text(96, y, `${s.glyph} ${s.label}`, s.color);
      screen.text(111, y, s.hint.slice(0, 25), UI.textDim);
      y += 2;
    }

    // --- insignias y tooltip ---
    panel(screen, 2, 30, 90, 14, { title: 'INSIGNIAS · TOOLTIP · EFECTOS' });
    x = 4;
    for (const [txt, tone] of [['NÉMESIS', TONE.bad], ['DERBI', '#ff9c5b'], ['FINAL', TONE.gold], ['EN FORMA', TONE.good], ['LESIONADO', TONE.bad], ['NUEVO', TONE.info]]) {
      x += badge(screen, x, 32, txt, tone) + 1;
    }
    tooltip(screen, 4, 34, [
      ['PACO · 71 años', UI.text],
      ['◎ Pulso 8 — menos temblor al apuntar', STAT.pulso.color],
      ['♥ Temple 10 — aguanta la presión', STAT.temple.color],
      ['moral +4 · stamina 70%', TONE.good],
    ], { title: 'TOOLTIP', tone: UI.accent });
    screen.text(50, 34, '[F] rótulo · [B] chispas · [S] sacudida', UI.textDim);
    if (input.hit('f') || input.hit('F')) fx.banner('¡CARREAU!', TONE.gold, { sub: 'la tuya se queda donde estaba la del rival' });
    if (input.hit('b') || input.hit('B')) fx.burst(70, 38, { n: 40, colors: [TONE.gold, '#ff8c5b', '#fff3c4'], speed: 16 });
    if (input.hit('s') || input.hit('S')) fx.shake(1);

    panel(screen, 94, 30, 44, 14, { title: 'PANEL DESTACADO', tone: UI.accent, fill: UI.panelHi, style: 'double', glow: true });
    screen.text(96, 32, 'relleno + borde doble + título', UI.text);
    screen.text(96, 33, 'con resplandor: lo que importa', UI.text);
    screen.text(96, 34, 'ahora mismo en la pantalla', UI.text);

    screen.textCenter(45, '[ESC] volver', UI.textDim);
    if (input.hit('Escape')) this.game.state = 'hub';
  }
}
