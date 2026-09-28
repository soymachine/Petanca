import { wrapText, hitRect, truncate } from '../core/utils.js';
import { TabsBar } from './TabsBar.js';
import { CrestGenerator } from '../portraits/CrestGenerator.js';
import { GAME_OVER_NEGATIVE_WEEKS } from '../model/Career.js';
import { drillFor } from '../data/trainingDrills.js';
import { UI, TONE, tint } from '../ui/theme.js';
import { panel, bigButton, button, meter, segments, badge } from '../ui/widgets.js';

const FONT = '"Menlo", "Consolas", "DejaVu Sans Mono", monospace';
const RANK_COL = ['#ffd75e', '#d8d8e0', '#c88a4a'];

// Pantalla de inicio rediseñada (docs/REDISENO.md, Fase 4): la "base de
// operaciones". Arriba el club en grande; en el centro el CARTEL del
// próximo partido (los dos escudos enfrentados); a la derecha la
// clasificación entera; debajo la peña, la junta y la última noticia; y
// abajo del todo el botón protagonista, AVANZAR DÍA, que dice qué viene.
// Cada tarjeta sigue llevando a su pantalla (Agenda, Ligas, Mi Peña, El
// Club › La Junta, Hemeroteca) y se conservan todos los atajos.
export class HubScreen {
  constructor(game) { this.game = game; }

  draw() {
    const { screen, input, player, frame } = this.game;
    const league = player.league;
    screen.clear();
    TabsBar.draw(this.game, 'hub');

    // aviso de una sola vez en la vida (primera Copa de Europa ganada):
    // tapa el resto hasta que se cierra
    if (this.game.countryUnlockEvent) { this._drawCountryUnlockModal(); return; }

    this._drawHeader(league);
    this._drawAlertLine(frame);
    this._drawMatchPoster(4, 8, 92, 19);
    this._drawStandings(98, 8, 38, 19);
    this._drawPenyaCard(4, 28, 36, 10);
    this._drawBoardCard(42, 28, 46, 10);
    this._drawNewsCard(90, 28, 46, 10);
    this._drawIncidents(frame);

    // botón protagonista: avanzar el día (dice qué viene)
    const next = this._nextEvent();
    const sim = this.game.simulating;
    const label = sim ? '● SIMULANDO…' : '▶ AVANZAR DÍA';
    if (bigButton(this.game, 38, 40, 64, label, { hotkey: sim ? null : 'Enter', sub: sim ? 'modo Debugger: los días pasan solos · [X] detener' : next, tone: sim ? TONE.warn : TONE.good, disabled: false })) {
      if (!sim) this.game.advanceDay();
    }

    if (player.debugMode) this._drawDebuggerPanel();
    const foot = `Renombre ${player.level} · ${player.money}€ · ${player.roster.size} en plantilla · [D] Debugger: ${player.debugMode ? 'ON' : 'off'}${player.euroCup ? ' · [E] cuadro de Europa' : ''}`;
    screen.textCenter(45, foot, UI.textFaint);

    if (this.game.transferOffer) {
      if (input.hit('v') || input.hit('V')) this.game.acceptTransferOffer();
      else if (input.hit('c') || input.hit('C')) this.game.transferOffer = null;
    }
    if (input.hit('d') || input.hit('D')) { player.debugMode = !player.debugMode; if (!player.debugMode) this.game.stopSimulating(); player.save(); }
    if (player.euroCup && (input.hit('e') || input.hit('E'))) this.game.state = 'eurocup';
    if (!sim && input.hit(' ')) this.game.advanceDay();
  }

  // --- cabecera: el club en grande + fecha y liga ---
  _drawHeader(league) {
    const { screen, player } = this.game;
    screen.fill(0, 3, screen.cols, 4, '#0f1520');
    const crest = CrestGenerator.generateMini(player.clubName);
    screen.drawPortrait(crest, 4, 3);
    screen.layer('over', (ctx, R) => {
      ctx.font = `bold ${R.ch * 1.7}px ${FONT}`;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.shadowColor = UI.accent; ctx.shadowBlur = R.ch * 0.6;
      ctx.fillStyle = UI.accentHi;
      ctx.fillText(player.clubName, R.cx(11), R.cy(4.3));
      ctx.shadowBlur = 0;
    });
    screen.text(11, 6, `LIGA DE ${league.cityName.toUpperCase()} · NIVEL ${league.level}/8`, UI.textDim);
    screen.fill(0, 7, screen.cols, 1, null);
    const date = player.seasonClock.dateLabel().toUpperCase();
    screen.text(screen.cols - date.length - 4, 4, date, UI.text);
    const season = `TEMPORADA ${player.seasonsPlayed + 1}`;
    screen.text(screen.cols - season.length - 4, 5, season, UI.textDim);
  }

