import { TabsBar } from './TabsBar.js';
import { ROUND_NAMES } from '../domain/EuropeanCup.js';
import { countryTag } from '../data/countries.js';
import { truncate, drawTabRow, clamp, hitRect } from '../core/utils.js';
import { CrestGenerator } from '../portraits/CrestGenerator.js';

const PAGE_X = 4, PAGE_Y = 4, PAGE_W = 132, PAGE_H = 39;
const CREST_H = 5; // CrestGenerator.generateMini es siempre 5x5 (cuadrado)
const ROW_H = CREST_H * 2 + 1; // dos escudos apilados (uno por lado del cruce) + una fila de aire

// El cuadro completo de la Copa de Europa en curso (o de la última jugada,
// si ya se acabó): todas las rondas ya sorteadas, ronda a ronda, con el
// escudo y el resultado de cada cruce. Solo existen datos de las rondas
// por las que ya se ha pasado — las rondas futuras se muestran como
// pestañas deshabilitadas, no como pairings inventados. La Copa de Europa
// se sortea y se resuelve ENTERA todos los años, participes o no (ver
// EuropeanCup.js/Career.js), así que siempre hay un campeón real que
// enseñar en cuanto `finished` es true.
export class EuropeanCupScreen {
  constructor(game) {
    this.game = game;
    this.roundView = 0;
    this._lastSeenRoundIdx = -1;
    this.scroll = 0;
  }

  draw() {
    const { screen, input, player } = this.game;
    screen.clear();
    TabsBar.draw(this.game, 'eurocup');

    const cup = player.euroCup;
    if (!cup) {
      screen.textCenter(20, 'Todavía no hay ninguna Copa de Europa que enseñar.', '#8a8a7a');
      screen.textCenter(21, 'Clasifícate entre los 4 primeros de la máxima categoría para entrar.', '#8a8a7a');
      screen.textCenter(44, '[ESC] volver', '#c9c2a8');
      if (input.hit('Escape')) this.game.state = 'hub';
      return;
    }

    const lastDrawnRound = cup.bracket.length - 1;
    // si el cuadro ha avanzado de ronda desde la última vez que se miró
    // esta pantalla, se salta a la ronda nueva; navegar a mano dentro de
    // la misma visita no se pisa con esto
    if (cup.roundIdx !== this._lastSeenRoundIdx) {
      this.roundView = cup.roundIdx;
      this._lastSeenRoundIdx = cup.roundIdx;
    }
    this.roundView = clamp(this.roundView, 0, lastDrawnRound);

    screen.box(PAGE_X, PAGE_Y, PAGE_W, PAGE_H, '#88c8e8', 'double');
    screen.textCenter(PAGE_Y + 1, '╣ COPA DE EUROPA — EL CUADRO COMPLETO ╠', '#88c8e8');

    let statusText, statusCol;
    if (cup.finished && cup.isChampion()) {
      statusText = `🏆 CAMPEONES DE EUROPA con ${player.clubName}`; statusCol = '#ffd75e';
    } else if (cup.finished && cup.playerClubId !== null) {
      const champ = cup.championClub;
      const champTag = champ && champ.country ? countryTag(champ.country, player.homeCountry) : '';
      statusText = `Eliminados — campeón: ${champ ? champ.name : '?'}${champTag}`; statusCol = '#ef9f9f';
    } else if (cup.finished) {
      const champ = cup.championClub;
      const champTag = champ && champ.country ? countryTag(champ.country, player.homeCountry) : '';
      statusText = `No participasteis esta vez — campeón: ${champ ? champ.name : '?'}${champTag}`; statusCol = '#8aa8c8';
    } else {
      const opp = cup.playerOpponent();
      statusText = `En curso: ${cup.roundName.toLowerCase()}${opp ? ` — rival: ${opp.name}${opp.country ? countryTag(opp.country, player.homeCountry) : ''}` : ''}`;
      statusCol = '#7CFC00';
    }
    screen.textCenter(PAGE_Y + 3, statusText, statusCol);

    const tabY = PAGE_Y + 5;
    const labels = ROUND_NAMES;
    const disabled = labels.map((_, i) => i > lastDrawnRound);
    const tabsW = labels.reduce((s, l) => s + l.length + 6, 0);
    const tabX = PAGE_X + Math.max(2, Math.floor((PAGE_W - tabsW) / 2));
    const clickedTab = drawTabRow(screen, input, tabX, tabY, labels, this.roundView, { disabled, gap: 3 });
    if (clickedTab !== null) { this.roundView = clickedTab; this.scroll = 0; }
    if (input.hit('ArrowLeft') && this.roundView > 0) { this.roundView--; this.scroll = 0; }
    if (input.hit('ArrowRight') && this.roundView < lastDrawnRound) { this.roundView++; this.scroll = 0; }

    const listY = tabY + 2;
    const listH = PAGE_Y + PAGE_H - 3 - listY;
    const listX = PAGE_X + 3, listW = PAGE_W - 6;
    const pairs = cup.bracket[this.roundView];
    this._hoverInfo = null; // se rellena dentro de _drawSide si el ratón cae encima de un lado del cruce
    const { offset } = screen.drawList(listX, listY, listW, listH, pairs, ROW_H, (pair, idx, x, y) => {
      this._drawPairing(pair, idx, x, y, listW, player, cup);
    }, this.scroll);
    this.scroll = offset;
    if (input.hit('ArrowUp')) this.scroll = Math.max(0, this.scroll - 1);
    if (input.hit('ArrowDown')) this.scroll = this.scroll + 1;

    screen.textCenter(PAGE_Y + PAGE_H - 1, '[←/→] ronda   [↑/↓] desplazar cruces   [ESC] volver', '#c9c2a8');
    // el tooltip se pinta el último de todo el frame para quedar siempre
    // por encima del resto (mismo patrón que LeagueMapScreen/AgendaScreen)
    if (this._hoverInfo) this._drawHoverTooltip();
    if (input.hit('Escape')) this.game.state = 'hub';
  }

