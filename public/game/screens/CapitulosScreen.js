import { TabsBar } from './TabsBar.js';
import { RIVALRY_PAIRS } from '../data/rivalries.js';
import { STAT_LABEL } from '../data/abuelos.js';
import { wrapText, truncate, drawTabRow, hitRect } from '../core/utils.js';

const SECTIONS = ['capitulos', 'palmares', 'rivalidades', 'historicos'];
const SECTION_LABEL = { capitulos: 'CAPÍTULOS', palmares: 'SALÓN DE LA FAMA', rivalidades: 'RIVALIDADES', historicos: 'HISTÓRICOS' };

// Capítulos de campaña, el Salón de la Fama (palmarés del club y récords de
// la plantilla), RIVALIDADES (los tres sistemas de "enemigo" del juego:
// derbi de liga, némesis, roces internos de vestuario) e HISTÓRICOS (un
// resumen de cada temporada de liga ya cerrada) — los cuatro apartados de
// "Historia" de la peña juntos en un solo sitio.
export class CapitulosScreen {
  constructor(game) { this.game = game; this.section = 'capitulos'; this.chapterPage = 0; this.historyScroll = 0; }

  draw() {
    const { screen, input, player } = this.game;
    screen.clear();
    TabsBar.draw(this.game, 'capitulos');
    const clicked = drawTabRow(screen, input, 4, 4, SECTIONS.map((s) => SECTION_LABEL[s]), SECTIONS.indexOf(this.section), { activeColor: '#ffe680', color: '#ffe680' });
    screen.text(104, 4, '[Q] cambiar de pestaña', '#8a7f66');

    if (this.section === 'capitulos') this._drawCapitulos();
    else if (this.section === 'palmares') this._drawSalonDeLaFama();
    else if (this.section === 'historicos') this._drawHistoricos();
    else this._drawRivalidades();

    if (clicked !== null) this.section = SECTIONS[clicked];
    else if (input.hit('q') || input.hit('Q')) this.section = SECTIONS[(SECTIONS.indexOf(this.section) + 1) % SECTIONS.length];
  }

  _drawCapitulos() {
    const { screen, input, player } = this.game;
    screen.textCenter(6, '═══ CAPÍTULOS DE LA CAMPAÑA ═══', '#ffb347');
    const chapters = player.campaign.list();
    const done = chapters.filter((c) => c.done).length;
    screen.textCenter(7, `${done} / ${chapters.length} completados`, '#9a927a');

    const boxX = 20, boxY = 9, boxW = 100, boxH = 32;
    screen.box(boxX, boxY, boxW, boxH, '#8a7f66');

    const perPage = 7;
    const maxPage = Math.max(0, Math.ceil(chapters.length / perPage) - 1);
    const overBox = input.mouse.cx >= boxX && input.mouse.cx < boxX + boxW && input.mouse.cy >= boxY && input.mouse.cy < boxY + boxH;
    if (overBox) this.chapterPage += input.wheel;
    this.chapterPage = Math.max(0, Math.min(maxPage, this.chapterPage));

    const pageChapters = chapters.slice(this.chapterPage * perPage, this.chapterPage * perPage + perPage);
    let yy = 11;
    for (const ch of pageChapters) {
      const col = ch.done ? '#7ec850' : '#8a8a7a';
      screen.text(23, yy, `${ch.done ? '✔' : '○'} ${ch.title}`, col);
      screen.text(25, yy + 1, ch.desc, '#9a927a');
      screen.text(25, yy + 2, `premio: ${ch.reward.m}€ + ${ch.reward.x} XP`, ch.done ? '#556' : '#7a9a5a');
      yy += 4;
    }

    if (maxPage > 0) {
      screen.text(23, boxY + boxH - 2, `página ${this.chapterPage + 1}/${maxPage + 1}`, '#8a7f66');
      screen.text(boxX + boxW - 26, boxY + boxH - 2, '[◀ A]  [D ▶]  rueda = scroll', '#8a7f66');
      if (input.hit('a') || input.hit('A') || input.hit('ArrowLeft')) this.chapterPage = Math.max(0, this.chapterPage - 1);
      if (input.hit('d') || input.hit('D') || input.hit('ArrowRight')) this.chapterPage = Math.min(maxPage, this.chapterPage + 1);
    }
  }

