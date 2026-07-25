import { TabsBar } from './TabsBar.js';
import { countryTag } from '../data/countries.js';
import { truncate, hitRect } from '../core/utils.js';
import { CrestGenerator } from '../portraits/CrestGenerator.js';

const PAGE_X = 4, PAGE_Y = 4, PAGE_W = 132, PAGE_H = 39;
const COL_W = 10, GAP = 3, FINAL_W = 13; // ancho de columna por ronda y hueco para los conectores
const MATCH_GAP = 3; // filas entre el inicio de un cruce de dieciseisavos y el siguiente en la misma mitad
const HALF_COUNT = [8, 4, 2, 1]; // cruces por MITAD del cuadro en cada ronda 0..3 (16/8/4/2 entrantes totales)
const ROUND_ABBR = ['1/16', '1/8', '1/4', 'SEMIF.'];
const LINE_COL = '#5a5347';

// El cuadro completo de la Copa de Europa como un árbol de verdad: las dos
// mitades del cuadro convergiendo hacia la final en el centro, con líneas
// de conexión ASCII entre rondas — el clásico póster de torneo. Como a
// esta escala no hay sitio para escudos grandes ni nombres completos, cada
// equipo lleva solo un marcador de 1 carácter (tomado de su escudo mini,
// ver CrestGenerator) y el nombre abreviado; el escudo completo y el
// nombre entero solo aparecen en el tooltip al pasar el ratón por encima.
//
// Las posiciones de fila de cada cruce se calculan de fuera hacia dentro
// (dieciseisavos con espaciado fijo, cada ronda siguiente centrada entre
// sus dos cruces "padre") — la misma geometría con la que se dibuja
// cualquier bracket de torneo de verdad. Las rondas que aún no se han
// sorteado (bracket.length no llega ahí) se pintan como huecos "· · ·": la
// FORMA del árbol es siempre la misma, solo cambia si ya se conoce quién
// ocupa cada hueco.
export class EuropeanCupScreen {
  constructor(game) {
    this.game = game;
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

    this._hoverInfo = null; // se rellena en _drawSlot si el ratón cae encima de un equipo
    this._drawTree(cup, player);

    screen.textCenter(PAGE_Y + PAGE_H - 1, 'pasa el ratón por un equipo para ver su escudo y el resultado   ·   [ESC] volver', '#c9c2a8');
    if (this._hoverInfo) this._drawHoverTooltip();
    if (input.hit('Escape')) this.game.state = 'hub';
  }

  // columnas de izquierda a derecha: 4 rondas de la mitad izquierda, la
  // FINAL en el centro, y las mismas 4 rondas de la mitad derecha en
  // espejo (de la más avanzada, junto al centro, a dieciseisavos en el borde)
  _columns() {
    const cols = [];
    let x = 0;
    for (let r = 0; r < 4; r++) { cols.push({ x, w: COL_W, round: r, side: 'L' }); x += COL_W + GAP; }
    cols.push({ x, w: FINAL_W, round: 4, side: 'C' });
    x += FINAL_W + GAP;
    for (let r = 3; r >= 0; r--) { cols.push({ x, w: COL_W, round: r, side: 'R' }); x += COL_W + GAP; }
    return { cols, totalW: x - GAP };
  }

  // centro de fila (puede ser fraccionario) de cada cruce de UNA mitad,
  // ronda a ronda: dieciseisavos con espaciado fijo, cada ronda siguiente
  // centrada entre sus dos cruces "padre" — así conecta sin saltos.
  _centers(startY) {
    const centers = [Array.from({ length: HALF_COUNT[0] }, (_, i) => startY + i * MATCH_GAP + 0.5)];
    for (let r = 1; r < 4; r++) {
      const prev = centers[r - 1];
      centers.push(Array.from({ length: HALF_COUNT[r] }, (_, j) => (prev[2 * j] + prev[2 * j + 1]) / 2));
    }
    return centers;
  }

