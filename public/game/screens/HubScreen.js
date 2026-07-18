import { wrapText, hitRect } from '../core/utils.js';
import { CITIES } from '../data/cities.js';
import { seaCell } from '../core/seaFx.js';
import { TabsBar } from './TabsBar.js';

// Pantalla de inicio: tu liga, un trozo del mapa, la semana que viene, hoy,
// noticias y el botón de avanzar día (que salta directo al próximo evento).
export class HubScreen {
  constructor(game) { this.game = game; }

  draw() {
    const { screen, input, player, frame, geography: geo } = this.game;
    const league = player.league;
    screen.clear();
    TabsBar.draw(this.game, 'hub');

    screen.textCenter(4, `╣ ${player.clubName} — LIGA DE ${league.cityName} (nivel ${league.level}/8) ╠`, '#ffb347');
    screen.text(4, 5, `Hoy: ${player.seasonClock.dateLabel()}${this.game.simulating ? (frame % 24 < 16 ? '  ● SIMULANDO' : '  ○ SIMULANDO') : ''}`, this.game.simulating ? '#ffe680' : '#c9c2a8');
    screen.text(4, 6, `Clasificación: ${league.myRank()}º de 10   ·   ${player.club.pts} pts (${player.club.won}V ${player.club.played - player.club.won}D)`, '#88e088');
    if (player.weeklyGoal) screen.text(4, 7, `Objetivo de la junta esta semana: ${player.weeklyGoal.desc} (+${player.weeklyGoal.reward}€)`, '#c8a0e8');
    const confCol = player.boardConfidence <= 25 ? '#ff5c5c' : player.boardConfidence <= 50 ? '#ffe14d' : '#88e088';
    screen.text(110, 6, `Confianza de la junta: ${player.boardConfidence}/100`, confCol);
    if (player.cup) {
      const roundShort = { 'CUARTOS DE FINAL': 'cuartos', 'SEMIFINAL': 'semifinal', 'FINAL': 'final' }[player.cup.roundName] || player.cup.roundName;
      const opp = player.cup.playerOpponent();
      const cupTxt = player.cup.isChampion() ? 'COPA: ¡CAMPEONES!'
        : player.cup.playerEliminated() ? 'COPA: eliminados'
        : `COPA (${roundShort}): vs ${opp ? opp.name.slice(0, 9) : '?'}`;
      screen.text(110, 7, cupTxt, '#ffd75e');
    }
    // fila 8 es compartida: el aviso de crisis de junta (raro pero urgente)
    // tiene prioridad sobre el estado de la Copa de Europa si coinciden
    if (player.boardCrisis) {
      screen.text(110, 8, '⚠ un ultimátum más y os bajan de categoría', frame % 24 < 16 ? '#ff5c5c' : '#a03838');
    } else if (player.euroCup) {
      const roundShort = { 'OCTAVOS DE FINAL': 'octavos', 'CUARTOS DE FINAL': 'cuartos', 'SEMIFINAL': 'semifinal', 'FINAL': 'final' }[player.euroCup.roundName] || player.euroCup.roundName;
      const opp = player.euroCup.playerOpponent();
      const euroTxt = player.euroCup.isChampion() ? 'EUROPA: ¡CAMPEONES!'
        : player.euroCup.playerEliminated() ? 'EUROPA: eliminados'
        : `EUROPA (${roundShort}): vs ${opp ? opp.name.slice(0, 9) : '?'}`;
      screen.text(110, 8, euroTxt, '#88c8e8');
    }

    // mapa de España a vista de pájaro, con zoom out para que se reconozca
    // el contorno (se muestrea el mundo con un paso > 1 en vez de 1:1)
    const cityData = this._cityData();
    const vw = 68, vh = 23, vx = 4, vy = 9, strideX = 3, strideY = 3;
    screen.box(vx - 1, vy - 1, vw + 2, vh + 2, '#4a5a6a');
    screen.text(vx + 1, vy - 1, `╡ ${league.cityName} ╞`, '#ffb347');
    const camX = cityData.wx - Math.floor((vw * strideX) / 2), camY = cityData.wy - Math.floor((vh * strideY) / 2);
    for (let r = 0; r < vh; r++) {
      for (let c = 0; c < vw; c++) {
        const wx = camX + c * strideX, wy = camY + r * strideY;
        if (geo.isLand(wx, wy)) screen.put(vx + c, vy + r, geo.char[wy][wx], geo.color[wy][wx]);
        else { const sea = seaCell(wx, wy, frame); screen.put(vx + c, vy + r, sea.ch, sea.color); }
      }
    }
    screen.put(vx + Math.floor(vw / 2), vy + Math.floor(vh / 2), '◈', '#ffe14d');

    // próxima semana
    const wx0 = 76, wy0 = 9;
    screen.box(wx0 - 1, wy0 - 1, 34, 20, '#8a7f66');
    screen.text(wx0 + 1, wy0, 'PRÓXIMOS 7 DÍAS', '#ffb347');
    const week = player.seasonClock.nextWeek(league);
    let ly = wy0 + 2;
    for (const d of week) {
      let label = `${d.weekdayName.padEnd(10)}`;
      let col = '#8a8a7a';
      if (d.hasFixture) { label += ' PARTIDO DE LIGA'; col = '#7CFC00'; }
      else if (d.hasEuroCup) { label += ' COPA DE EUROPA'; col = '#88c8e8'; }
      else if (d.hasCup) { label += ' COPA DE ESPAÑA'; col = '#ffd75e'; }
      else if (d.training) { label += ` entreno: ${d.training.drill}`; col = '#88c8e8'; }
      screen.text(wx0 + 1, ly, label, col);
      ly += 2;
    }

    // noticias
    const nx0 = 112, ny0 = 9;
    screen.box(nx0 - 1, ny0 - 1, 27, 30, '#8a7f66');
    screen.text(nx0 + 1, ny0, 'NOTICIAS DE LA LIGA', '#ffb347');
    let ny = ny0 + 2;
    for (const n of player.news.latest(10)) {
      for (const l of wrapText(n, 24)) { if (ny < ny0 + 28) screen.text(nx0 + 1, ny++, l, '#c9c2a8'); }
      ny++;
    }

    if (this.game.transferOffer) {
      const off = this.game.transferOffer;
      screen.text(4, 34, `NEGOCIACIÓN: ${off.buyer} ofrece ${off.amount}€ por ${this.game.displayName(off.id)}. [V] vender  [C] rechazar`, frame % 24 < 16 ? '#ffd9a0' : '#a08050');
    }
    if (this.game.deathEvent) screen.text(4, 35, this.game.deathEvent.text, '#c9c2a8');
    else if (this.game.injuryEvent) screen.text(4, 35, this.game.injuryEvent.text, '#ff8c5b');
    else if (this.game.calendarEvent) screen.text(4, 35, this.game.calendarEvent.text, '#ff9c5b');

    if (player.debugMode) this._drawDebuggerPanel();

    screen.textCenter(44, this.game.simulating ? 'Simulando en segundo plano — [Detener] cuando quieras mirar' : '[ENTER] avanzar día', this.game.simulating ? '#ffe680' : '#c9c2a8');
    screen.textCenter(45, `Renombre ${player.level}  ·  ${player.money}€  ·  ${player.roster.size} en plantilla  ·  [D] Modo Debugger: ${player.debugMode ? 'ON' : 'off'}`, '#b48ce8');

    if (this.game.transferOffer) {
      if (input.hit('v') || input.hit('V')) this.game.acceptTransferOffer();
      else if (input.hit('c') || input.hit('C')) this.game.transferOffer = null;
    }
    if (input.hit('d') || input.hit('D')) { player.debugMode = !player.debugMode; if (!player.debugMode) this.game.stopSimulating(); player.save(); }
    if (!this.game.simulating && (input.hit('Enter') || input.hit(' '))) this.game.advanceDay();
  }