  // tres columnas, una por cada tipo de copa, cada una con el dibujo ASCII
  // de un trofeo distinto (copa lisa / copa con asas / trofeo esbelto con
  // estrella) para diferenciarlas a golpe de vista, y el número exacto de
  // títulos debajo. Los tres dibujos comparten alto (8 filas, con relleno
  // de filas en blanco arriba en los más bajos) para que las tres bases
  // queden a la misma altura, como en una vitrina.
  _drawTrophyCharts(x, y, w) {
    const { screen, player } = this.game;
    const TROPHY_LIGA = [
      '         ',
      ' ▄▄▄▄▄▄▄ ',
      '█████████',
      ' ▀▀▀▀▀▀▀ ',
      '   ███   ',
      '   ███   ',
      '  █████  ',
      ' ███████ ',
    ];
    const TROPHY_ESPANA = [
      '           ',
      ' ▄▄▄▄▄▄▄▄▄ ',
      '(█████████)',
      ' ▀▀▀▀▀▀▀▀▀ ',
      '    ███    ',
      '    ███    ',
      '   █████   ',
      '  ███████  ',
    ];
    const TROPHY_EUROPA = [
      '    ★    ',
      '   ▄▄▄   ',
      '  █████  ',
      '  █████  ',
      '   ███   ',
      '    █    ',
      '    █    ',
      '  █████  ',
    ];
    const cols = [
      { label: 'COPAS DE LIGA', count: player.seasonTitles, color: '#ffd75e', art: TROPHY_LIGA },
      { label: 'COPAS DE ESPAÑA', count: player.cupTitles, color: '#c8a0e8', art: TROPHY_ESPANA },
      { label: 'COPAS DE EUROPA', count: player.euroCupTitles, color: '#7ec8ea', art: TROPHY_EUROPA },
    ];
    const gap = 3;
    const colW = Math.floor((w - gap * 2) / 3);
    const artH = TROPHY_LIGA.length;

    cols.forEach((c, i) => {
      const cx = x + i * (colW + gap);
      screen.text(cx + Math.max(0, Math.floor((colW - c.label.length) / 2)), y, c.label, '#c9c2a8');
      const artW = Math.max(...c.art.map((l) => l.length));
      const artX = cx + Math.max(0, Math.floor((colW - artW) / 2));
      screen.block(artX, y + 2, c.art, c.count > 0 ? c.color : '#3a3730');
      const numLabel = `${c.count} título${c.count === 1 ? '' : 's'}`;
      screen.text(cx + Math.max(0, Math.floor((colW - numLabel.length) / 2)), y + 2 + artH + 1, numLabel, c.count > 0 ? c.color : '#8a8a7a');
    });

    return y + 2 + artH + 2;
  }

