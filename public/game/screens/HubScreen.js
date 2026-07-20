import { wrapText, hitRect, truncate } from '../core/utils.js';
import { cityByName } from '../data/countries.js';
import { seaCell } from '../core/seaFx.js';
import { TabsBar } from './TabsBar.js';
import { CrestGenerator } from '../portraits/CrestGenerator.js';

const RANK_COL = ['#ffd75e', '#d8d8e0', '#c88a4a'];

// Pantalla de inicio: un vistazo de "portada" al estado del club — quién
// eres (escudo), contra quién juegas, cómo va la liga y qué espera la
// junta — cada bloque es una tarjeta clicable que lleva a la pantalla
// donde de verdad se gestiona ese tema (Agenda/Ligas/El Club/Hemeroteca).
export class HubScreen {
  constructor(game) { this.game = game; this._standingsHover = false; }

  draw() {
    const { screen, input, player, frame, geography: geo } = this.game;
    const league = player.league;
    screen.clear();
    TabsBar.draw(this.game, 'hub');

    // ventana de aviso de la primera Copa de Europa ganada NUNCA: tapa el
    // resto del Hub hasta que se cierra, para que no pase desapercibida
    // (ver Game._finishEuroCupMatch / MetaProgress.unlockAllCountries)
    if (this.game.countryUnlockEvent) { this._drawCountryUnlockModal(); return; }

    screen.textCenter(4, `╣ ${player.clubName} — LIGA DE ${league.cityName} (nivel ${league.level}/8) ╠`, '#ffb347');
    screen.text(4, 5, `Hoy: ${player.seasonClock.dateLabel()}${this.game.simulating ? (frame % 24 < 16 ? '  ● SIMULANDO' : '  ○ SIMULANDO') : ''}`, this.game.simulating ? '#ffe680' : '#c9c2a8');
    // fila reservada siempre para el aviso de crisis, aunque no aplique —
    // así el resto de la cuadrícula no salta de sitio según el estado. En
    // partidas nuevas, esa misma fila señala Ayuda hasta que se visita una
    // vez (ver AyudaScreen) o pasa la primera semana — la crisis, si la
    // hay, manda siempre sobre el aviso de bienvenida.
    if (player.boardCrisis) {
      screen.textCenter(6, '⚠ LA JUNTA ESTÁ AL LÍMITE: un ultimátum más y os bajan de categoría ⚠', frame % 24 < 16 ? '#ff5c5c' : '#a03838');
    } else if (!player.helpHintSeen && player.seasonClock.day < 8) {
      screen.textCenter(6, '¿primera vez en la peña? pulsa [9] AYUDA para la guía rápida', '#88c8e8');
    }

    const TOP_Y = 7, TOP_H = 15;
    const BOT_Y = 22, BOT_H = 14;
    this._drawIdentityCard(4, TOP_Y, 40, TOP_H);
    this._drawMapCard(46, TOP_Y, 56, TOP_H);
    this._drawStandingsCard(104, TOP_Y, 32, TOP_H);
    this._drawNextMatchCard(4, BOT_Y, 42, BOT_H);
    this._drawBoardCard(48, BOT_Y, 42, BOT_H);
    this._drawNewsCard(92, BOT_Y, 44, BOT_H);

    // el tooltip de la clasificación se pinta el último de todo el frame
    // para que quede siempre por encima del resto (mismo patrón que
    // LeagueMapScreen._drawClubTooltip)
    if (this._standingsHover) this._drawStandingsTooltip(league, input.mouse.cx, input.mouse.cy);

    // imprevistos que piden respuesta o solo informan: se quedan en un
    // sitio fijo, fuera de las tarjetas, para que no se puedan perder
    // entre el resto de la información
    if (this.game.transferOffer) {
      const off = this.game.transferOffer;
      screen.text(4, 36, `NEGOCIACIÓN: ${off.buyer} ofrece ${off.amount}€ por ${this.game.displayName(off.id)}. [V] vender  [C] rechazar`, frame % 24 < 16 ? '#ffd9a0' : '#a08050');
    }
    if (this.game.deathEvent) screen.text(4, 37, this.game.deathEvent.text, '#c9c2a8');
    else if (this.game.injuryEvent) screen.text(4, 37, this.game.injuryEvent.text, '#ff8c5b');
    else if (this.game.calendarEvent) screen.text(4, 37, this.game.calendarEvent.text, '#ff9c5b');

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

  // aviso de una sola vez en toda la vida del jugador (cualquier perfil):
  // al ganar la primera Copa de Europa, Francia/Italia/Bélgica/Suiza/
  // Portugal quedan disponibles como país de casa la próxima vez que se
  // funde una peña desde cero (ver TitleScreen._drawCountryPicker)
  _drawCountryUnlockModal() {
    const { screen, input } = this.game;
    const w = 96, h = 18;
    const x = Math.floor((screen.cols - w) / 2), y = Math.floor((screen.rows - h) / 2);
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) screen.put(x + c, y + r, '█', '#000');
    screen.box(x, y, w, h, '#ffd75e', 'double');
    screen.textCenter(y + 2, '¡SE ABRE EL CIRCUITO ENTERO!', '#ffd75e');
    const body = [
      'Con esta Copa de Europa, la peña se hace un nombre fuera de España de una vez',
      'por todas: Francia, Italia, Bélgica, Suiza y Portugal quedan desbloqueados como',
      'país de casa para siempre, en cualquier partida futura.',
      '',
      'La próxima vez que fundéis una peña desde cero podréis elegir con cuál empezar,',
      'aunque esta partida siga en España — cada país tiene su propia peña fundadora y',
      'su propia escalera de ciudades por escalar.',
    ];
    body.forEach((l, i) => screen.text(x + 4, y + 5 + i, l, l ? '#e8e0c8' : '#000'));
    screen.textCenter(y + h - 2, '[ENTER] entendido', '#7CFC00');
    if (input.hit('Enter') || input.hit(' ') || input.mouse.clicked) this.game.countryUnlockEvent = null;
  }