  // panel del modo Debugger: botones para simular día a día en segundo
  // plano (sin pasar por pantallas de partido) y pararlo cuando quieras
  // mirar el estado de las ligas o del Mercado con calma
  _drawDebuggerPanel() {
    const { screen, input } = this.game;
    const bx = 4, by = 37, bw = 68, bh = 6;
    screen.box(bx, by, bw, bh, '#8a7f66', 'double');
    screen.text(bx + 2, by, ' MODO DEBUGGER ', '#ffb347');

    const simRect = { x: bx + 2, y: by + 2, w: 16, h: 3 };
    const stopRect = { x: bx + 20, y: by + 2, w: 16, h: 3 };
    const simOver = hitRect(input.mouse.cx, input.mouse.cy, simRect.x, simRect.y, simRect.w, simRect.h);
    const stopOver = hitRect(input.mouse.cx, input.mouse.cy, stopRect.x, stopRect.y, stopRect.w, stopRect.h);
    const simActive = this.game.simulating;

    const simCol = simActive ? '#4a5a4a' : (simOver ? '#ffe680' : '#7CFC00');
    screen.box(simRect.x, simRect.y, simRect.w, simRect.h, simCol, simActive ? undefined : 'double');
    const label1 = '▶ SIMULAR';
    screen.text(simRect.x + Math.floor((simRect.w - label1.length) / 2), simRect.y + 1, label1, simCol);

    const stopCol = !simActive ? '#5a4a4a' : (stopOver ? '#ffe680' : '#ff5c5c');
    screen.box(stopRect.x, stopRect.y, stopRect.w, stopRect.h, stopCol, simActive ? 'double' : undefined);
    const label2 = '■ DETENER';
    screen.text(stopRect.x + Math.floor((stopRect.w - label2.length) / 2), stopRect.y + 1, label2, stopCol);

    screen.text(bx + 38, by + 3, 'Resuelve partidos (liga, Copa, Europa) por', '#9a927a');
    screen.text(bx + 38, by + 4, 'estadísticas. En Las Ligas: pasa el ratón', '#9a927a');
    screen.text(bx + 38, by + 5, 'por un equipo para ver su plantilla.', '#9a927a');

    if (input.mouse.clicked) {
      if (simOver && !simActive) this.game.startSimulating();
      else if (stopOver && simActive) this.game.stopSimulating();
    }
    if (input.hit('s') || input.hit('S')) this.game.startSimulating();
    if (input.hit('x') || input.hit('X')) this.game.stopSimulating();
  }

  _cityData() {
    const league = this.game.player.league;
    return CITIES.find((c) => c.diff === league.level);
  }
}
