import { TROPHY_ART } from '../data/art/staticArt.js';
import { STAT_LABEL } from '../data/abuelos.js';

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
    if (champion || se.promoted) {
      screen.block(Math.floor((screen.cols - 21) / 2), 2, TROPHY_ART, '#ffe14d');
    }

    screen.textCenter(champion || se.promoted ? 14 : 4, '═══ FIN DE TEMPORADA ═══', '#ffb347');
    let yy = (champion || se.promoted) ? 16 : 6;
    screen.textCenter(yy++, `${player.clubName} acaba ${se.rank}º de 10 en la liga de ${se.cityName}`, '#e8ddb8');
    if (champion) screen.textCenter(yy++, '★ ★ ★  ¡CAMPEONES DE LIGA!  ★ ★ ★', frame % 20 < 14 ? '#ffe14d' : '#c9a35d');
    if (se.promoted) screen.textCenter(yy++, '¡ASCENSO A LA SIGUIENTE CATEGORÍA!', '#7CFC00');
    else if (se.relegated) screen.textCenter(yy++, 'Descenso a la categoría inferior.', '#ff8c5b');
    else screen.textCenter(yy++, 'Se mantiene la categoría — a por la siguiente.', '#c9c2a8');
    yy += 2;

    if (se.awards && se.awards.length) {
      screen.textCenter(yy++, 'PREMIOS DE LA PEÑA', '#ffb347');
      for (const a of se.awards) {
        screen.textCenter(yy++, `Mejor ${STAT_LABEL[a.stat]}: ${this.game.displayName(a.id)}`, '#d8b8e8');
      }
      yy++;
    }

    screen.textCenter(yy++, `Títulos de liga: ${player.seasonTitles}   ·   Copas: ${player.cupTitles}   ·   Ascensos: ${player.promotions}`, '#9a927a');
    const confCol = player.boardConfidence <= 25 ? '#ff5c5c' : player.boardConfidence <= 50 ? '#ffe14d' : '#88e088';
    screen.textCenter(yy++, `Confianza de la junta: ${player.boardConfidence}/100   ·   Reputación: ${player.managerRepLabel}`, confCol);

    screen.textCenter(42, '[ENTER] empezar la nueva temporada', '#7CFC00');
    if (input.hit('Enter') || input.hit(' ')) { this.game.seasonEndInfo = null; this.game.state = 'hub'; }
  }
}
