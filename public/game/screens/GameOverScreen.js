import { Player } from '../model/Player.js';
import { EDITION } from '../core/edition.js';
import { UI, TONE } from '../ui/theme.js';
import { panel, bigButton, pixelTitle } from '../ui/widgets.js';

// Fin de la partida: se llega aquí desde Career.finishWeeklyMatch cuando
// GAME_OVER_NEGATIVE_WEEKS jornadas seguidas cierran con dinero negativo
// (ver HubScreen, que avisa de la cuenta atrás mientras dura la racha).
// No hay TabsBar ni forma de volver al Hub: la única salida es empezar una
// partida nueva en este mismo perfil (reutiliza Player.resetSave(), el
// mismo camino que el [B] "borrar partida guardada" de TitleScreen).
export class GameOverScreen {
  constructor(game) { this.game = game; }

  draw() {
    const { screen, input, player, frame } = this.game;
    screen.clear();
    const col = frame % 30 < 20 ? TONE.bad : '#a03838';
    pixelTitle(screen, 8, 'GAME OVER', col, 3.2);
    screen.textCenter(13, `☠  ${player.clubName} echa el cierre  ☠`, UI.accent);
    screen.textCenter(15, `${player.negativeWeeksStreak} jornadas seguidas en números rojos (${player.money}€) hunden las cuentas de la peña.`, UI.text);

    const w = 80, x = Math.floor((screen.cols - w) / 2);
    panel(screen, x, 18, w, 7, { title: 'LO QUE QUEDA DE LA AVENTURA', tone: UI.edge, titleColor: UI.accent });
    screen.textCenter(20, `Liga alcanzada: nivel ${player.currentLeagueLevel}/8   ·   ${player.wins}G ${player.losses}P`, UI.text);
    screen.textCenter(21, `Títulos de liga: ${player.seasonTitles}   ·   Copas: ${player.cupTitles}${EDITION === 'demo' ? '' : `   ·   Copas de Europa: ${player.euroCupTitles}`}`, UI.text);
    screen.textCenter(22, `Ascensos: ${player.promotions}   ·   Descensos: ${player.relegations}`, UI.text);

    const again = bigButton(this.game, 40, 32, 60, 'EMPEZAR UNA PARTIDA NUEVA  [ENTER]', { tone: TONE.good, sub: 'en este mismo perfil' });
    if (again) { this.game.player = Player.resetSave(); this.game.state = 'title'; return; }

    if (input.hit('Enter') || input.hit(' ')) {
      this.game.player = Player.resetSave();
      this.game.state = 'title';
    }
  }
}
