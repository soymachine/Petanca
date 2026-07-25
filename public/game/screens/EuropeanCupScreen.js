import { TabsBar } from './TabsBar.js';
import { ROUND_NAMES } from '../domain/EuropeanCup.js';
import { countryTag } from '../data/countries.js';
import { truncate, drawTabRow, clamp } from '../core/utils.js';

const PAGE_X = 4, PAGE_Y = 4, PAGE_W = 132, PAGE_H = 39;
const ROW_H = 3; // 2 líneas de contenido + 1 de aire, por cruce

// El cuadro completo de la Copa de Europa en curso (o de la última jugada,
// si ya se acabó): todas las rondas ya sorteadas, ronda a ronda, con quién
// ganó cada cruce. Solo existen datos de las rondas por las que ya se ha
// pasado — el motor nunca "juega solo" el resto del cuadro por adelantado
// (ver EuropeanCup.advanceRound, solo se llama cuando el jugador gana su
// propio cruce), así que las rondas futuras se muestran como pestañas
// deshabilitadas, no como pairings inventados.
//
// Nota importante sobre "quién gana la Copa si no la ganáis vosotros": el
// motor NUNCA resuelve el resto del cuadro tras vuestra eliminación (ver
// Game._finishEuroCupMatch: `advanceRound()` solo se llama si `won`), así
// que no existe un campeón "de verdad" cuando quedáis eliminados — esta
// pantalla lo explica en vez de inventar un ganador que el juego nunca
// llegó a decidir.
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
    } else if (cup.finished) {
      statusText = `Eliminados en ${cup.roundName.toLowerCase()} — el resto del cuadro no llegó a jugarse`; statusCol = '#ef9f9f';
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
    const { offset } = screen.drawList(listX, listY, listW, listH, pairs, ROW_H, (pair, idx, x, y) => {
      this._drawPairing(pair, idx, x, y, listW, player, cup);
    }, this.scroll);
    this.scroll = offset;
    if (input.hit('ArrowUp')) this.scroll = Math.max(0, this.scroll - 1);
    if (input.hit('ArrowDown')) this.scroll = this.scroll + 1;

    screen.textCenter(PAGE_Y + PAGE_H - 1, '[←/→] ronda   [↑/↓] desplazar cruces   [ESC] volver', '#c9c2a8');
    if (input.hit('Escape')) this.game.state = 'hub';
  }

  _drawPairing(pair, idx, x, y, w, player, cup) {
    const { screen } = this.game;
    screen.text(x, y, `${idx + 1}.`, '#5a5347');
    const nameX = x + 4;
    if (!pair.b) {
      this._drawSide(pair.a, true, nameX, y, w - 4, player, true);
      screen.text(nameX, y + 1, 'pase directo (bye)', '#5a5347');
      return;
    }
    this._drawSide(pair.a, pair.winnerId === null ? null : pair.winnerId === pair.a.id, nameX, y, w - 4, player, false);
    this._drawSide(pair.b, pair.winnerId === null ? null : pair.winnerId === pair.b.id, nameX, y + 1, w - 4, player, false);
  }

  // won: true (ganó), false (perdió), null (aún sin decidir — solo puede
  // pasar en el cruce del propio jugador, en la ronda que está en curso)
  _drawSide(side, won, x, y, w, player, isBye) {
    const { screen } = this.game;
    const isMine = side.id === player.club.id;
    const mark = isBye ? '·' : won === null ? '·' : won ? '✓' : '✗';
    const markCol = isBye || won === null ? '#8a8a7a' : won ? '#7ec850' : '#8a5a3a';
    const tag = side.country ? countryTag(side.country, player.homeCountry) : '';
    const label = `${truncate(side.name, w - 16)}${tag}`;
    const nameCol = isMine ? '#7CFC00' : won === false ? '#6a6355' : '#c9c2a8';
    screen.text(x, y, mark, markCol);
    screen.text(x + 2, y, isMine ? `► ${label}` : label, nameCol);
  }
}