  _drawSalonDeLaFama() {
    const { screen, player } = this.game;
    screen.textCenter(6, '═══ SALÓN DE LA FAMA ═══', '#ffb347');

    const CONTENT_X = 6, CONTENT_W = 128;
    screen.text(CONTENT_X, 8, 'PALMARÉS DEL CLUB', '#ffb347');
    const afterCharts = this._drawTrophyCharts(CONTENT_X, 10, CONTENT_W) + 1;

    // dos columnas: izquierda 70% (números y récords del club), derecha 30%
    // (leyendas de la plantilla) — la proporción la pide el ancho, no una
    // caja aparte para cada bloque de texto
    const colY = afterCharts + 1, colH = 44 - colY;
    const leftW = Math.round(CONTENT_W * 0.7);
    const rightW = CONTENT_W - leftW - 2;
    const rightX = CONTENT_X + leftW + 2;

    screen.box(CONTENT_X, colY, leftW, colH, '#8a7f66');
    screen.text(CONTENT_X + 2, colY, ' EL CLUB EN NÚMEROS ', '#ffb347');
    const rate = player.wins + player.losses ? Math.round((100 * player.wins) / (player.wins + player.losses)) : 0;
    const rows = [
      [`Descensos`, `${player.relegations}`],
      [`Victorias / derrotas`, `${player.wins} (G) / ${player.losses} (P)  ·  ${rate}%`],
      [`Venganzas de némesis`, `${player.nemesisDefeats}`],
      [`Campanadas europeas`, `${player.euroUpsets}`],
      [`Victorias bajo tormenta`, `${player.stormWins}`],
      [`Renombre del mánager`, `nivel ${player.level}`],
      [`Ciudades conquistadas`, `${player.citiesWon.length}`],
      [`El derbi (${player.derbyClub ? player.derbyClub.name.slice(0, 20) : '—'})`, `${player.derbyHistory.wins}-${player.derbyHistory.losses}`],
      [`Confianza de la junta`, `${player.boardConfidence}/100`],
      [`Ultimátums recibidos`, `${player.boardUltimatums}`],
      [`Reputación de mánager`, `${player.managerRep} (${player.managerRepLabel})`],
    ];
    // la columna de valores se alinea a la derecha con margen fijo respecto
    // al borde de la caja (en vez de un desplazamiento fijo desde la
    // izquierda): así nunca se come el borde por muy larga que llegue a
    // ser una cifra tras muchas temporadas simuladas (victorias, derrotas...)
    const maxValLen = Math.max(...rows.map(([, v]) => v.length));
    const valX = CONTENT_X + leftW - 3 - maxValLen;
    let yy = colY + 2;
    for (const [label, val] of rows) { screen.text(CONTENT_X + 3, yy, truncate(label, Math.max(1, valX - (CONTENT_X + 3) - 2)), '#c9c2a8'); screen.text(valX, yy, val, '#ffe14d'); yy += 1; }
    yy++;
    screen.text(CONTENT_X + 3, yy++, 'CIUDADES DONDE HABÉIS GANADO LIGA:', '#ffb347');
    if (!player.citiesWon.length) screen.text(CONTENT_X + 3, yy++, 'ninguna todavía — a por la primera.', '#8a8a7a');
    for (const city of player.citiesWon) { screen.text(CONTENT_X + 5, yy++, `• ${city}`, '#88e088'); if (yy > colY + colH - 2) break; }

    screen.box(rightX, colY, rightW, colH, '#8a7f66');
    screen.text(rightX + 2, colY, ' LEYENDAS ', '#ffb347');
    let ry = colY + 2;
    for (const id of player.roster.ids) {
      const s = player.roster.get(id);
      const name = this.game.displayName(id);
      const genTag = s.gen > 0 ? ` (${s.gen}ª)` : '';
      screen.text(rightX + 2, ry, truncate(`${name}${genTag}`, rightW - 4), '#ffe680');
      ry += 1;
      screen.text(rightX + 2, ry, `${s.career.wins}G ${s.career.losses}P · racha ${s.career.bestStreak}`, '#9a927a');
      ry += 1;
      if (s.legacy.length) {
        const prev = s.legacy[s.legacy.length - 1];
        const prevName = prev.name || name;
        const how = prev.reason === 'fallecimiento' ? 'falleció' : 'se retiró';
        screen.text(rightX + 2, ry, truncate(`legado: ${prevName} ${how} a los ${prev.age}`, rightW - 4), '#8a7f66');
        ry += 1;
      }
      ry += 1;
      if (ry > colY + colH - 2) break;
    }
  }