  _drawPairing(pair, idx, x, y, w, player, cup) {
    const { screen } = this.game;
    screen.text(x, y + Math.floor(CREST_H / 2), `${idx + 1}.`, '#5a5347');
    const nameX = x + 4;
    if (!pair.b) {
      this._drawSide(pair.a, true, nameX, y, w - 4, player, true, pair);
      screen.text(nameX + CREST_H + 2, y + CREST_H, 'pase directo a la siguiente ronda (bye)', '#5a5347');
      return;
    }
    const aWon = pair.winnerId === null ? null : pair.winnerId === pair.a.id;
    const bWon = pair.winnerId === null ? null : pair.winnerId === pair.b.id;
    this._drawSide(pair.a, aWon, nameX, y, w - 4, player, false, pair);
    this._drawSide(pair.b, bWon, nameX, y + CREST_H, w - 4, player, false, pair);
  }

  // won: true (ganó), false (perdió), null (aún sin decidir — solo puede
  // pasar en el cruce del propio jugador, en la ronda que está en curso).
  // `pair` hace falta para leer el marcador (scoreA/scoreB, ver
  // EuropeanCup.resolveAiPairings/resolvePlayerPairing) al pasar el ratón.
  _drawSide(side, won, x, y, w, player, isBye, pair) {
    const { screen, input } = this.game;
    const isMine = side.id === player.club.id;
    const mark = isBye ? '·' : won === null ? '·' : won ? '✓' : '✗';
    const markCol = isBye || won === null ? '#8a8a7a' : won ? '#7ec850' : '#8a5a3a';
    const tag = side.country ? countryTag(side.country, player.homeCountry) : '';
    const textX = x + CREST_H + 2;
    const label = truncate(side.name, Math.max(10, w - (textX - x) - 4)) + tag;
    const nameCol = isMine ? '#7CFC00' : won === false ? '#6a6355' : '#c9c2a8';
    const midY = y + Math.floor(CREST_H / 2);

    screen.drawPortrait(CrestGenerator.generateMini(side.name), x, y);
    screen.text(textX, midY, mark, markCol);
    screen.text(textX + 2, midY, isMine ? `► ${label}` : label, nameCol);

    if (hitRect(input.mouse.cx, input.mouse.cy, x, y, w, CREST_H)) {
      let resultText;
      if (isBye) resultText = 'Pase directo (bye): no jugó esta ronda.';
      else if (won === null) resultText = 'Cruce pendiente de jugar.';
      else if (pair.scoreA === undefined) resultText = won ? 'Ganó este cruce.' : 'Perdió este cruce.';
      else {
        const mine = side === pair.a ? pair.scoreA : pair.scoreB;
        const opp = side === pair.a ? pair.scoreB : pair.scoreA;
        resultText = `${won ? 'Ganó' : 'Perdió'} ${mine}-${opp}.`;
      }
      this._hoverInfo = { name: side.name, tag, resultText };
    }
  }

  _drawHoverTooltip() {
    const { screen, input } = this.game;
    const info = this._hoverInfo;
    const lines = [[`${info.name}${info.tag}`, '#ffe680'], [info.resultText, '#c9c2a8']];
    const tw = Math.min(60, Math.max(...lines.map((l) => l[0].length)) + 4);
    const th = lines.length + 2;
    const tx = Math.min(input.mouse.cx + 2, screen.cols - tw - 1);
    const ty = Math.min(input.mouse.cy + 1, screen.rows - th - 1);
    for (let r = 0; r < th; r++) for (let c = 0; c < tw; c++) screen.put(tx + c, ty + r, '█', '#000');
    screen.box(tx, ty, tw, th, '#ffe14d', 'double');
    lines.forEach((l, i) => screen.text(tx + 2, ty + 1 + i, l[0], l[1]));
  }
}