  _drawTree(cup, player) {
    const { screen } = this.game;
    const { cols, totalW } = this._columns();
    const startX = PAGE_X + Math.max(2, Math.floor((PAGE_W - totalW) / 2));
    const treeTop = PAGE_Y + 6;
    const centers = this._centers(treeTop);
    const colOf = (round, side) => cols.find((c) => c.round === round && c.side === side);

    for (const c of cols) {
      if (c.side === 'C') continue;
      screen.text(startX + c.x + Math.max(0, Math.floor((c.w - ROUND_ABBR[c.round].length) / 2)), treeTop - 2, ROUND_ABBR[c.round], '#8a7f66');
    }
    const finalCol = colOf(4, 'C');
    screen.text(startX + finalCol.x + Math.floor((finalCol.w - 5) / 2), treeTop - 2, 'FINAL', '#ffd75e');

    for (const side of ['L', 'R']) {
      for (let r = 0; r < 4; r++) {
        const col = colOf(r, side);
        const cx = startX + col.x;
        const roundData = cup.bracket[r] ? (side === 'L' ? cup.bracket[r].slice(0, HALF_COUNT[r]) : cup.bracket[r].slice(HALF_COUNT[r])) : null;
        for (let i = 0; i < HALF_COUNT[r]; i++) {
          const topRow = Math.round(centers[r][i] - 0.5);
          this._drawMatch(roundData ? roundData[i] : null, cx, topRow, col.w, player);
        }
        if (r < 3) {
          for (let j = 0; j < HALF_COUNT[r + 1]; j++) {
            const yA = Math.round(centers[r][2 * j] - 0.5);
            const yB = Math.round(centers[r][2 * j + 1] - 0.5);
            const yTarget = Math.round(centers[r + 1][j]);
            this._drawMerge(side, cx, col.w, yA, yB, yTarget);
          }
        } else {
          const y = Math.round(centers[3][0]);
          this._drawStraight(side, cx, col.w, y, startX + finalCol.x, finalCol.w);
        }
      }
    }

    const finalTop = Math.round(centers[3][0] - 0.5);
    const finalPair = cup.bracket[4] ? cup.bracket[4][0] : null;
    this._drawMatch(finalPair, startX + finalCol.x, finalTop, finalCol.w, player);
  }

  // conecta dos cruces "padre" (fila yA e yB, en la ronda que se acaba de
  // pintar) con el cruce que producen en la ronda siguiente (fila
  // yTarget), con el típico codo+travesaño ASCII. `side` decide si el
  // árbol crece hacia la derecha (mitad izquierda) o hacia la izquierda
  // (mitad derecha, en espejo).
  _drawMerge(side, colX, colW, yA, yB, yTarget) {
    const { screen } = this.game;
    const edge = side === 'L' ? colX + colW : colX - 1;
    const vCol = side === 'L' ? edge + 1 : edge - 1;
    const hline = (xFrom, xTo, y) => { const lo = Math.min(xFrom, xTo), hi = Math.max(xFrom, xTo); for (let x = lo; x <= hi; x++) screen.put(x, y, '─', LINE_COL); };
    hline(edge, vCol, yA);
    hline(edge, vCol, yB);
    screen.put(vCol, yA, side === 'L' ? '┐' : '┌', LINE_COL);
    screen.put(vCol, yB, side === 'L' ? '┘' : '└', LINE_COL);
    const lo = Math.min(yA, yB), hi = Math.max(yA, yB);
    for (let y = lo + 1; y < hi; y++) screen.put(vCol, y, y === yTarget ? (side === 'L' ? '├' : '┤') : '│', LINE_COL);
    // travesaño final desde el codo hasta el borde de la siguiente columna
    // (el propio GAP entre columnas, sin llegar a pisar su texto)
    if (side === 'L') hline(vCol + 1, colX + colW + GAP - 1, yTarget);
    else hline(vCol - 1, colX - GAP + 1, yTarget);
  }

  // semifinal -> final: una sola fila por mitad (no hay dos padres que
  // fusionar), así que es solo una línea recta hasta el centro
  _drawStraight(side, colX, colW, y, finalX, finalW) {
    const { screen } = this.game;
    if (side === 'L') for (let x = colX + colW; x < finalX; x++) screen.put(x, y, '─', LINE_COL);
    else for (let x = finalX + finalW; x < colX; x++) screen.put(x, y, '─', LINE_COL);
  }

