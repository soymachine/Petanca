import { TROPHY_ART } from '../data/art/staticArt.js';
import { STAT_LABEL } from '../data/abuelos.js';
import { Settings } from '../core/Settings.js';
import { UI, TONE, STAT, tint } from '../ui/theme.js';
import { panel, bigButton, pixelTitle } from '../ui/widgets.js';

// Ceremonia de fin de temporada: antes esto era un par de líneas más
// pegadas al resultado del último partido. Ahora tiene su propia pantalla,
// para que cerrar una temporada (ascenso, descenso, premios) pese algo más
// que ganar una jornada cualquiera.
export class SeasonEndScreen {
  constructor(game) { this.game = game; }

  draw() {
    const { screen, input, player, frame } = this.game;
    const se = this.game.seasonEndInfo;
    screen.clear();
    if (!se) { this.game.state = 'hub'; return; }

    const champion = se.rank === 1;
    // confeti al entrar si hay algo que celebrar (una vez por temporada)
    if (this._se !== se) {
      this._se = se;
      if ((champion || se.promoted) && this.game.fx && !Settings.get('reduceMotion') && !this.game.frozen) {
        for (const x of [30, 70, 110]) this.game.fx.burst(x, 8, { n: 45, colors: [TONE.gold, '#ffffff', TONE.good, TONE.player], speed: 20, life: 1.6, glyph: '▪' });
      }
    }
    const top = champion || se.promoted;
    if (top) screen.block(Math.floor((screen.cols - 21) / 2), 1, TROPHY_ART, '#ffe14d');
    if (top) screen.glow(Math.floor((screen.cols - 21) / 2), 1, 21, TROPHY_ART.length);

    const ty = top ? 13 : 4;
    pixelTitle(screen, ty, 'FIN DE TEMPORADA', UI.accent, 1.8);
    // puesto final en grande y lo que significa
    const verdict = champion ? '¡CAMPEONES DE LIGA!' : se.promoted ? '¡ASCENSO!' : se.relegated ? 'DESCENSO' : 'SE MANTIENE LA CATEGORÍA';
    const vcol = champion ? TONE.gold : se.promoted ? TONE.good : se.relegated ? TONE.bad : UI.text;
    screen.textCenter(ty + 2, `${player.clubName} acaba ${se.rank}º de 10 en la liga de ${se.cityName}`, UI.text);
    pixelTitle(screen, ty + 4, verdict, vcol, 1.6);
    if (se.relegated) screen.textCenter(ty + 6, 'a la categoría inferior — toca rehacerse', UI.textDim);
    else if (!champion && !se.promoted) screen.textCenter(ty + 6, 'a por la siguiente', UI.textDim);

    // premios de la peña como tarjetas con el glifo y color de cada stat
    let yy = ty + 8;
    if (se.awards && se.awards.length) {
      screen.textCenter(yy, 'PREMIOS DE LA PEÑA', UI.accent);
      const w = 30, gap = 2, n = se.awards.length;
      let x = Math.floor((screen.cols - (n * w + (n - 1) * gap)) / 2);
      for (const a of se.awards) {
        const st = STAT[a.stat];
        const col = st ? st.color : UI.accentHi;
        panel(screen, x, yy + 1, w, 4, { tone: col, fill: tint(col, 0.12) });
        screen.text(x + 2, yy + 2, `${st ? st.glyph + ' ' : ''}MEJOR ${String(STAT_LABEL[a.stat]).toUpperCase()}`, col);
        screen.text(x + 2, yy + 3, this.game.displayName(a.id), UI.accentHi);
        x += w + gap;
      }
      yy += 6;
    }

    // balance de la carrera
    const bw = 90, bx = Math.floor((screen.cols - bw) / 2);
    panel(screen, bx, yy + 1, bw, 4, { title: 'LA PEÑA HASTA HOY', tone: UI.edge });
    screen.textCenter(yy + 2, `Títulos de liga: ${player.seasonTitles}   ·   Copas: ${player.cupTitles}   ·   Ascensos: ${player.promotions}`, UI.text);
    const confCol = player.boardConfidence <= 25 ? TONE.bad : player.boardConfidence <= 50 ? TONE.warn : TONE.good;
    screen.textCenter(yy + 3, `Confianza de la junta: ${player.boardConfidence}/100   ·   Reputación: ${player.managerRepLabel}`, confCol);

    const go = bigButton(this.game, 40, 41, 60, 'EMPEZAR LA NUEVA TEMPORADA  [ENTER]', { tone: TONE.good, selected: frame % 40 < 26 });
    if (go || input.hit('Enter') || input.hit(' ')) { this.game.seasonEndInfo = null; this.game.state = 'hub'; }
  }
}