  // fila de avisos fija (crisis > junta > bienvenida), para que el resto no
  // salte de sitio según el estado
  _drawAlertLine(frame) {
    const { screen, player } = this.game;
    const blink = frame % 24 < 16;
    if (player.negativeWeeksStreak > 0) {
      const left = GAME_OVER_NEGATIVE_WEEKS - player.negativeWeeksStreak;
      const t = `⚠ NÚMEROS ROJOS ${player.negativeWeeksStreak}/${GAME_OVER_NEGATIVE_WEEKS} jornadas · ${left <= 0 ? 'GAME OVER inminente' : `${left} más y GAME OVER`}`;
      badge(screen, Math.floor((screen.cols - t.length - 2) / 2), 7, t, blink ? TONE.bad : '#a03838');
    } else if (player.boardCrisis) {
      const t = '⚠ LA JUNTA ESTÁ AL LÍMITE: un ultimátum más y os bajan de categoría';
      badge(screen, Math.floor((screen.cols - t.length - 2) / 2), 7, t, blink ? TONE.bad : '#a03838');
    } else if (!player.helpHintSeen && player.seasonClock.day < 8) {
      screen.textCenter(7, '¿primera vez en la peña? pulsa [9] AYUDA para la guía rápida', TONE.info);
    }
  }

  // --- cartel del próximo partido: los dos escudos enfrentados ---
  _drawMatchPoster(x, y, w, h) {
    const { screen, input, player, frame } = this.game;
    const league = player.league;
    const over = hitRect(input.mouse.cx, input.mouse.cy, x, y, w, h);
    panel(screen, x, y, w, h, { title: 'PRÓXIMO PARTIDO', tone: over ? UI.accentHi : UI.edge, fill: over ? UI.panelHi : UI.panel, style: 'double' });

    if (league.isSeasonOver) {
      screen.text(x + 4, y + 3, 'Temporada terminada: se cierra en el próximo día.', UI.textDim);
    } else {
      const fixtures = league.fixturesForMatchday(league.matchday);
      const myFixture = fixtures.find(([a, b]) => a === league.playerClub.id || b === league.playerClub.id);
      const oppId = myFixture ? (myFixture[0] === league.playerClub.id ? myFixture[1] : myFixture[0]) : null;
      const opp = oppId !== null ? league.clubById(oppId) : null;
      const home = myFixture ? myFixture[0] === league.playerClub.id : null;
      const mid = x + Math.floor(w / 2);
      const jor = `JORNADA ${league.matchday + 1} DE ${league.fixtures.length}`;
      screen.text(mid - Math.floor(jor.length / 2), y + 2, jor, UI.accent);
      // escudo propio a la izquierda, rival a la derecha
      screen.drawPortrait(CrestGenerator.generate(player.clubName), x + 6, y + 3);
      const myName = truncate(player.clubName, 28);
      screen.text(x + 12 - Math.floor(myName.length / 2) + 1, y + 16, myName, TONE.player);
      if (opp) {
        screen.drawPortrait(CrestGenerator.generate(opp.name), x + w - 19, y + 3);
        const on = truncate(opp.name, 28);
        screen.text(x + w - 13 - Math.floor(on.length / 2), y + 16, on, TONE.rival);
        const orank = league.standings().findIndex((c) => c.id === opp.id) + 1;
        const where = home ? 'EN CASA' : 'A DOMICILIO';
        screen.text(mid - Math.floor(where.length / 2), y + 12, where, home ? TONE.good : TONE.warn);
        const r = `rival: ${orank}º · ${opp.won}G ${opp.lost}P`;
        screen.text(mid - Math.floor(r.length / 2), y + 13, r, UI.textDim);
        // "VS" grande en píxeles
        screen.layer('over', (ctx, R) => {
          ctx.font = `bold ${R.ch * 3.2}px ${FONT}`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          const pulse = 0.6 + 0.4 * Math.sin(frame * 0.06);
          ctx.shadowColor = UI.accent; ctx.shadowBlur = R.ch * pulse;
          ctx.fillStyle = UI.accentHi;
          ctx.fillText('VS', R.cx(mid + 0.5), R.cy(y + 8));
          ctx.shadowBlur = 0;
        });
      } else {
        screen.text(mid - 10, y + 8, 'rival por confirmar', UI.textDim);
      }
    }

    // Copa y Copa de Europa, como insignias al pie del cartel
    let bx = x + 3;
    const cy = y + h - 2;
    if (player.cup && !player.cup.finished) {
      const opp = player.cup.playerOpponent();
      bx += badge(screen, bx, cy, `COPA · ${player.cup.roundName.toLowerCase()} vs ${opp ? truncate(opp.name, 16) : '?'}`, TONE.gold) + 1;
    } else if (player.cup && player.cup.isChampion()) bx += badge(screen, bx, cy, 'COPA: ¡CAMPEONES!', TONE.gold) + 1;
    if (player.euroCup && !player.euroCup.finished && player.euroCup.playerPairing()) {
      const opp = player.euroCup.playerOpponent();
      bx += badge(screen, bx, cy, `EUROPA · ${player.euroCup.roundName.toLowerCase()} vs ${opp ? truncate(opp.name, 14) : '?'}`, TONE.info) + 1;
    } else if (player.euroCup && player.euroCup.isChampion()) bx += badge(screen, bx, cy, 'EUROPA: ¡CAMPEONES!', TONE.info) + 1;
    screen.text(x + w - 16, cy, 'clic: Agenda', UI.textFaint);
    if (over && input.mouse.clicked) this.game.state = 'agenda';
  }