  // tarjeta de identidad: el escudo "de héroe" (13x13) ocupa toda la
  // altura útil, con el nombre/nivel/renombre/caja al lado — no es
  // clicable, es solo la carta de presentación del club
  // clic en cualquier punto de la tarjeta: ir a Mi Peña (donde se gestiona
  // de verdad la plantilla que representa este escudo)
  _drawIdentityCard(x, y, w, h) {
    const { screen, input, player } = this.game;
    const league = player.league;
    const over = hitRect(input.mouse.cx, input.mouse.cy, x, y, w, h);
    screen.box(x, y, w, h, over ? '#ffe680' : '#8a7f66', 'double');
    screen.text(x + 2, y, ` ${truncate(player.clubName, w - 6)} `, over ? '#ffe680' : '#ffb347');
    const crest = CrestGenerator.generate(player.clubName);
    screen.drawPortrait(crest, x + 2, y + 1);
    const tx = x + 2 + 13 + 2;
    screen.text(tx, y + 2, `Nivel ${league.level}/8`, '#c9c2a8');
    screen.text(tx, y + 4, `Renombre ${player.level}`, '#c8a0e8');
    screen.text(tx, y + 5, `${player.money}€`, '#88e088');
    screen.text(tx, y + 7, 'clic: ir a', '#8a7f66');
    screen.text(tx, y + 8, 'Mi Peña', '#8a7f66');
    if (over && input.mouse.clicked) this.game.state = 'penya';
  }

