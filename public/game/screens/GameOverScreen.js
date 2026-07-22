import { Player } from '../model/Player.js';

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
    const col = frame % 30 < 20 ? '#ff5c5c' : '#a03838';
    screen.textCenter(10, '☠ GAME OVER ☠', col);
    screen.textCenter(13, `${player.clubName} echa el cierre`, '#ffb347');
    screen.textCenter(15, `${player.negativeWeeksStreak} jornadas seguidas en números rojos (${player.money}€) hunden las cuentas de la peña.`, '#c9c2a8');

    screen.textCenter(19, 'LO QUE QUEDA DE LA AVENTURA', '#ffb347');
    screen.textCenter(21, `Liga alcanzada: nivel ${player.currentLeagueLevel}/8   ·   ${player.wins}G ${player.losses}P`, '#c9c2a8');
    screen.textCenter(22, `Títulos de liga: ${player.seasonTitles}   ·   Copas: ${player.cupTitles}   ·   Copas de Europa: ${player.euroCupTitles}`, '#c9c2a8');
    screen.textCenter(23, `Ascensos: ${player.promotions}   ·   Descensos: ${player.relegations}`, '#c9c2a8');

    screen.textCenter(34, '[ENTER] empezar una partida nueva en este perfil', '#7CFC00');

    if (input.hit('Enter') || input.hit(' ')) {
      this.game.player = Player.resetSave();
      this.game.state = 'title';
    }
  }
}