  // resumen permanente de cada temporada de liga cerrada (Player.seasonHistory,
  // ver Career.js) — a diferencia del Salón de la Fama (números acumulados
  // de toda la carrera), aquí se ve temporada a temporada qué pasó
  _drawHistoricos() {
    const { screen, input, player } = this.game;
    screen.textCenter(6, '═══ HISTÓRICOS — TEMPORADAS ANTERIORES ═══', '#ffb347');

    const boxX = 10, boxY = 9, boxW = 120, boxH = 33;
    screen.box(boxX, boxY, boxW, boxH, '#8a7f66');

    const history = player.seasonHistory.slice().reverse(); // más reciente primero
    if (!history.length) {
      screen.textCenter(boxY + 10, 'Aún no se ha cerrado ninguna temporada de liga.', '#8a8a7a');
      screen.textCenter(boxY + 11, 'Vuelve por aquí cuando termine la primera.', '#8a8a7a');
      return;
    }

    const rowH = 3;
    const perPage = Math.floor((boxH - 3) / rowH);
    const maxScroll = Math.max(0, history.length - perPage);
    const overBox = hitRect(input.mouse.cx, input.mouse.cy, boxX, boxY, boxW, boxH);
    if (overBox) this.historyScroll += input.wheel;
    this.historyScroll = Math.max(0, Math.min(maxScroll, this.historyScroll));

    let yy = boxY + 2;
    for (let i = this.historyScroll; i < Math.min(history.length, this.historyScroll + perPage); i++) {
      const h = history[i];
      const outcome = h.promoted ? '▲ ASCENSO' : h.relegated ? '▼ DESCENSO' : 'se mantiene';
      const outcomeCol = h.promoted ? '#7ec850' : h.relegated ? '#ff5c5c' : '#8a8a7a';
      screen.text(boxX + 3, yy, `Temporada ${h.season} — Liga de ${h.cityName} (nivel ${h.level}/8)`, '#ffe680');
      screen.text(boxX + 3, yy + 1, `Acabó ${h.rank}º de 10`, '#c9c2a8');
      screen.text(boxX + 26, yy + 1, outcome, outcomeCol);
      if (h.awards && h.awards.length) {
        const line = h.awards.map((a) => `${STAT_LABEL[a.stat]}: ${a.name}`).join('  ·  ');
        screen.text(boxX + 45, yy + 1, truncate(line, boxW - 50), '#c8a0e8');
      }
      yy += rowH;
    }

    if (maxScroll > 0) {
      screen.text(boxX + 3, boxY + boxH - 1, `${this.historyScroll + 1}-${Math.min(history.length, this.historyScroll + perPage)} de ${history.length}  ·  rueda = desplazar`, '#8a7f66');
      if (input.hit('ArrowDown')) this.historyScroll = Math.min(maxScroll, this.historyScroll + 1);
      if (input.hit('ArrowUp')) this.historyScroll = Math.max(0, this.historyScroll - 1);
    }
  }

  // los tres "enemigos" del juego juntos: el derbi (rival fijo de liga), el
  // némesis (quién te la jugó por última vez) y los roces internos de
  // vestuario (celos entre dos abuelos concretos si ambos están fichados)
  _drawRivalidades() {
    const { screen, player } = this.game;
    screen.textCenter(6, '═══ RIVALIDADES ═══', '#ffb347');

    screen.box(6, 9, 60, 18, '#8a7f66');
    screen.text(9, 10, 'EL DERBI', '#ffb347');
    if (player.derbyClub) {
      screen.text(9, 12, `Rival de toda la vida: ${player.derbyClub.name}`, '#c9c2a8');
      screen.text(9, 13, `Historial: ${player.derbyHistory.wins}G ${player.derbyHistory.losses}P`, '#ffe14d');
    } else {
      screen.text(9, 12, 'Aún no hay derbi asignado en esta liga.', '#8a8a7a');
    }

    screen.text(9, 16, 'EL NÉMESIS', '#ffb347');
    if (player.nemesis) {
      screen.text(9, 18, `Ahora mismo: ${player.nemesis.rival}`, '#ff8c5b');
      screen.text(9, 19, 'Véngate para quitártelo de encima.', '#9a927a');
    } else {
      screen.text(9, 18, 'Sin némesis pendiente — nadie os la ha jugado últimamente.', '#8a8a7a');
    }
    screen.text(9, 21, `Venganzas totales: ${player.nemesisDefeats}`, '#88e088');

    screen.box(70, 9, 64, 26, '#8a7f66');
    screen.text(73, 10, 'ROCES INTERNOS DE VESTUARIO', '#ffb347');
    screen.text(73, 11, 'quien se queda en el banquillo mientras su rival juega pierde moral extra', '#8a7f66');
    let ry = 13, any = false;
    for (const pair of RIVALRY_PAIRS) {
      if (!player.roster.has(pair.a) || !player.roster.has(pair.b)) continue;
      any = true;
      const lines = wrapText(pair.desc, 58);
      lines.forEach((l, k) => screen.text(73, ry + k, l, '#c9c2a8'));
      ry += lines.length + 1;
    }
    if (!any) screen.text(73, 13, 'Ninguno de los roces conocidos está activo con tu plantilla actual.', '#8a8a7a');
  }
}