  // mapa de la ciudad de tu liga, a vista de pájaro (igual que antes, algo
  // más compacto para caber en la cuadrícula nueva)
  _drawMapCard(x, y, w, h) {
    const { screen, frame, geography: geo } = this.game;
    const league = this.game.player.league;
    screen.box(x, y, w, h, '#4a5a6a');
    screen.text(x + 2, y, ` ${league.cityName} `, '#ffb347');
    const cityData = this._cityData();
    const vw = w - 4, vh = h - 3, vx = x + 2, vy = y + 2;
    const strideX = 3, strideY = 3;
    const camX = cityData.wx - Math.floor((vw * strideX) / 2), camY = cityData.wy - Math.floor((vh * strideY) / 2);
    for (let r = 0; r < vh; r++) {
      for (let c = 0; c < vw; c++) {
        const wx = camX + c * strideX, wy = camY + r * strideY;
        if (geo.isLand(wx, wy)) screen.put(vx + c, vy + r, geo.char[wy][wx], geo.color[wy][wx]);
        else { const sea = seaCell(wx, wy, frame); screen.put(vx + c, vy + r, sea.ch, sea.color); }
      }
    }
    screen.put(vx + Math.floor(vw / 2), vy + Math.floor(vh / 2), '◈', '#ffe14d');
  }

  // clasificación resumida: pasar el ratón enseña la tabla completa
  // (_drawStandingsTooltip), clic entra en Ligas
  _drawStandingsCard(x, y, w, h) {
    const { screen, input } = this.game;
    const { player } = this.game;
    const league = player.league;
    const over = hitRect(input.mouse.cx, input.mouse.cy, x, y, w, h);
    this._standingsHover = over;
    screen.box(x, y, w, h, over ? '#ffe680' : '#8a7f66', 'double');
    screen.text(x + 2, y, ' CLASIFICACIÓN ', over ? '#ffe680' : '#ffb347');
    const rank = league.myRank();
    const rankCol = rank <= 3 ? RANK_COL[Math.min(2, rank - 1)] : '#c9c2a8';
    screen.text(x + 2, y + 2, `${rank}º de 10`, rankCol);
    screen.text(x + 2, y + 4, `${player.club.won} (G) / ${player.club.played - player.club.won} (P)`, '#88e088');
    if (rank <= 2) screen.text(x + 2, y + 7, '▲ zona de ascenso', '#7ec850');
    else if (rank >= 9) screen.text(x + 2, y + 7, '▼ zona de descenso', '#ff5c5c');
    wrapText('pasa el ratón: tabla completa · clic: ir a Ligas', w - 4).forEach((l, i) => screen.text(x + 2, y + h - 3 + i, l, '#8a7f66'));
    if (over && input.mouse.clicked) this.game.state = 'leaguemap';
  }

