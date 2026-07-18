import { TabsBar } from './TabsBar.js';
import { RIVALRY_PAIRS } from '../data/rivalries.js';
import { wrapText, drawTabRow } from '../core/utils.js';

const SECTIONS = ['capitulos', 'palmares', 'rivalidades'];
const SECTION_LABEL = { capitulos: 'CAPÍTULOS', palmares: 'SALÓN DE LA FAMA', rivalidades: 'RIVALIDADES' };

// Capítulos de campaña, el Salón de la Fama (palmarés del club y récords de
// la plantilla) y, en su propia pestaña, RIVALIDADES: los tres sistemas de
// "enemigo" del juego (derbi de liga, némesis, roces internos de vestuario)
// juntos en un solo sitio en vez de esparcidos por otras pantallas.
export class CapitulosScreen {
  constructor(game) { this.game = game; this.section = 'capitulos'; this.chapterPage = 0; }

  draw() {
    const { screen, input, player } = this.game;
    screen.clear();
    TabsBar.draw(this.game, 'capitulos');
    const clicked = drawTabRow(screen, input, 4, 4, SECTIONS.map((s) => SECTION_LABEL[s]), SECTIONS.indexOf(this.section), { activeColor: '#ffe680', color: '#ffe680' });
    screen.text(100, 4, '[Q] cambiar de pestaña', '#8a7f66');

    if (this.section === 'capitulos') this._drawCapitulos();
    else if (this.section === 'palmares') this._drawSalonDeLaFama();
    else this._drawRivalidades();

    screen.textCenter(43, '[1] inicio', '#c9c2a8');
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
    if (overBox) this.chapterPage -= input.wheel;
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

  // vitrina de trofeos: en vez de solo el número, una fila de iconos por
  // logro (con estante debajo) para que el palmarés se vea de un vistazo,
  // no solo se lea
  _drawTrophyShelf(x, y, w) {
    const { screen, player } = this.game;
    const shelves = [
      { icon: '🏆', count: player.seasonTitles, label: 'títulos de liga' },
      { icon: '🏅', count: player.cupTitles, label: 'copas de España' },
      { icon: '⬆', count: player.promotions, label: 'ascensos' },
    ];
    let yy = y;
    const maxIcons = Math.floor((w - 2) / 2);
    for (const s of shelves) {
      if (s.count > 0) {
        const shown = Math.min(s.count, maxIcons);
        const icons = Array.from({ length: shown }, () => s.icon).join(' ');
        const extra = s.count > shown ? `  +${s.count - shown}` : '';
        screen.text(x, yy, `${icons}${extra}`, '#ffe14d');
      } else {
        screen.text(x, yy, '— ninguno todavía —', '#5a5347');
      }
      screen.text(x, yy + 1, s.label, '#8a7f66');
      screen.text(x + w - 1 - String(s.count).length, yy, `${s.count}`, '#9a927a');
      yy += 2;
      screen.text(x, yy, '─'.repeat(w), '#5a4f3a');
      yy += 1;
    }
    return yy;
  }

  _drawSalonDeLaFama() {
    const { screen, player } = this.game;
    screen.textCenter(6, '═══ SALÓN DE LA FAMA ═══', '#ffb347');

    screen.box(6, 9, 60, 30, '#8a7f66');
    screen.text(9, 10, 'PALMARÉS DEL CLUB', '#ffb347');
    let yy = this._drawTrophyShelf(9, 12, 54);
    yy++;

    const rate = player.wins + player.losses ? Math.round((100 * player.wins) / (player.wins + player.losses)) : 0;
    const rows = [
      [`Descensos`, `${player.relegations}`],
      [`Victorias / derrotas`, `${player.wins}V ${player.losses}D  (${rate}%)`],
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
    for (const [label, val] of rows) { screen.text(9, yy, label, '#c9c2a8'); screen.text(48, yy, val, '#ffe14d'); yy += 1; }
    yy++;
    screen.text(9, yy++, 'CIUDADES DONDE HABÉIS GANADO LIGA:', '#ffb347');
    if (!player.citiesWon.length) screen.text(9, yy++, 'ninguna todavía — a por la primera.', '#8a8a7a');
    for (const city of player.citiesWon) { screen.text(11, yy++, `• ${city}`, '#88e088'); if (yy > 36) break; }

    screen.box(70, 9, 64, 30, '#8a7f66');
    screen.text(73, 10, 'LEYENDAS DE LA PLANTILLA', '#ffb347');
    screen.text(73, 11, 'generación · victorias/derrotas · mejor racha · ajuste más fino', '#8a8a7a');
    let ry = 13;
    for (const id of player.roster.ids) {
      const s = player.roster.get(id);
      const name = this.game.displayName(id);
      const genTag = s.gen > 0 ? ` (${s.gen}ª gen.)` : '';
      screen.text(73, ry, `${name}${genTag}`, '#ffe680');
      const finest = s.career.closestWin !== null ? `${s.career.closestWin} pts de margen` : 'sin datos';
      screen.text(73, ry + 1, `${s.career.wins}V ${s.career.losses}D  ·  mejor racha ${s.career.bestStreak}  ·  ajuste más fino: ${finest}`, '#9a927a');
      ry += 2;
      if (s.legacy.length) {
        const prev = s.legacy[s.legacy.length - 1];
        const prevName = prev.name || name;
        const how = prev.reason === 'fallecimiento' ? 'falleció' : 'se retiró';
        screen.text(73, ry, `legado: ${prevName} (${prev.gen}ª gen.) ${how} a los ${prev.age} años — ${prev.wins}V ${prev.losses}D`.slice(0, 62), '#8a7f66');
        ry += 1;
      }
      ry += 1;
      if (ry > 36) break;
    }
  }

  // los tres "enemigos" del juego juntos: el derbi (rival fijo de liga), el
  // némesis (quien te la jugó por última vez) y los roces internos de
  // vestuario (celos entre dos abuelos concretos si ambos están fichados)
  _drawRivalidades() {
    const { screen, player } = this.game;
    screen.textCenter(6, '═══ RIVALIDADES ═══', '#ffb347');

    screen.box(6, 9, 60, 18, '#8a7f66');
    screen.text(9, 10, 'EL DERBI', '#ffb347');
    if (player.derbyClub) {
      screen.text(9, 12, `Rival de toda la vida: ${player.derbyClub.name}`, '#c9c2a8');
      screen.text(9, 13, `Historial: ${player.derbyHistory.wins}V ${player.derbyHistory.losses}D`, '#ffe14d');
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
