import { TabsBar } from './TabsBar.js';
import { HELP_TOPICS } from '../data/helpTopics.js';

// Enciclopedia in-game: una página por mecánica, con flechas para pasar,
// para quien llegue nuevo al modo Manager.
export class AyudaScreen {
  constructor(game) { this.game = game; this.page = 0; }

  draw() {
    const { screen, input, player } = this.game;
    screen.clear();
    // visitar Ayuda una vez apaga el aviso de bienvenida de Inicio (ver
    // HubScreen) — no hace falta esperar a que pase la primera semana
    if (!player.helpHintSeen) { player.helpHintSeen = true; player.save(); }
    TabsBar.draw(this.game, 'ayuda');
    screen.textCenter(4, '═══ CÓMO SE JUEGA ═══', '#ffb347');

    const topic = HELP_TOPICS[this.page];
    screen.box(20, 7, 100, 30, '#8a7f66', 'double');
    screen.text(23, 9, topic.title, '#ffe680');
    screen.text(23, 10, '─'.repeat(94), '#5a5347');
    topic.body.forEach((line, i) => screen.text(23, 12 + i, line, '#c9c2a8'));

    screen.text(23, 34, `tema ${this.page + 1} / ${HELP_TOPICS.length}`, '#8a7f66');
    screen.textCenter(38, '[←/→] cambiar de tema   [1] inicio', '#c9c2a8');

    const canPrev = this.page > 0, canNext = this.page < HELP_TOPICS.length - 1;
    if (canPrev) screen.text(21, 9, '◀', '#7CFC00');
    if (canNext) screen.text(117, 9, '▶', '#7CFC00');

    if (input.hit('ArrowLeft') && canPrev) this.page--;
    if (input.hit('ArrowRight') && canNext) this.page++;
  }
}