  _drawStandingsTooltip(league, mx, my) {
    const { screen } = this.game;
    const table = league.standings();
    const w = 48, h = table.length + 2;
    const tx = Math.min(mx + 2, screen.cols - w - 1);
    const ty = Math.min(my + 1, screen.rows - h - 1);
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) screen.put(tx + c, ty + r, '█', '#000');
    screen.box(tx, ty, w, h, '#ffe14d', 'double');
    table.forEach((row, i) => {
      const isTop3 = i < 3;
      const rankCol = isTop3 ? RANK_COL[i] : row.isPlayer ? '#7CFC00' : '#8a8a7a';
      const nameCol = row.isPlayer ? '#7CFC00' : '#c9c2a8';
      const label = `${(i + 1 + '').padStart(2)}º ${row.name}${row.isPlayer ? ' ★' : ''}`.slice(0, w - 20).padEnd(w - 18);
      screen.text(tx + 2, ty + 1 + i, label, isTop3 || row.isPlayer ? rankCol : nameCol);
      screen.text(tx + w - 16, ty + 1 + i, `${row.won} (G) / ${row.lost} (P)`, nameCol);
    });
  }

  // rival de la próxima jornada de liga, con su escudo mini — junto con
  // Copa/Copa de Europa (antes sueltas en la cabecera), que también son
  // "qué toca pronto". Clic entra en la Agenda para planificar entrenos.
  _drawNextMatchCard(x, y, w, h) {
    const { screen, input, player } = this.game;
    const league = player.league;
    const over = hitRect(input.mouse.cx, input.mouse.cy, x, y, w, h);
    screen.box(x, y, w, h, over ? '#ffe680' : '#8a7f66', 'double');
    screen.text(x + 2, y, ' PRÓXIMO PARTIDO ', over ? '#ffe680' : '#ffb347');

    if (league.isSeasonOver) {
      screen.text(x + 2, y + 2, 'Temporada terminada.', '#8a8a7a');
    } else {
      const fixtures = league.fixturesForMatchday(league.matchday);
      const myFixture = fixtures.find(([a, b]) => a === league.playerClub.id || b === league.playerClub.id);
      const oppId = myFixture ? (myFixture[0] === league.playerClub.id ? myFixture[1] : myFixture[0]) : null;
      const opp = oppId !== null ? league.clubById(oppId) : null;
      const home = myFixture ? myFixture[0] === league.playerClub.id : null;
      screen.text(x + 2, y + 2, `Jornada ${league.matchday + 1} de 9`, '#c9c2a8');
      if (opp) {
        screen.drawPortrait(CrestGenerator.generateMini(opp.name), x + 2, y + 4);
        screen.text(x + 14, y + 5, `${home ? '(casa)' : '(fuera)'} vs`, '#8a7f66');
        screen.text(x + 14, y + 6, truncate(opp.name, w - 18), '#7CFC00');
      } else {
        screen.text(x + 2, y + 4, 'Rival por confirmar.', '#8a8a7a');
      }
    }

    // Copa y Copa de Europa comparten UNA sola fila fija (en vez de crecer
    // según haya una, otra o las dos), para que nunca se coma la fila del
    // hint de abajo — solo hay sitio para 2 filas libres tras el escudo
    // mini (y+9 e y+10, el resto ya lo ocupa el resto de la tarjeta)
    const bits = [];
    const hadCup = !!(player.cup && (!player.cup.finished || player.cup.isChampion()));
    if (player.cup && !player.cup.finished) {
      const roundShort = { 'CUARTOS DE FINAL': 'cuartos', 'SEMIFINAL': 'semifinal', 'FINAL': 'final' }[player.cup.roundName] || player.cup.roundName;
      const opp = player.cup.playerOpponent();
      bits.push(`COPA (${roundShort}): vs ${opp ? truncate(opp.name, 14) : '?'}`);
    } else if (player.cup && player.cup.isChampion()) {
      bits.push('COPA: ¡CAMPEONES!');
    }
    if (player.euroCup && !player.euroCup.finished) {
      const roundShort = { 'OCTAVOS DE FINAL': 'octavos', 'CUARTOS DE FINAL': 'cuartos', 'SEMIFINAL': 'semifinal', 'FINAL': 'final' }[player.euroCup.roundName] || player.euroCup.roundName;
      const opp = player.euroCup.playerOpponent();
      bits.push(`EUROPA (${roundShort}): vs ${opp ? truncate(opp.name, 12) : '?'}`);
    } else if (player.euroCup && player.euroCup.isChampion()) {
      bits.push('EUROPA: ¡CAMPEONES!');
    }
    if (bits.length) screen.text(x + 2, y + 9, truncate(bits.join('  ·  '), w - 4), hadCup ? '#ffd75e' : '#88c8e8');

    screen.text(x + 2, y + h - 2, 'clic: ir a la Agenda', '#8a7f66');
    if (over && input.mouse.clicked) this.game.state = 'agenda';
  }

  // resumen del objetivo de temporada + semanal + confianza; el resto de
  // la info de junta (presidente, ultimátums...) vive en El Club › La Junta
  _drawBoardCard(x, y, w, h) {
    const { screen, input, player } = this.game;
    const over = hitRect(input.mouse.cx, input.mouse.cy, x, y, w, h);
    screen.box(x, y, w, h, over ? '#ffe680' : '#8a7f66', 'double');
    screen.text(x + 2, y, ' OBJETIVO DE LA JUNTA ', over ? '#ffe680' : '#ffb347');

    // la confianza va justo debajo del último texto que quepa (el objetivo
    // semanal varía de longitud según cuál toque), pero sin pasarse de la
    // fila reservada para el hint de abajo — mejor recortar una línea de
    // texto que solaparla con la barra
    let ly = y + 2;
    screen.text(x + 2, ly++, 'Temporada:', '#8a7f66');
    wrapText(player.boardGoal.desc, w - 4).forEach((l) => { if (ly < y + h - 4) screen.text(x + 2, ly++, l, '#c8a0e8'); });
    ly++;
    if (player.weeklyGoal) {
      if (ly < y + h - 4) screen.text(x + 2, ly++, 'Esta semana:', '#8a7f66');
      wrapText(`${player.weeklyGoal.desc} (+${player.weeklyGoal.reward}€)`, w - 4).forEach((l) => { if (ly < y + h - 4) screen.text(x + 2, ly++, l, '#c8a0e8'); });
    }

    const confCol = player.boardConfidence <= 25 ? '#ff5c5c' : player.boardConfidence <= 50 ? '#ffe14d' : '#88e088';
    const filled = Math.round((player.boardConfidence / 100) * 20);
    const bar = `${'▓'.repeat(filled)}${'░'.repeat(20 - filled)}`;
    screen.text(x + 2, y + h - 4, `Confianza: ${bar} ${player.boardConfidence}/100`, confCol);
    screen.text(x + 2, y + h - 2, 'clic: ir a El Club › La Junta', '#8a7f66');
    if (over && input.mouse.clicked) { this.game.screens.club.section = 'junta'; this.game.state = 'club'; }
  }

  // el titular más reciente, a toda plana (como una portada), en vez del
  // listado largo de antes — para ver el histórico completo, Hemeroteca
  _drawNewsCard(x, y, w, h) {
    const { screen, input, player } = this.game;
    const over = hitRect(input.mouse.cx, input.mouse.cy, x, y, w, h);
    screen.box(x, y, w, h, over ? '#ffe680' : '#8a7f66', 'double');
    screen.text(x + 2, y, ' ÚLTIMA NOTICIA ', over ? '#ffe680' : '#ffb347');
    const latest = player.news.latest(1)[0];
    if (!latest) {
      screen.text(x + 2, y + 2, 'Aún no hay titulares.', '#8a8a7a');
    } else {
      wrapText(latest, w - 4).slice(0, h - 5).forEach((l, i) => screen.text(x + 2, y + 2 + i, l, '#c9c2a8'));
    }
    screen.text(x + 2, y + h - 2, 'clic: ir a la Hemeroteca', '#8a7f66');
    if (over && input.mouse.clicked) this.game.state = 'hemeroteca';
  }

  // panel del modo Debugger: botones para simular día a día en segundo
  // plano (sin pasar por pantallas de partido) y pararlo cuando quieras
  // mirar el estado de las ligas o del Mercado con calma
  _drawDebuggerPanel() {
    const { screen, input } = this.game;
    const bx = 4, by = 38, bw = 132, bh = 5;
    screen.box(bx, by, bw, bh, '#8a7f66', 'double');
    screen.text(bx + 2, by, ' MODO DEBUGGER ', '#ffb347');

    const simRect = { x: bx + 2, y: by + 1, w: 16, h: 3 };
    const stopRect = { x: bx + 20, y: by + 1, w: 16, h: 3 };
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

    screen.text(bx + 38, by + 1, 'Resuelve partidos (liga, Copa, Europa) por', '#9a927a');
    screen.text(bx + 38, by + 2, 'estadísticas. En Las Ligas: pasa el ratón', '#9a927a');
    screen.text(bx + 38, by + 3, 'por un equipo para ver su plantilla.', '#9a927a');

    if (input.mouse.clicked) {
      if (simOver && !simActive) this.game.startSimulating();
      else if (stopOver && simActive) this.game.stopSimulating();
    }
    if (input.hit('s') || input.hit('S')) this.game.startSimulating();
    if (input.hit('x') || input.hit('X')) this.game.stopSimulating();
  }

  _cityData() {
    const league = this.game.player.league;
    return cityByName(league.cityName);
  }
}
