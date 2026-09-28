import { ITEMS } from '../data/items.js';
import { STAT_KEYS } from '../data/abuelos.js';
import { CrestGenerator } from '../portraits/CrestGenerator.js';
import { truncate, wrapText } from '../core/utils.js';
import { Settings } from '../core/Settings.js';
import { UI, TONE, tint } from '../ui/theme.js';
import { panel, bigButton, meter, badge } from '../ui/widgets.js';

const FONT = '"Menlo", "Consolas", "DejaVu Sans Mono", monospace';

// dinero con su signo de verdad (antes salía "+-5€")
function euros(v) { return v > 0 ? `+${v}€` : v < 0 ? `−${-v}€` : '0€'; }

// Resultado de un partido de liga (docs/REDISENO.md, Fase 4): la palabra
// VICTORIA/DERROTA entra de golpe, el marcador cuenta hasta el final entre
// los dos escudos, cada abuelo que jugó tiene su tarjeta con la XP
// llenando su barra de nivel, y "LA CAJA" va apuntando línea a línea lo
// que ha dado (o quitado) el partido. ENTER / clic en CONTINUAR sigue.
export class ResultScreen {
  constructor(game) { this.game = game; this._o = null; this.t = 0; }

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

  // lo que el partido ha dado o quitado, como asientos de un libro de cuentas
  _ledger(o) {
    const L = [];
    L.push(['★', 'Renombre del club', `+${o.xp} XP`, TONE.xp]);
    L.push(['€', o.won ? 'Premio del partido' : 'Premio del partido (solo se cobra ganando)', euros(o.money), o.money > 0 ? TONE.money : o.money < 0 ? TONE.bad : UI.textDim]);
    if (o.revenge) L.push(['⚔', '¡Revancha cumplida! XP con sabor a gloria', '×1.5 XP', '#ff8c5b']);
    if (o.stormWin) L.push(['⛈', '¡Victoria bajo tormenta! Premio doble', '×2', '#c8a0e8']);
    if (o.itemDrop) {
      const it = ITEMS[o.itemDrop.item.id];
      const climaTxt = o.itemDrop.item.clima ? ` (inmunidad a ${o.itemDrop.item.clima})` : '';
      L.push(['✦', `${this.game.displayName(o.itemDrop.i)} se trae ${it.name}${climaTxt}`, 'objeto', '#ffd9a0']);
    }
    if (o.betResult) {
      L.push(['♣', o.betResult.won ? 'El del bar paga la apuesta de morros' : 'El del bar sonríe: apuesta perdida',
        euros(o.betResult.won ? o.betResult.amount : -o.betResult.amount), o.betResult.won ? TONE.money : TONE.bad]);
    }
    if (o.weeklyGoalResult) {
      const wg = o.weeklyGoalResult;
      if (wg.met) L.push(['✔', `Objetivo de la junta: ${wg.goal.desc}`, euros(wg.goal.reward), TONE.money]);
      else L.push(['✘', `Objetivo de la junta sin cumplir: ${wg.goal.desc}`, wg.goal.penalty > 0 ? euros(-wg.goal.penalty) : '—', wg.goal.penalty > 0 ? TONE.bad : UI.textDim]);
    }
    if (o.ultimatum && o.crisisDemotion) L.push(['!', 'CRISIS EN LA JUNTA: descenso forzoso de categoría', euros(-250), TONE.bad]);
    else if (o.ultimatum) L.push(['!', 'ULTIMÁTUM DE LA JUNTA: multa. A espabilar', euros(-100), TONE.bad]);
    if (o.sponsorResult && o.sponsorResult.completed) L.push(['$', `Patrocinio cumplido: ${o.sponsorResult.deal.name}`, euros(o.sponsorResult.reward), TONE.money]);
    return L;
  }

  // efectos de entrada, una sola vez por resultado
  _enter(o) {
    const { fx } = this.game;
    this._o = o;
    // congelado (capturas del harness) o sin movimiento: ya en su estado final
    const still = Settings.get('reduceMotion') || this.game.frozen;
    this.t = still ? 99 : 0;
    if (!fx || still) return;
    if (o.won) {
      fx.flash(TONE.gold, 0.25, 0.35);
      for (const [x, a] of [[40, -1.1], [100, -2.0], [70, -Math.PI / 2]]) {
        fx.burst(x, 12, { n: 40, colors: [TONE.gold, '#7ec850', '#4fc3f7', '#ff8c5b', '#fff3c4'], speed: 18, gravity: 14, life: 1.6, angle: a, spread: 1.4, glyph: '▪' });
      }
    }
    if (o.ups > 0) fx.banner(`¡RENOMBRE ${this.game.player.level}!`, TONE.gold, { life: 2.2, size: 3.4, sub: 'el club sube de categoría de fama' });
  }

