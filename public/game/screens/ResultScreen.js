import { ITEMS } from '../data/items.js';
import { STAT_KEYS } from '../data/abuelos.js';
import { CrestGenerator } from '../portraits/CrestGenerator.js';
import { truncate } from '../core/utils.js';

export class ResultScreen {
  constructor(game) { this.game = game; }

  // el abuelo con mejor media de stats entre los que jugaron: no hay dato
  // de "quién anotó cada punto" en el marcador agregado, así que se usa
  // como criterio de "quién hizo la diferencia" — sirve para el titular,
  // no pretende ser una estadística de verdad
  _mvp(res) {
    const { player } = this.game;
    if (!res || !res.abuelos.length) return null;
    let best = res.abuelos[0], bestAvg = -1;
    for (const id of res.abuelos) {
      const s = player.roster.get(id);
      const avg = STAT_KEYS.reduce((sum, k) => sum + s.getStat(k), 0) / STAT_KEYS.length;
      if (avg > bestAvg) { bestAvg = avg; best = id; }
    }
    return best;
  }

  draw() {
    const { screen, input, player, frame } = this.game;
    const ctx = this.game.weeklyMatch;
    const o = this.game.outcome;
    screen.clear();
    const opponent = ctx.opponentClub;
    const res = ctx.results[0];

    // cabecera cara a cara: el escudo de cada club (procedural y
    // determinista por nombre — ver portraits/CrestGenerator.js) con su
    // nombre debajo, y el marcador en medio — de un vistazo se ve quién
    // jugó y cómo quedó, antes de leer una sola línea de texto
    const myCrest = CrestGenerator.generate(player.clubName);
    const oppCrest = CrestGenerator.generate(opponent.name);
    const cx = Math.floor(screen.cols / 2);
    const crestY = 2, half = 22, crestHalfW = 6; // el escudo es 13x13, ver CrestGenerator
    const leftCx = cx - half, rightCx = cx + half;
    screen.drawPortrait(myCrest, leftCx - crestHalfW, crestY);
    screen.drawPortrait(oppCrest, rightCx - crestHalfW, crestY);
    const myName = truncate(player.clubName, 24), oppName = truncate(opponent.name, 24);
    const myNameCol = o.won ? '#7CFC00' : '#c9c2a8', oppNameCol = o.won ? '#c9c2a8' : '#ff5c5c';
    screen.text(leftCx - Math.floor(myName.length / 2), crestY + 14, myName, myNameCol);
    screen.text(rightCx - Math.floor(oppName.length / 2), crestY + 14, oppName, oppNameCol);
    screen.textCenter(crestY + 5, 'VS', '#8a7f66');
    if (res) screen.textCenter(crestY + 7, `${res.scoreP} - ${res.scoreA}`, o.won ? '#7CFC00' : '#ff5c5c');

    screen.textCenter(crestY + 16, o.won ? '¡VICTORIA!' : 'DERROTA', o.won ? '#7CFC00' : '#ff5c5c');
    if (!o.won) {
      screen.textCenter(crestY + 18, `${player.clubName} vuelve al pueblo con la cabeza gacha. Queda apuntado. Habrá revancha.`, '#c9b98a');
    }

    let yy = 22;
    if (res) {
      // el marcador y el rival ya se ven en la cabecera de escudos de
      // arriba: aquí solo hace falta decir quién jugó la mano
      const names = res.abuelos.map((id) => this.game.displayName(id)).join(' + ');
      screen.textCenter(yy++, `Jugaron: ${names}`, res.won ? '#7ec850' : '#ff5c5c');
      const mvpId = this._mvp(res);
      if (mvpId !== null) {
        const margin = res.scoreP - res.scoreA;
        const mvpName = this.game.displayName(mvpId);
        const line = res.won
          ? (margin >= 6 ? `MVP de la jornada: ${mvpName} se pasea con un empujón dominante.`
            : margin <= 2 ? `MVP de la jornada: ${mvpName} lo saca adelante en el filo de la navaja.`
            : `MVP de la jornada: ${mvpName}, la mano firme de hoy.`)
          : `El que más dio la cara: ${mvpName}, aunque no haya alcanzado.`;
        screen.textCenter(yy++, line, res.won ? '#ffd75e' : '#9a927a');
      }
      const xpPerAbuelo = o.xpPerAbuelo || {};
      const xpParts = res.abuelos
        .map((id) => [id, xpPerAbuelo[id] || 0])
        .filter(([, xp]) => xp > 0)
        .map(([id, xp]) => `${this.game.displayName(id)} +${xp} XP`);
      if (xpParts.length) screen.textCenter(yy++, xpParts.join('   ·   '), '#88c8e8');
    }
    yy += 2;
    screen.textCenter(yy++, `+${o.xp} XP      +${o.money}€`, '#b48ce8');
    if (o.revenge) screen.textCenter(yy++, '¡REVANCHA CUMPLIDA! XP con sabor a gloria (+50%)', '#ff8c5b');
    if (o.stormWin) screen.textCenter(yy++, '⚡ ¡VICTORIA BAJO TORMENTA! Premio doble por aguantar el chaparrón.', '#c8a0e8');
    if (o.itemDrop) {
      const it = ITEMS[o.itemDrop.item.id];
      const climaTxt = o.itemDrop.item.clima ? ` (inmunidad a ${o.itemDrop.item.clima})` : '';
      screen.textCenter(yy++, `¡${this.game.displayName(o.itemDrop.i)} se trae ${it.name}${climaTxt}!`, '#ffd9a0');
    }
    if (o.betResult) {
      screen.textCenter(yy++, o.betResult.won
        ? `El del bar paga de morros: +${o.betResult.amount}€ de la apuesta.`
        : `El del bar sonríe: adiós a los ${o.betResult.amount}€ de la apuesta.`,
        o.betResult.won ? '#7ec850' : '#ff5c5c');
    }
    if (o.weeklyGoalResult) {
      const wg = o.weeklyGoalResult;
      screen.textCenter(yy++, wg.met
        ? `Objetivo de la junta cumplido: ${wg.goal.desc} +${wg.goal.reward}€.`
        : wg.goal.penalty > 0 ? `La junta no ve cumplido su objetivo: ${wg.goal.desc} -${wg.goal.penalty}€.` : `Objetivo de la junta no cumplido: ${wg.goal.desc}`,
        wg.met ? '#c8a0e8' : '#8a7f66');
    }
    if (o.ultimatum && o.crisisDemotion) {
      screen.textCenter(yy++, 'CRISIS EN LA JUNTA: -250€ y descenso forzoso de categoría.', frame % 20 < 14 ? '#ff5c5c' : '#a03838');
    } else if (o.ultimatum) {
      screen.textCenter(yy++, 'ULTIMÁTUM DE LA JUNTA: -100€ de multa. A espabilar o esto se acaba.', frame % 20 < 14 ? '#ff5c5c' : '#a03838');
    }
    if (o.sponsorResult && o.sponsorResult.completed) {
      screen.textCenter(yy++, `Patrocinio cumplido: +${o.sponsorResult.reward}€ de ${o.sponsorResult.deal.name}.`, '#ffd9a0');
    }
    if (o.seasonEnd) screen.textCenter(yy + 1, '— fin de temporada: pulsa ENTER para ver el resumen —', '#ffb347');
    if (o.ups > 0 && frame % 16 < 10) screen.textCenter(yy + 1, `★ ★ ★  ¡RENOMBRE ${player.level}!  ★ ★ ★`, '#ffe14d');

    screen.textCenter(40, o.seasonEnd ? '[ENTER] ver resumen de temporada' : '[ENTER] volver al inicio', '#7CFC00');
    if (input.hit('Enter') || input.hit(' ')) {
      if (o.seasonEnd) { this.game.seasonEndInfo = o.seasonEnd; this.game.state = 'seasonEnd'; }
      else this.game.state = 'hub';
    }
  }
}
