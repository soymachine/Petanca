import { CITIES, RIVALS, cityReward } from '../data/cities.js';
import { CLIMAS } from '../data/climas.js';
import { TARGET } from '../physics/constants.js';
import { todayStr } from '../core/utils.js';
import { Tournament } from '../model/Tournament.js';
import { TabsBar } from './TabsBar.js';

export class MapScreen {
  constructor(game) {
    this.game = game;
    this.cursor = 0;
    this.cam = null;
    this.view = { x: 3, y: 4, w: game.screen.cols - 6, h: 22 };
    this.mapEvent = null;
  }

  _camClamp() {
    const geo = this.game.geography;
    this.cam.x = Math.max(-8, Math.min(this.cam.x, Math.max(-8, geo.width + 8 - this.view.w)));
    this.cam.y = Math.max(-3, Math.min(this.cam.y, Math.max(-3, geo.height + 3 - this.view.h)));
  }
  _camCenterOn(c) {
    this.cam = { x: Math.round(c.wx - this.view.w / 2), y: Math.round(c.wy - this.view.h / 2) };
    this._camClamp();
  }
  _putV(x, y, ch, color) {
    if (x < this.view.x || x >= this.view.x + this.view.w || y < this.view.y || y >= this.view.y + this.view.h) return;
    this.game.screen.put(x, y, ch, color);
  }