  // --- clasificación entera (clic: Ligas) ---
  _drawStandings(x, y, w, h) {
    const { screen, input, player } = this.game;
    const league = player.league;
    const over = hitRect(input.mouse.cx, input.mouse.cy, x, y, w, h);
    panel(screen, x, y, w, h, { title: 'CLASIFICACIÓN', tone: over ? UI.accentHi : UI.edge, fill: over ? UI.panelHi : UI.panel });
    screen.text(x + 2, y + 2, 'POS CLUB', UI.textFaint);
    screen.text(x + w - 9, y + 2, 'PTS  G', UI.textFaint);
    league.standings().forEach((c, i) => {
      const ry = y + 3 + i;
      const zone = i < 2 ? TONE.good : i >= 8 ? TONE.bad : null;
      if (c.isPlayer) screen.fill(x + 1, ry, w - 2, 1, tint(TONE.player, 0.22));
      screen.put(x + 1, ry, zone ? '▌' : ' ', zone || UI.textFaint);
      const rc = i < 3 ? RANK_COL[i] : UI.textDim;
      screen.text(x + 2, ry, `${String(i + 1).padStart(2)}`, rc);
      screen.text(x + 6, ry, truncate(c.name, w - 17), c.isPlayer ? TONE.player : UI.text);
      screen.text(x + w - 9, ry, `${String(c.pts).padStart(3)} ${String(c.won).padStart(2)}`, c.isPlayer ? TONE.player : UI.textDim);
    });
    screen.text(x + 2, y + h - 3, '▌', TONE.good); screen.text(x + 4, y + h - 3, 'ascenso', UI.textDim);
    screen.text(x + 14, y + h - 3, '▌', TONE.bad); screen.text(x + 16, y + h - 3, 'descenso', UI.textDim);
    screen.text(x + 2, y + h - 2, 'clic: Ligas', UI.textFaint);
    if (over && input.mouse.clicked) this.game.state = 'leaguemap';
  }

