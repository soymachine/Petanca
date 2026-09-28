import { Settings } from '../core/Settings.js';
import { Audio } from '../core/Audio.js';
import { hitRect } from '../core/utils.js';
import { UI, TONE, tint } from '../ui/theme.js';
import { panel, titleBand, button } from '../ui/widgets.js';

// Ajustes visuales dentro del juego (docs/REDISENO.md, Fase 5): lo que
// antes solo se tocaba con F7/F8. Se abre con F9 desde cualquier pantalla
// (menos en pleno partido), desde la Portada y desde Ayuda, y vuelve a la
// pantalla de la que se vino. Todo se aplica al momento y se guarda en el
// navegador (core/Settings.js), no en la partida.
const OPTIONS = [
  { key: 'matchView', label: 'Vista del partido', kind: 'choice', values: [['arcade', 'ARCADE'], ['clasica', 'CLÁSICA']],
    desc: 'arcade: en perspectiva, detrás del lanzador · clásica: desde arriba (F7)' },
  { key: 'sound', label: 'Sonido', desc: 'choques de bolas, albero, clics y fanfarrias (sintetizados, sin archivos)' },
  { key: 'volume', label: 'Volumen', kind: 'choice', values: [[0.25, '25%'], [0.5, '50%'], [0.75, '75%'], [1, '100%']],
    desc: 'volumen general de los sonidos' },
  { key: 'bloom', label: 'Resplandor', desc: 'brillo suave alrededor de lo luminoso (F8 junto con las líneas)' },
  { key: 'scanlines', label: 'Líneas CRT', desc: 'líneas de barrido muy tenues, como una tele de tubo' },
  { key: 'shake', label: 'Sacudidas', desc: 'la pantalla tiembla con los golpes fuertes (carreau, choques)' },
  { key: 'transitions', label: 'Transiciones', desc: 'barrido al cambiar de pantalla' },
  { key: 'reduceMotion', label: 'Reducir movimiento', desc: 'apaga sacudidas, transiciones, destellos y animaciones grandes' },
  { key: 'fps', label: 'Contador de FPS', kind: 'game', desc: 'fotogramas por segundo en la esquina (F3)' },
  { key: 'fullscreen', label: 'Pantalla completa', kind: 'action', desc: 'ocupa todo el monitor (F11)' },
];
const X = 20, W = 100, Y0 = 8, ROW_H = 3;

export class AjustesScreen {
  constructor(game) { this.game = game; this.cursor = 0; this.returnTo = 'title'; }

  open(from) {
    if (from && from !== 'ajustes') this.returnTo = from;
    this.game.state = 'ajustes';
  }

  _value(opt) {
    if (opt.kind === 'game') return !!this.game.showFps;
    if (opt.kind === 'action') return typeof document !== 'undefined' && !!document.fullscreenElement;
    return Settings.get(opt.key);
  }

  _toggle(opt, dir = 1) {
    const { game } = this;
    Audio.play('click');
    if (opt.kind === 'choice') {
      const vals = opt.values.map(([v]) => v);
      const k = (vals.indexOf(Settings.get(opt.key)) + (dir > 0 ? 1 : vals.length - 1)) % vals.length;
      Settings.set(opt.key, vals[k]);
      if (opt.key === 'matchView') game.arcadeMatch = vals[k] === 'arcade';
    } else if (opt.kind === 'game') game.showFps = !game.showFps;
    else if (opt.kind === 'action') {
      if (typeof document === 'undefined') return;
      if (document.fullscreenElement) document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
    } else Settings.toggle(opt.key);
  }

  draw() {
    const { screen, input, fx } = this.game;
    screen.clear();
    titleBand(screen, 'AJUSTES', { y: 2, right: 'se guardan en este navegador', rightColor: UI.textDim });

    const h = OPTIONS.length * ROW_H + 3;
    panel(screen, X, Y0 - 1, W, h, { tone: UI.edge });
    let clicked = null;
    OPTIONS.forEach((opt, i) => {
      const y = Y0 + i * ROW_H;
      const sel = i === this.cursor;
      const over = hitRect(input.mouse.cx, input.mouse.cy, X + 1, y, W - 2, 2);
      if (sel || over) screen.fill(X + 1, y, W - 2, 2, sel ? tint(UI.accent, 0.16) : UI.panelHi);
      if (sel) { screen.put(X + 1, y, '▌', UI.accent); screen.put(X + 1, y + 1, '▌', UI.accent); }
      screen.text(X + 4, y, opt.label, sel ? UI.accentHi : UI.text);
      screen.text(X + 4, y + 1, opt.desc, UI.textDim);
      // interruptor / selector a la derecha
      const sx = X + W - 22;
      if (opt.kind === 'choice') {
        const cw = opt.values.reduce((n, [, label]) => n + label.length + 3, 0);
        let cx = Math.min(sx, X + W - 2 - cw);
        for (const [v, label] of opt.values) {
          const on = Settings.get(opt.key) === v;
          screen.fill(cx, y, label.length + 2, 1, on ? tint(TONE.good, 0.35) : '#141a24');
          screen.text(cx + 1, y, label, on ? '#eaffd8' : UI.textDim);
          cx += label.length + 3;
        }
      } else if (opt.kind === 'action') {
        screen.fill(sx, y, 12, 1, '#141a24');
        screen.text(sx + 1, y, this._value(opt) ? 'SALIR' : 'ACTIVAR', UI.accent);
      } else {
        const on = this._value(opt);
        screen.fill(sx, y, 10, 1, on ? tint(TONE.good, 0.35) : tint(TONE.bad, 0.2));
        screen.text(sx + 1, y, on ? '● SÍ' : '○ NO', on ? '#eaffd8' : '#ffb0b0');
      }
      if (over && input.mouse.clicked) { this.cursor = i; clicked = opt; }
    });

    // probar efectos al momento
    const by = Y0 + OPTIONS.length * ROW_H + 3;
    if (button(this.game, X, by, 'PROBAR EFECTOS', { hotkey: 'T', w: 26 })) {
      Audio.play('clack');
      fx.shake(0.8);
      fx.burst(70, by - 6, { n: 40, colors: [TONE.gold, '#ff8c5b', '#fff3c4'], speed: 16 });
      fx.banner('¡CARREAU!', TONE.gold, { sub: 'así se ven los momentos fuertes' });
    }
    if (button(this.game, X + W - 26, by, 'VOLVER', { hotkey: 'ESC', w: 26, tone: TONE.good })) this.game.state = this.returnTo;
    screen.textCenter(45, '↑↓ elegir · ENTER / ESPACIO / ←→ cambiar · clic · ESC volver', UI.textFaint);

    const n = OPTIONS.length;
    if (input.hit('ArrowUp')) this.cursor = (this.cursor + n - 1) % n;
    if (input.hit('ArrowDown')) this.cursor = (this.cursor + 1) % n;
    if (clicked) this._toggle(clicked);
    else if (input.hit('Enter') || input.hit(' ') || input.hit('ArrowRight')) this._toggle(OPTIONS[this.cursor], 1);
    else if (input.hit('ArrowLeft')) this._toggle(OPTIONS[this.cursor], -1);
    if (input.hit('Escape')) { input.pressed.Escape = false; this.game.state = this.returnTo; }
  }
}
