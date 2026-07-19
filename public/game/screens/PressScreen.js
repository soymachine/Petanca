import { PRESS_OPTIONS } from '../data/pressTopics.js';
import { rivalPersonalityLine } from '../data/rivalPersonality.js';
import { wrapText } from '../core/utils.js';

// Rueda de prensa antes de un partido gordo: cómo respondas afecta a la
// moral de la peña ahora mismo, y a cómo se toma la derrota si no cumples.
export class PressScreen {
  constructor(game) { this.game = game; this.cursor = 0; }

  draw() {
    const { screen, input, player, frame } = this.game;
    const ctx = this.game.pressContext;
    screen.clear();
    screen.textCenter(6, '═══ RUEDA DE PRENSA ═══', '#ffb347');

    const why = ctx.isEuropean ? `COPA DE EUROPA — ${ctx.roundName}` : ctx.isCup ? `COPA DE ESPAÑA — ${ctx.roundName}` : ctx.isDerby ? 'ES EL DERBI DE SIEMPRE' : ctx.isNemesis ? 'TU NÉMESIS OS ESPERA' : 'ÚLTIMA JORNADA DE LA TEMPORADA';
    screen.textCenter(8, why, '#ef9f9f');
    screen.textCenter(10, `Un periodista del pueblo os para antes del partido contra ${ctx.opponent.name}:`, '#c9c2a8');
    screen.textCenter(12, ctx.isEuropean ? '"¿Cómo veis este cruce europeo?"' : ctx.isCup ? '"¿Cómo veis este cruce de Copa?"' : '"¿Cómo veis el partido de este domingo?"', '#e8ddb8');
    if ((ctx.isDerby || ctx.isNemesis) && ctx.opponent.captain) {
      screen.textCenter(14, `Desde ${ctx.opponent.name}: ${rivalPersonalityLine(ctx.opponent, player.publicImage)}`, '#c8a0e8');
    }

    const w = 25, gap = 2, total = PRESS_OPTIONS.length * w + (PRESS_OPTIONS.length - 1) * gap;
    const x0 = Math.floor((screen.cols - total) / 2);
    PRESS_OPTIONS.forEach((opt, i) => {
      const x = x0 + i * (w + gap);
      const sel = i === this.cursor;
      screen.box(x, 16, w, 11, sel ? '#7CFC00' : '#8a7f66', sel ? 'double' : undefined);
      screen.text(x + Math.floor((w - opt.label.length) / 2), 17, opt.label, sel ? '#ffe680' : '#c9c2a8');
      wrapText(opt.line, w - 4).slice(0, 3).forEach((l, k) => screen.text(x + 2, 19 + k, l, '#9a927a'));
      screen.text(x + 2, 23, `moral: +${opt.moraleNow}`, '#88e088');
      const loseLine = opt.loseBonus < 0 ? `si perdéis: ${opt.loseBonus}` : 'sin castigo';
      wrapText(loseLine, w - 4).slice(0, 1).forEach((l, k) => screen.text(x + 2, 24 + k, l, opt.loseBonus < 0 ? '#ff8c5b' : '#8a8a7a'));
    });

    if (frame % 30 < 20) screen.textCenter(27, '[←/→] elegir   [ENTER] responder y salir a la pista', '#7CFC00');

    if (input.hit('ArrowLeft')) this.cursor = (this.cursor + PRESS_OPTIONS.length - 1) % PRESS_OPTIONS.length;
    if (input.hit('ArrowRight')) this.cursor = (this.cursor + 1) % PRESS_OPTIONS.length;
    if (input.hit('Enter') || input.hit(' ')) {
      const opt = PRESS_OPTIONS[this.cursor];
      for (const id of player.roster.ids) player.roster.get(id).addMoral(opt.moraleNow);
      player.nudgePublicImage(opt.imageDelta || 0);
      player.pressPromise = { optionId: opt.id, loseBonus: opt.loseBonus, opponentId: ctx.opponent.id };
      player.news.push(`RUEDA DE PRENSA: ${opt.line} ${opt.result}`);
      player.save();
      this.game.state = 'lineup';
    }
  }
}