  // --- la peña de un vistazo (clic: Mi Peña) ---
  _drawPenyaCard(x, y, w, h) {
    const { screen, input, player } = this.game;
    const over = hitRect(input.mouse.cx, input.mouse.cy, x, y, w, h);
    panel(screen, x, y, w, h, { title: 'LA PEÑA', tone: over ? UI.accentHi : UI.edge, fill: over ? UI.panelHi : UI.panel });
    const ids = player.roster.ids;
    const avgSt = ids.reduce((s, id) => s + player.roster.get(id).st, 0) / Math.max(1, ids.length);
    const avgMo = ids.reduce((s, id) => s + player.roster.get(id).mo, 0) / Math.max(1, ids.length);
    screen.text(x + 2, y + 2, `${ids.length} abuelo${ids.length === 1 ? '' : 's'} · renombre ${player.level}`, UI.text);
    screen.text(x + 2, y + 4, 'forma', UI.textDim);
    segments(screen, x + 10, y + 4, 10, Math.round(avgSt / 10), { color: avgSt > 60 ? TONE.good : avgSt > 30 ? TONE.warn : TONE.bad });
    screen.text(x + 21, y + 4, `${Math.round(avgSt)}%`, UI.textDim);
    screen.text(x + 2, y + 5, 'moral', UI.textDim);
    const moTxt = `${avgMo >= 0 ? '+' : ''}${avgMo.toFixed(0)}`;
    screen.text(x + 10, y + 5, moTxt, avgMo >= 3 ? TONE.good : avgMo <= -3 ? TONE.bad : UI.text);
    screen.text(x + 2, y + 6, 'caja', UI.textDim);
    screen.text(x + 10, y + 6, `${player.money}€`, player.money < 0 ? TONE.bad : TONE.money);
    screen.text(x + 2, y + h - 2, 'clic: Mi Peña', UI.textFaint);
    if (over && input.mouse.clicked) this.game.state = 'penya';
  }

  // --- objetivo de la junta + confianza (clic: El Club › La Junta) ---
  _drawBoardCard(x, y, w, h) {
    const { screen, input, player } = this.game;
    const over = hitRect(input.mouse.cx, input.mouse.cy, x, y, w, h);
    panel(screen, x, y, w, h, { title: 'LA JUNTA', tone: over ? UI.accentHi : UI.edge, fill: over ? UI.panelHi : UI.panel });
    let ly = y + 2;
    const lines = [];
    wrapText(`Temporada: ${player.boardGoal.desc}`, w - 4).forEach((l) => lines.push([l, TONE.xp]));
    if (player.weeklyGoal) wrapText(`Semana: ${player.weeklyGoal.desc} (+${player.weeklyGoal.reward}€)`, w - 4).forEach((l) => lines.push([l, '#d8c8f0']));
    for (const [l, c] of lines.slice(0, h - 5)) screen.text(x + 2, ly++, l, c);
    const conf = player.boardConfidence;
    const col = conf <= 25 ? TONE.bad : conf <= 50 ? TONE.warn : TONE.good;
    screen.text(x + 2, y + h - 3, 'confianza', UI.textDim);
    meter(screen, x + 12, y + h - 3, w - 20, conf, 100, { color: col });
    screen.text(x + w - 7, y + h - 3, `${conf}`, col);
    screen.text(x + 2, y + h - 2, 'clic: El Club › La Junta', UI.textFaint);
    if (over && input.mouse.clicked) { this.game.screens.club.section = 'junta'; this.game.state = 'club'; }
  }

  // --- última noticia (clic: Hemeroteca) ---
  _drawNewsCard(x, y, w, h) {
    const { screen, input, player } = this.game;
    const over = hitRect(input.mouse.cx, input.mouse.cy, x, y, w, h);
    panel(screen, x, y, w, h, { title: 'ÚLTIMA NOTICIA', tone: over ? UI.accentHi : UI.edge, fill: over ? UI.panelHi : UI.panel });
    const latest = player.news.latest(1)[0];
    if (!latest) screen.text(x + 2, y + 2, 'Aún no hay titulares.', UI.textDim);
    else wrapText(latest, w - 4).slice(0, h - 4).forEach((l, i) => screen.text(x + 2, y + 2 + i, l, i === 0 ? UI.text : UI.textDim));
    screen.text(x + 2, y + h - 2, 'clic: Hemeroteca', UI.textFaint);
    if (over && input.mouse.clicked) this.game.state = 'hemeroteca';
  }