  _drawMatch(pair, x, topRow, w, player) {
    if (!pair) {
      this._drawSlot(null, x, topRow, w, player, false);
      this._drawSlot(null, x, topRow + 1, w, player, false);
      return;
    }
    if (!pair.b) {
      this._drawSlot(pair.a, x, topRow, w, player, true, pair);
      this._drawSlot(null, x, topRow + 1, w, player, false);
      return;
    }
    const aWon = pair.winnerId === null ? null : pair.winnerId === pair.a.id;
    const bWon = pair.winnerId === null ? null : pair.winnerId === pair.b.id;
    this._drawSlot(pair.a, x, topRow, w, player, false, pair, aWon);
    this._drawSlot(pair.b, x, topRow + 1, w, player, false, pair, bWon);
  }

  // un hueco de una fila: "· · ·" si esa ronda aún no se ha sorteado, o el
  // marcador (1 carácter, del escudo mini) + nombre abreviado si ya se sabe
  _drawSlot(side, x, y, w, player, isBye, pair, won) {
    const { screen, input } = this.game;
    if (!side) { screen.text(x, y, truncate('· · ·', w), '#3a3730'); return; }
    const isMine = side.id === player.club.id;
    const marker = this._markerFor(side.name);
    // dorado = quien pasa a la siguiente ronda (o el campeón, en la
    // final): así se puede seguir con la vista el camino del ganador por
    // todo el árbol, no solo leer el marcador de la última ronda
    const nameCol = isMine ? '#7CFC00' : won === true ? '#ffd75e' : won === false ? '#5a5347' : '#c9c2a8';
    const label = truncate(side.name, Math.max(3, w - 2));
    screen.text(x, y, marker.ch, marker.color);
    screen.text(x + 2, y, label, nameCol);

    if (hitRect(input.mouse.cx, input.mouse.cy, x, y, w, 1)) {
      const tag = side.country ? countryTag(side.country, player.homeCountry) : '';
      let resultText;
      if (isBye) resultText = 'Pase directo (bye): no jugó esta ronda.';
      else if (won === undefined) resultText = 'Cruce todavía sin sortear.';
      else if (won === null) resultText = 'Cruce pendiente de jugar.';
      else if (!pair || pair.scoreA === undefined) resultText = won ? 'Ganó este cruce.' : 'Perdió este cruce.';
      else {
        const mine = side === pair.a ? pair.scoreA : pair.scoreB;
        const opp = side === pair.a ? pair.scoreB : pair.scoreA;
        resultText = `${won ? 'Ganó' : 'Perdió'} ${mine}-${opp}.`;
      }
      this._hoverInfo = { name: side.name, tag, resultText, crest: CrestGenerator.generateMini(side.name) };
    }
  }

  // marcador de 1 carácter para un hueco de la fila: la celda central del
  // escudo mini de ese club (donde vive su emblema), con su color — un
  // "favicon" del escudo completo, que sí se ve entero en el tooltip
  _markerFor(name) {
    const crest = CrestGenerator.generateMini(name);
    for (let li = crest.layers.length - 1; li >= 0; li--) {
      const [color, lines] = crest.layers[li];
      const ch = lines[2][2];
      if (ch !== ' ') return { ch, color };
    }
    return { ch: '●', color: '#8a8a8a' };
  }

  _drawHoverTooltip() {
    const { screen, input } = this.game;
    const info = this._hoverInfo;
    const crestW = 5, gap = 1;
    const textLines = [[`${info.name}${info.tag}`, '#ffe680'], [info.resultText, '#c9c2a8']];
    const textW = Math.max(...textLines.map((l) => l[0].length));
    const tw = Math.min(60, crestW + gap + textW + 4);
    const th = crestW + 2;
    const tx = Math.min(input.mouse.cx + 2, screen.cols - tw - 1);
    const ty = Math.min(input.mouse.cy + 1, screen.rows - th - 1);
    for (let r = 0; r < th; r++) for (let c = 0; c < tw; c++) screen.put(tx + c, ty + r, '█', '#000');
    screen.box(tx, ty, tw, th, '#ffe14d', 'double');
    screen.drawPortrait(info.crest, tx + 2, ty + 1);
    textLines.forEach((l, i) => screen.text(tx + 2 + crestW + gap, ty + 1 + i, l[0], l[1]));
  }
}