  draw() {
    const { screen, input, player, frame, geography: geo } = this.game;
    screen.clear();
    TabsBar.draw(this.game, 'map');
    if (!this.cam) this._camCenterOn(CITIES[0]);

    const inView = input.mouse.cx >= this.view.x && input.mouse.cx < this.view.x + this.view.w &&
      input.mouse.cy >= this.view.y && input.mouse.cy < this.view.y + this.view.h;
    if (input.mouse.down && inView && (input.mouse.dx || input.mouse.dy)) {
      this.cam.x -= input.mouse.dx; this.cam.y -= input.mouse.dy;
      this._camClamp();
      input.mouse.dx = 0; input.mouse.dy = 0;
    }

    screen.box(this.view.x - 1, this.view.y - 1, this.view.w + 2, this.view.h + 2, '#4a5a6a');
    screen.text(this.view.x + 2, this.view.y - 1, '╡ MAPA DE ESPAÑA — arrastra para explorar ╞', '#ffb347');

    for (let r = 0; r < this.view.h; r++) {
      for (let c = 0; c < this.view.w; c++) {
        const wx = this.cam.x + c, wy = this.cam.y + r;
        const sx = this.view.x + c, sy = this.view.y + r;
        if (geo.isLand(wx, wy)) screen.put(sx, sy, geo.char[wy][wx], geo.color[wy][wx]);
        else if ((wx * 3 + wy * 7 + (frame >> 4)) % 29 === 0) screen.put(sx, sy, '~', '#2a5a7a');
      }
    }

    const cityScreen = [];
    for (let i = 0; i < CITIES.length; i++) {
      const c = CITIES[i];
      const locked = player.level < c.minLevel;
      const isSel = i === this.cursor;
      const col = locked ? '#555' : c.color;
      const sx = this.view.x + c.wx - this.cam.x;
      const sy = this.view.y + c.wy - this.cam.y;
      cityScreen.push({ i, sx, sy });
      this._putV(sx, sy, isSel && frame % 20 < 12 ? '◈' : '■', col);
      const label = c.name + (locked ? ` (niv.${c.minLevel})` : '');
      for (let k = 0; k < label.length; k++) this._putV(sx + 2 + k, sy, label[k], isSel ? '#fff' : (locked ? '#555' : col));
    }

    if (input.mouse.clicked && inView) {
      let best = null;
      for (const cs of cityScreen) {
        const d = Math.abs(cs.sx - input.mouse.cx) + Math.abs(cs.sy - input.mouse.cy) * 2;
        if (d < 12 && (!best || d < best.d)) best = { i: cs.i, d };
      }
      if (best) this.cursor = best.i;
    }

    const c = CITIES[this.cursor];
    const rew = cityReward(c);
    screen.box(4, 27, 62, 12, '#8a7f66');
    screen.text(7, 28, `TORNEO DE ${c.name} — 3 rondas a ${TARGET} puntos`, c.color);
    screen.text(7, 30, `Dificultad : ${'★'.repeat(c.diff)}${'☆'.repeat(8 - c.diff)}`, '#ffe14d');
    screen.text(7, 31, `Final vs   : ${RIVALS[c.diff - 1]} (nivel ${c.diff})`, '#ef9f9f');
    const climaTop = Object.entries(c.clima).sort((a, b) => b[1] - a[1])[0][0];
    screen.text(7, 32, `Clima típico: ${CLIMAS[climaTop].icon} ${CLIMAS[climaTop].label}`, CLIMAS[climaTop].color);
    screen.text(7, 33, `Pista      : ${c.feature.desc.slice(0, 46)}`, '#c9a35d');
    screen.text(7, 34, `Premio     : ${rew.xp} XP + ${rew.money}€ (menos si caes antes)`, '#7ec850');
    if (player.nemesis && player.nemesis.city === c.name) {
      screen.text(7, 35, `¡REVANCHA pendiente contra ${player.nemesis.rival}! (+50% XP)`, '#ff8c5b');
    }
    if (player.level < c.minLevel) screen.text(7, 37, `¡BLOQUEADO! Necesitas renombre ${c.minLevel}`, '#ff5c5c');
    else screen.text(7, 37, '[ENTER] inscribir a la peña', '#7CFC00');

    screen.box(70, 27, 64, 12, '#8a7f66');
    screen.text(73, 28, `MI PEÑA (${player.roster.size} abuelos)`, '#4fc3f7');
    let yy = 30;
    for (const id of player.roster.ids.slice(0, 6)) {
      const s = player.roster.get(id);
      const stCol = s.st > 60 ? '#7ec850' : s.st > 30 ? '#ffe14d' : '#ff5c5c';
      screen.text(73, yy, this.game.faces[id].name.padEnd(10), '#e8e0c8');
      screen.text(84, yy, `STA ${'▮'.repeat(Math.round(s.st / 12.5))}${'▯'.repeat(8 - Math.round(s.st / 12.5))}`, stCol);
      screen.text(98, yy, `MOR ${s.mo >= 0 ? '+' : ''}${s.mo}`, s.mo >= 0 ? '#88e088' : '#ef9f9f');
      yy++;
    }
    const need = player.xpForNextLevel();
    screen.text(73, 37, `Renombre ${player.level} · XP ${player.xp}/${need} · ${player.money}€`, '#b48ce8');
    screen.text(73, 38, `LIGA T${player.season.num}: jornada ${player.season.jornada}/8 · ${player.season.pts} pts · [3] clasificación`, '#88c8e8');

    const todayBest = player.dailyBest[todayStr()];
    const dailyTxt = todayBest
      ? `[L] TORNEO RELÁMPAGO — hoy: ${todayBest.won ? 'ganado' : 'perdido'} (margen ${todayBest.margin >= 0 ? '+' : ''}${todayBest.margin})`
      : '[L] TORNEO RELÁMPAGO — reto del día, aún sin jugar';
    screen.text(4, 26, dailyTxt, '#c8a0e8');
    screen.text(66, 26, 'RELIEVE: . costa  ; meseta  n montaña  M alta  ▲ nevada', '#8a8a7a');

    if (this.mapEvent) screen.textCenter(41, '» ' + this.mapEvent, '#ffcf8a');
    else screen.textCenter(41, '[↑/↓] elegir ciudad    [ENTER] jugar torneo    [L] relámpago    [2] mi peña', '#c9c2a8');

    if (input.hit('ArrowUp')) { this.cursor = (this.cursor + CITIES.length - 1) % CITIES.length; this.mapEvent = null; }
    if (input.hit('ArrowDown')) { this.cursor = (this.cursor + 1) % CITIES.length; this.mapEvent = null; }
    if (input.hit('ArrowUp') || input.hit('ArrowDown')) {
      const sc = CITIES[this.cursor];
      const vx = sc.wx - this.cam.x, vy = sc.wy - this.cam.y;
      if (vx < 4 || vx > this.view.w - 16 || vy < 2 || vy > this.view.h - 2) this._camCenterOn(sc);
    }
    if (input.hit('Enter') || input.hit(' ')) {
      if (player.level >= c.minLevel) {
        this.mapEvent = null;
        this.game.startTournament(Tournament.regular(c, player.money, player.nemesis && player.nemesis.city));
      }
    }
    if (input.hit('l') || input.hit('L')) {
      this.mapEvent = null;
      this.game.startTournament(Tournament.daily());
    }
  }

  showEvent(text) { this.mapEvent = text; }
}
