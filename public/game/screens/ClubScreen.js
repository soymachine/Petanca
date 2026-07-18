import { wrapText, hitRect, drawTabRow } from '../core/utils.js';
import { TabsBar } from './TabsBar.js';
import { SHIRT_SPONSOR_POOL } from '../data/sponsors.js';
import { boardPresidentFor, boardAdj } from '../data/boardPresident.js';

const SECTIONS = ['facilities', 'sponsor', 'junta'];
const SECTION_LABEL = { facilities: 'DESCAMPADO', sponsor: 'PATROCINIOS', junta: 'LA JUNTA' };

// Gestión del club: mejoras del descampado, patrocinios y la junta
// directiva (objetivos, confianza, presidente). Los ojeadores (contratar
// y asignar) viven ahora en Mi Peña, junto al Mercado que vigilan — ver
// PenyaScreen.js.
export class ClubScreen {
  constructor(game) { this.game = game; this.cursor = 0; this.section = 'facilities'; }

  draw() {
    const { screen, input } = this.game;
    screen.clear();
    TabsBar.draw(this.game, 'club');
    screen.textCenter(4, '═══ EL CLUB ═══', '#ffb347');
    const clicked = drawTabRow(screen, input, 4, 6, SECTIONS.map((s) => SECTION_LABEL[s]), SECTIONS.indexOf(this.section), { activeColor: '#ffe680', color: '#ffe680' });
    screen.text(80, 6, '[Q] cambiar de pestaña', '#8a7f66');
    const nomina = this.game.player.roster.totalUpkeep();
    screen.text(110, 6, `nómina semanal: ${nomina}€`, '#c98080');

    if (this.section === 'facilities') this._drawFacilities();
    else if (this.section === 'sponsor') this._drawSponsor();
    else this._drawJunta();

    if (clicked !== null) { this.section = SECTIONS[clicked]; this.cursor = 0; }
    else if (input.hit('q') || input.hit('Q')) {
      this.section = SECTIONS[(SECTIONS.indexOf(this.section) + 1) % SECTIONS.length];
      this.cursor = 0;
    }
    if (this.section === 'facilities') this._inputFacilities();
  }

  _drawFacilities() {
    const { screen, input, player } = this.game;
    const list = player.facilities.list();
    screen.box(4, 8, 132, 20, '#8a7f66');
    screen.text(7, 9, 'MEJORAS DEL DESCAMPADO', '#ffb347');
    const half = Math.ceil(list.length / 2);
    this._facRects = [];
    let hover = null;
    list.forEach((it, i) => {
      const col = i < half ? 0 : 1;
      const row = i < half ? i : i - half;
      const cx = 8 + col * 64;
      const yy = 11 + row * 4;
      const rx = cx - 3, ry = yy - 1, rw = 60, rh = 4;
      this._facRects.push({ x: rx, y: ry, w: rw, h: rh });
      const sel = i === this.cursor;
      const over = hitRect(input.mouse.cx, input.mouse.cy, rx, ry, rw, rh);
      if (over) hover = i;
      if (sel || over) {
        for (let r = 1; r < rh - 1; r++) screen.text(rx + 1, ry + r, ' '.repeat(rw - 2), '#3a4a3a');
      }
      if (sel) screen.box(rx, ry, rw, rh, '#7CFC00');
      else if (over) screen.box(rx, ry, rw, rh, '#ffe680');
      const maxed = !it.next;
      const nameCol = sel ? '#fff' : over ? '#ffe680' : it.level > 0 ? '#88c8e8' : '#8a8a8a';
      const levelTag = it.level > 0 ? ` (nivel ${it.level}/${it.maxLevel})` : '';
      screen.text(cx, yy, `${it.name}${levelTag}`, nameCol);
      if (maxed) {
        screen.text(cx, yy + 1, '★ AL MÁXIMO', '#ffe14d');
      } else {
        const label = it.level > 0 ? `mejorar: ${it.next.price}€` : `${it.next.price}€`;
        screen.text(cx, yy + 1, label, player.money >= it.next.price ? '#7ec850' : '#ff5c5c');
      }
      const desc = maxed ? it.current.desc : it.next.desc;
      wrapText(desc, 54).slice(0, 2).forEach((l, k) => screen.text(cx, yy + 2 + k, l, '#9a927a'));
    });
    if (hover !== null && input.mouse.clicked) this.cursor = hover;
    screen.text(7, 28, '[↑/↓] mirar · ratón = seleccionar   [ENTER] instalar/mejorar', '#c9c2a8');
  }
  _inputFacilities() {
    const { input, player } = this.game;
    const list = player.facilities.list();
    if (input.hit('ArrowUp')) this.cursor = (this.cursor + list.length - 1) % list.length;
    if (input.hit('ArrowDown')) this.cursor = (this.cursor + 1) % list.length;
    if (input.hit('Enter') || input.hit(' ')) {
      const it = list[this.cursor];
      if (it.next && player.money >= it.next.price) { player.money -= it.next.price; player.facilities.buy(it.id); player.save(); }
    }
  }