  draw() {
    const { screen, input, player, frame } = this.game;
    const ctx = this.game.weeklyMatch;
    const o = this.game.outcome;
    if (o !== this._o) this._enter(o);
    this.t += this.game.lastDt || 1 / 60;
    const t = this.t;
    screen.clear();
    const opponent = ctx.opponentClub;
    const res = ctx.results[0];
    const col = o.won ? TONE.good : TONE.bad;

    // fondo de la cabecera teñido con el resultado
    screen.fill(0, 0, screen.cols, 17, tint(col, 0.1));
    screen.layer('under', (c, R) => {
      const g = c.createRadialGradient(R.W / 2, R.cy(6), 0, R.W / 2, R.cy(6), R.cw * 50);
      g.addColorStop(0, o.won ? 'rgba(255,210,74,0.16)' : 'rgba(255,92,92,0.10)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(0, 0, R.W, R.cy(17));
    });

    // escudos enfrentados (13×13, procedurales por nombre)
    const myCrest = CrestGenerator.generate(player.clubName);
    const oppCrest = CrestGenerator.generate(opponent.name);
    const lx = 14, rx = screen.cols - 14 - 13;
    screen.drawPortrait(myCrest, lx, 2);
    screen.drawPortrait(oppCrest, rx, 2);
    const myName = truncate(player.clubName, 26), oppName = truncate(opponent.name, 26);
    screen.text(lx + 6 - Math.floor(myName.length / 2), 15, myName, o.won ? TONE.player : UI.textDim);
    screen.text(rx + 6 - Math.floor(oppName.length / 2), 15, oppName, o.won ? UI.textDim : TONE.rival);

    // palabra grande + marcador contando
    const pop = 1 + 0.7 * Math.max(0, 1 - t / 0.3);
    const k = Math.min(1, Math.max(0, (t - 0.15) / 0.9));
    const sp = res ? Math.round(res.scoreP * k) : 0, sa = res ? Math.round(res.scoreA * k) : 0;
    screen.layer('over', (c, R) => {
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.save();
      c.translate(R.W / 2, R.cy(3.5)); c.scale(pop, pop);
      c.font = `bold ${R.ch * 2.6}px ${FONT}`;
      c.shadowColor = col; c.shadowBlur = R.ch * (0.8 + 0.3 * Math.sin(frame * 0.1));
      c.fillStyle = o.won ? '#eaffd8' : '#ffd8d8';
      c.fillText(o.won ? '¡VICTORIA!' : 'DERROTA', 0, 0);
      c.restore();
      if (!res) return;
      c.font = `bold ${R.ch * 4}px ${FONT}`;
      c.shadowBlur = R.ch * 0.5;
      const y = R.cy(9);
      c.shadowColor = TONE.player; c.fillStyle = o.won ? '#ffffff' : UI.textDim;
      c.fillText(String(sp), R.W / 2 - R.cw * 8, y);
      c.shadowColor = TONE.rival; c.fillStyle = o.won ? UI.textDim : '#ffffff';
      c.fillText(String(sa), R.W / 2 + R.cw * 8, y);
      c.shadowBlur = 0; c.fillStyle = UI.textFaint;
      c.fillText('–', R.W / 2, y);
    });
    if (!o.won) wrapText(`${player.clubName} vuelve al pueblo con la cabeza gacha. Queda apuntado. Habrá revancha.`, 80)
      .forEach((l, i) => screen.textCenter(13 + i, l, '#c9b98a'));
    else if (res) {
      const margin = res.scoreP - res.scoreA;
      screen.textCenter(13, margin >= 6 ? 'un paseo' : margin <= 2 ? 'en el filo de la navaja' : 'trabajo bien hecho', UI.textDim);
    }

    // tarjetas de quienes jugaron, con la XP llenando la barra de nivel
    if (res) this._drawPlayers(res, o, t);

    // la caja: asientos que van apareciendo
    const L = this._ledger(o);
    const lw = 96, lh = L.length + 4, lxp = Math.floor((screen.cols - lw) / 2), ly = 26;
    panel(screen, lxp, ly, lw, lh, { title: 'LA CAJA DEL PARTIDO', tone: UI.edge, titleColor: UI.accent });
    L.forEach(([ic, txt, val, c], i) => {
      if (t < 0.9 + i * 0.16) return;
      const yy = ly + 1 + i;
      screen.text(lxp + 2, yy, ic, c);
      screen.text(lxp + 5, yy, truncate(txt, lw - 20), UI.text);
      screen.text(lxp + lw - 3 - val.length, yy, val, c);
      if (t < 1.05 + i * 0.16) screen.glow(lxp + lw - 3 - val.length, yy, val.length, 1);
    });
    // renombre del club: barra hacia el siguiente nivel
    const need = player.xpForNextLevel();
    const ry = ly + lh - 2;
    screen.text(lxp + 2, ry, `RENOMBRE ${player.level}`, TONE.xp);
    meter(screen, lxp + 15, ry, lw - 32, player.xp * Math.min(1, t / 1.6), need, { color: TONE.xp });
    screen.text(lxp + lw - 15, ry, `${player.xp}/${need}`.padStart(12), UI.textDim);
    if (o.ups > 0 && frame % 16 < 10) screen.text(lxp + lw - 22, ly, ' ★ ¡SUBE! ', TONE.gold);

    const label = o.seasonEnd ? 'VER RESUMEN DE TEMPORADA' : 'CONTINUAR';
    const go = bigButton(this.game, 45, 41, 50, `${label}  [ENTER]`, { tone: o.seasonEnd ? UI.accent : TONE.good, selected: t > 1.2 });
    if (o.seasonEnd) screen.textCenter(40, '— fin de temporada —', frame % 30 < 20 ? UI.accent : UI.textDim);
    if (go || input.hit('Enter') || input.hit(' ')) {
      if (o.seasonEnd) { this.game.seasonEndInfo = o.seasonEnd; this.game.state = 'seasonEnd'; }
      else this.game.state = 'hub';
    }
  }

  _drawPlayers(res, o, t) {
    const { screen, player } = this.game;
    const mvpId = this._mvp(res);
    const xpPer = o.xpPerAbuelo || {};
    const n = res.abuelos.length, w = 40, gap = 2;
    let x = Math.floor((screen.cols - (n * w + (n - 1) * gap)) / 2);
    const y = 19;
    for (const id of res.abuelos) {
      const s = player.roster.get(id);
      const mvp = id === mvpId;
      panel(screen, x, y, w, 6, { title: truncate(this.game.displayName(id), w - 14), tone: mvp ? TONE.gold : UI.edge, titleColor: mvp ? TONE.gold : UI.text, fill: mvp ? tint(TONE.gold, 0.1) : UI.panel });
      if (mvp) badge(screen, x + w - 9, y, o.won ? '★ MVP' : '★ CARA', TONE.gold);
      const gained = xpPer[id] || 0;
      screen.text(x + 2, y + 1, `Nv ${s.level}`, UI.textDim);
      screen.text(x + 9, y + 1, gained > 0 ? `+${Math.round(gained * Math.min(1, Math.max(0, (t - 0.4) / 1)))} XP` : 'sin XP', gained > 0 ? TONE.info : UI.textFaint);
      // la barra arranca en lo que tenía antes del partido (o en 0 si ha subido)
      const need = s.xpToNextLevel();
      const before = Math.max(0, s.xp - gained);
      const fill = before + (s.xp - before) * Math.min(1, Math.max(0, (t - 0.4) / 1));
      meter(screen, x + 2, y + 2, w - 4, s.isMaxLevel() ? need : fill, need, { color: TONE.info });
      if (s.xp < gained && t > 1.4) screen.text(x + 2, y + 3, `¡SUBE A Nv ${s.level}! +puntos en Mi Peña`, TONE.gold);
      else screen.text(x + 2, y + 3, `STA ${Math.round(s.st)} · moral ${s.mo >= 0 ? '+' : ''}${s.mo}`, UI.textDim);
      if (mvp) {
        const margin = res.scoreP - res.scoreA;
        const line = res.won ? (margin >= 6 ? 'se pasea con un empujón dominante' : margin <= 2 ? 'lo saca en el filo de la navaja' : 'la mano firme de hoy') : 'dio la cara, aunque no alcanzó';
        screen.text(x + 2, y + 4, truncate(line, w - 4), TONE.gold);
      }
      x += w + gap;
    }
  }
}