  // imprevistos: oferta de traspaso (con botones) y sucesos del día
  _drawIncidents(frame) {
    const { screen, game } = this;
    if (this.game.transferOffer) {
      const off = this.game.transferOffer;
      const t = `NEGOCIACIÓN: ${off.buyer} ofrece ${off.amount}€ por ${this.game.displayName(off.id)}`;
      screen.fill(4, 38, 132, 1, tint(TONE.warn, frame % 24 < 16 ? 0.22 : 0.14));
      screen.text(6, 38, truncate(t, 92), UI.accentHi);
      if (button(this.game, 102, 38, 'VENDER', { hotkey: 'V', tone: TONE.good, w: 14 })) this.game.acceptTransferOffer();
      if (button(this.game, 118, 38, 'RECHAZAR', { hotkey: 'C', tone: TONE.bad, w: 16 })) this.game.transferOffer = null;
      return;
    }
    const ev = this.game.deathEvent || this.game.injuryEvent || this.game.calendarEvent;
    if (ev) {
      const col = this.game.deathEvent ? UI.text : this.game.injuryEvent ? '#ff8c5b' : '#ff9c5b';
      screen.fill(4, 38, 132, 1, tint(col, 0.14));
      screen.text(6, 38, truncate(ev.text, 128), col);
    }
    void game;
  }

  // qué trae el próximo día con algo: entreno, copa, Europa o jornada
  _nextEvent() {
    const { player } = this.game;
    const clock = player.seasonClock;
    const league = player.league;
    const days = [...clock.weekFrom(1, league), ...clock.weekFrom(8, league)];
    for (let i = 0; i < days.length; i++) {
      const d = days[i];
      const when = i === 0 ? 'mañana' : `el ${d.weekdayName}`;
      if (d.hasEuroCup) return `${when}: Copa de Europa`;
      if (d.hasCup) return `${when}: partido de Copa`;
      if (d.training) return `${when}: entreno de ${this.game.displayName(d.training.abueloId)} (${drillFor(d.training.drill).label.toLowerCase()})`;
      if (d.hasFixture) return `${when}: jornada ${d.matchdayIndex + 1} de liga`;
    }
    return 'sin nada agendado estos días';
  }

  // aviso de una sola vez en toda la vida del jugador: la primera Copa de
  // Europa abre los 5 países extranjeros como país de casa
  _drawCountryUnlockModal() {
    const { screen, input } = this.game;
    const w = 96, h = 18;
    const x = Math.floor((screen.cols - w) / 2), y = Math.floor((screen.rows - h) / 2);
    panel(screen, x, y, w, h, { title: '¡SE ABRE EL CIRCUITO ENTERO!', tone: TONE.gold, titleColor: TONE.gold, fill: '#141a26', style: 'double', glow: true });
    const body = [
      'Con esta Copa de Europa, la peña se hace un nombre fuera de España de una vez',
      'por todas: Francia, Italia, Bélgica, Suiza y Portugal quedan desbloqueados como',
      'país de casa para siempre, en cualquier partida futura.',
      '',
      'La próxima vez que fundéis una peña desde cero podréis elegir con cuál empezar,',
      'aunque esta partida siga en España — cada país tiene su propia peña fundadora y',
      'su propia escalera de ciudades por escalar.',
    ];
    body.forEach((l, i) => screen.text(x + 4, y + 3 + i, l, UI.text));
    if (bigButton(this.game, x + Math.floor((w - 30) / 2), y + h - 5, 30, 'ENTENDIDO', { hotkey: 'Enter', tone: TONE.gold })) this.game.countryUnlockEvent = null;
    if (input.hit(' ')) this.game.countryUnlockEvent = null;
  }

  // modo Debugger: simular días en segundo plano y detenerlo
  _drawDebuggerPanel() {
    const { screen, input } = this.game;
    const sim = this.game.simulating;
    screen.text(4, 44, 'DEBUGGER', UI.textFaint);
    if (button(this.game, 14, 44, '▶ SIMULAR', { hotkey: 'S', tone: TONE.good, w: 18, disabled: sim })) this.game.startSimulating();
    if (button(this.game, 34, 44, '■ DETENER', { hotkey: 'X', tone: TONE.bad, w: 18, disabled: !sim })) this.game.stopSimulating();
    screen.text(54, 44, 'resuelve partidos por estadísticas', UI.textFaint);
    void input;
  }
}