  // dos patrocinios a la vez: el local por objetivos (temporal, como
  // siempre) y el de camiseta (permanente, fijo hasta que se cambie)
  _drawSponsor() {
    const { screen, player, input } = this.game;
    screen.box(4, 8, 64, 20, '#8a7f66');
    screen.text(7, 9, 'PATROCINIO LOCAL', '#ffb347');
    screen.text(7, 10, '(por objetivos, con plazo)', '#8a7f66');
    if (player.sponsorship.active) {
      const deal = player.sponsorship.currentDeal();
      screen.text(7, 12, `${deal.name}:`, '#ffe680');
      wrapText(deal.desc, 56).forEach((l, k) => screen.text(7, 13 + k, l, '#c9c2a8'));
      screen.text(7, 15, `progreso ${player.sponsorship.active.progress}/${deal.target} · plazo semana ${player.sponsorship.active.deadlineJornada}`, '#9a927a');
    } else {
      screen.text(7, 12, 'Sin patrocinio activo ahora mismo.', '#8a8a7a');
      screen.text(7, 13, '[P] pedir un patrocinio nuevo', '#7CFC00');
      if (input.hit('p') || input.hit('P')) {
        const deal = player.sponsorship.offerNew(player.seasonClock.weekIndex, player.managerRep);
        player.news.push(`${deal.name} patrocina a la peña: ${deal.desc}.`);
        player.save();
      }
    }
    this._drawShirtSponsor();
  }

  _drawShirtSponsor() {
    const { screen, input, player } = this.game;
    const bx = 72;
    screen.box(bx, 8, 64, 20, '#8a7f66');
    screen.text(bx + 3, 9, 'PATROCINADOR DE CAMISETA', '#ffb347');
    screen.text(bx + 3, 10, '(fijo, hasta que lo cambies)', '#8a7f66');
    const current = player.sponsorship.shirtDeal();
    screen.text(bx + 3, 12, current ? `Actual: ${current.name} (+${current.perWin}€ por victoria de liga)` : 'Sin patrocinador de camiseta.', current ? '#ffe14d' : '#8a8a7a');

    const rep = player.managerRep;
    let yy = 14;
    SHIRT_SPONSOR_POOL.forEach((s, i) => {
      const locked = rep < s.repRequired;
      const isCurrent = current && current.id === s.id;
      const sel = i === this.cursor;
      if (sel) screen.box(bx + 2, yy - 1, 60, 3, '#7CFC00');
      screen.text(bx + 4, yy, s.name, locked ? '#5a5347' : isCurrent ? '#ffe14d' : sel ? '#fff' : '#88c8e8');
      screen.text(bx + 4, yy + 1, locked ? `req. rep ${s.repRequired}` : isCurrent ? 'firmado ahora mismo' : `+${s.perWin}€/victoria · firma: ${s.signBonus}€`, locked ? '#ff8c5b' : isCurrent ? '#8a7f66' : '#9a927a');
      yy += 3;
    });
    screen.text(bx + 3, yy, '[↑/↓] elegir   [ENTER] firmar', '#c9c2a8');

    if (input.hit('ArrowUp')) this.cursor = (this.cursor + SHIRT_SPONSOR_POOL.length - 1) % SHIRT_SPONSOR_POOL.length;
    if (input.hit('ArrowDown')) this.cursor = (this.cursor + 1) % SHIRT_SPONSOR_POOL.length;
    if (input.hit('Enter') || input.hit(' ')) {
      const s = SHIRT_SPONSOR_POOL[this.cursor];
      if (rep >= s.repRequired && !(current && current.id === s.id)) {
        player.sponsorship.signShirt(s.id);
        player.money += s.signBonus;
        player.news.push(`${s.name} se convierte en el nuevo patrocinador de camiseta de ${player.clubName}. +${s.signBonus}€.`);
        player.save();
      }
    }
  }

  // toda la información de la junta directiva en un sitio: quién es el
  // presidente (nombre/arquetipo/tono ya deterministas por club, ver
  // data/boardPresident.js), la confianza y sus ultimátums, y el detalle
  // completo de los objetivos de temporada y semanal — Inicio solo enseña
  // un resumen clicable de esto último (ver HubScreen._drawBoardCard)
  _drawJunta() {
    const { screen, player } = this.game;
    const pres = boardPresidentFor(player.clubName);

    screen.box(4, 8, 64, 20, '#8a7f66');
    screen.text(7, 9, 'LA JUNTA DIRECTIVA', '#ffb347');
    screen.text(7, 11, pres.name, '#ffe680');
    screen.text(7, 12, `presidente${boardAdj(pres, '', 'a')} ${pres.archetype}`, '#c9a35d');
    wrapText(`"${pres.tone}."`, 56).forEach((l, i) => screen.text(7, 14 + i, l, '#9a927a'));

    const confCol = player.boardConfidence <= 25 ? '#ff5c5c' : player.boardConfidence <= 50 ? '#ffe14d' : '#88e088';
    const filled = Math.round((player.boardConfidence / 100) * 40);
    const bar = `${'▓'.repeat(filled)}${'░'.repeat(40 - filled)}`;
    screen.text(7, 19, 'Confianza:', '#8a7f66');
    screen.text(7, 20, bar, confCol);
    screen.text(7, 21, `${player.boardConfidence}/100`, confCol);

    screen.text(7, 23, `Ultimátums esta temporada: ${player.boardUltimatums}`, player.boardUltimatums > 0 ? '#ff8c5b' : '#8a8a7a');
    if (player.boardCrisis) {
      screen.text(7, 25, '⚠ un ultimátum más y os bajan de categoría sin miramientos.', '#ff5c5c');
    } else {
      screen.text(7, 25, 'La junta no ha tenido que dar ningún ultimátum esta temporada.', '#8a8a7a');
    }

    const bx = 72;
    screen.box(bx, 8, 64, 20, '#8a7f66');
    screen.text(bx + 3, 9, 'OBJETIVOS', '#ffb347');
    screen.text(bx + 3, 11, 'DE TEMPORADA', '#c9a35d');
    wrapText(player.boardGoal.desc, 56).forEach((l, i) => screen.text(bx + 3, 12 + i, l, '#c8a0e8'));
    screen.text(bx + 3, 15, `Si se cumple: +${player.boardGoal.rewardMoney}€`, '#7ec850');
    screen.text(bx + 3, 16, `Si no: -${player.boardGoal.penaltyMoney}€`, '#ff8c5b');

    screen.text(bx + 3, 19, 'DE ESTA SEMANA', '#c9a35d');
    if (player.weeklyGoal) {
      wrapText(player.weeklyGoal.desc, 56).forEach((l, i) => screen.text(bx + 3, 20 + i, l, '#c8a0e8'));
      screen.text(bx + 3, 23, `Si se cumple: +${player.weeklyGoal.reward}€`, '#7ec850');
      if (player.weeklyGoal.penalty > 0) screen.text(bx + 3, 24, `Si no: -${player.weeklyGoal.penalty}€`, '#ff8c5b');
    } else {
      screen.text(bx + 3, 20, 'Sin objetivo semanal activo ahora mismo.', '#8a8a7a');
    }
  }
}
