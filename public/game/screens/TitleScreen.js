import { TITLE_ART } from '../data/art/staticArt.js';
import { Player } from '../model/Player.js';
import { DIFFICULTIES } from '../data/difficulty.js';
import { CITIES } from '../data/cities.js';
import { LeagueWorld } from '../domain/LeagueWorld.js';
import { Cup } from '../domain/Cup.js';
import { wrapText, hitRect } from '../core/utils.js';

export class TitleScreen {
  constructor(game) {
    this.game = game;
    this.diffCursor = 1;
    this.pickingSlot = false;
    this.slotCursor = Player.activeSlot() - 1;
    this.importMsg = null;
    this.levelChosen = false;
    this.levelCursor = 0;
  }

  draw() {
    const { screen, input, player, frame, photoBanner } = this.game;
    screen.clear();
    screen.block(Math.floor((screen.cols - 60) / 2), 2, TITLE_ART, '#ffb347');
    screen.textCenter(9, '~ el noble arte de la petanca española ~', '#c9b98a');
    const bx = Math.floor((screen.cols - photoBanner.cols) / 2);
    screen.box(bx - 2, 11, photoBanner.cols + 4, photoBanner.rows + 2, '#8a7f66', 'double');
    screen.drawPhotoArt(photoBanner, bx, 12);

    if (this.pickingSlot) { this._drawSlotPicker(); return; }
    if (!player.difficultyChosen) {
      // partida nueva de verdad (0-0, aún en Albacete): antes de la
      // dificultad, se puede elegir de debug en qué liga empezar (para
      // poder llegar rápido a nivel 8 y probar la Copa de Europa)
      const isFreshGame = player.wins + player.losses === 0 && player.currentLeagueLevel === 1;
      if (isFreshGame && !this.levelChosen) { this._drawLevelPicker(); return; }
      this._drawDifficultyPicker();
      return;
    }

    const startLabel = '▶ [ ENTER ]  EMPEZAR A JUGAR ◀';
    const startRect = { x: Math.floor((screen.cols - startLabel.length) / 2), y: 34, w: startLabel.length, h: 1 };
    const startHover = hitRect(input.mouse.cx, input.mouse.cy, startRect.x, startRect.y, startRect.w, startRect.h);
    if (frame % 40 < 26 || startHover) screen.textCenter(34, startLabel, startHover ? '#ffe680' : '#7CFC00');
    screen.textCenter(37, `${player.clubName}   ·   Liga de ${player.league.cityName} (nivel ${player.currentLeagueLevel}/8)   ·   ${player.money}€   G:${player.wins} P:${player.losses}`, '#e8e0c8');
    screen.textCenter(39, `Perfil ${Player.activeSlot()} de ${Player.SLOT_COUNT}   ·   [P] cambiar de perfil${player.wins + player.losses > 0 ? '   ·   [B] borrar partida guardada' : ''}`, '#8a7f66');
    screen.textCenter(43, 'foto: Wikimedia Commons · filtro ASCII casero · hecho con cariño y albero', '#556');

    if (input.hit('Enter') || input.hit(' ') || (input.mouse.clicked && startHover)) this.game.state = 'hub';
    if (input.hit('b') || input.hit('B')) {
      this.game.player = Player.resetSave();
      this.diffCursor = 1;
    }
    if (input.hit('p') || input.hit('P')) { this.pickingSlot = true; this.slotCursor = Player.activeSlot() - 1; }
  }

  _drawSlotPicker() {
    const { screen, input } = this.game;
    screen.textCenter(33, 'PERFILES DE PARTIDA', '#ffb347');
    const w = 34, gap = 3, n = Player.SLOT_COUNT, total = n * w + (n - 1) * gap;
    const x0 = Math.floor((screen.cols - total) / 2);
    for (let i = 0; i < n; i++) {
      const slot = i + 1;
      const x = x0 + i * (w + gap);
      const sel = i === this.slotCursor;
      const active = slot === Player.activeSlot();
      screen.box(x, 35, w, 7, sel ? '#7CFC00' : '#8a7f66', sel ? 'double' : undefined);
      screen.text(x + 2, 36, `PERFIL ${slot}${active ? ' (activo)' : ''}`, active ? '#ffe14d' : sel ? '#fff' : '#c9c2a8');
      const summary = Player.slotSummary(slot);
      if (summary) {
        screen.text(x + 2, 38, summary.clubName.slice(0, w - 4), '#9a927a');
        screen.text(x + 2, 39, `${summary.money}€  ·  G:${summary.wins} P:${summary.losses}`, '#88c8e8');
      } else {
        screen.text(x + 2, 38, 'vacío — partida nueva', '#8a8a7a');
      }
    }
    screen.textCenter(44, '[←/→] elegir   [ENTER] jugar   [E] exportar   [I] importar   [ESC] cancelar', '#c9c2a8');
    if (this.importMsg) screen.textCenter(45, this.importMsg, this.importMsg.startsWith('✔') ? '#7CFC00' : '#ff5c5c');

    if (input.hit('ArrowLeft')) this.slotCursor = (this.slotCursor + Player.SLOT_COUNT - 1) % Player.SLOT_COUNT;
    if (input.hit('ArrowRight')) this.slotCursor = (this.slotCursor + 1) % Player.SLOT_COUNT;
    if (input.hit('Escape')) { this.pickingSlot = false; input.pressed.Escape = false; }
    if (input.hit('e') || input.hit('E')) this._exportSlot(this.slotCursor + 1);
    if (input.hit('i') || input.hit('I')) this._importSlot(this.slotCursor + 1);
    if (input.hit('Enter') || input.hit(' ')) {
      const slot = this.slotCursor + 1;
      if (slot !== Player.activeSlot()) {
        Player.switchSlot(slot);
        if (typeof window !== 'undefined' && window.location && window.location.reload) window.location.reload();
        else this.game.player = Player.load();
      }
      this.pickingSlot = false;
    }
  }

  // copia de seguridad de un perfil: se descarga como archivo .json (o se
  // carga uno) para no depender solo de localStorage del navegador
  _exportSlot(slot) {
    const raw = Player.exportSlot(slot);
    if (!raw) { this.importMsg = '✘ ese perfil está vacío, no hay nada que exportar'; return; }
    const blob = new Blob([raw], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `petanka-perfil-${slot}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.importMsg = `✔ perfil ${slot} descargado`;
  }

  _importSlot(slot) {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'application/json,.json';
    input.onchange = () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          Player.importIntoSlot(slot, reader.result);
          this.importMsg = `✔ perfil ${slot} importado`;
          if (slot === Player.activeSlot()) window.location.reload();
        } catch (e) {
          this.importMsg = '✘ ese archivo no es un guardado válido';
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  // DEBUG: elegir la liga (nivel 1-8) donde arranca la partida nueva, para
  // no tener que subir jornada a jornada hasta Madrid solo para probar la
  // Copa de Europa. Reconstruye leagueWorld/cup con el nivel elegido, igual
  // que hace un ascenso/descenso normal (LeagueWorld.movePlayer los mueve;
  // aquí como es el arranque, se regenera directamente en ese nivel).
  _drawLevelPicker() {
    const { screen, input, player } = this.game;
    screen.textCenter(31, 'DEBUG: ¿EN QUÉ LIGA EMPEZAMOS?', '#ffb347');
    screen.textCenter(32, '(para testear temporadas rápido — deja Albacete si no lo necesitas)', '#8a7f66');
    const w = 15, gap = 1, total = CITIES.length * w + (CITIES.length - 1) * gap;
    const x0 = Math.floor((screen.cols - total) / 2);
    CITIES.forEach((c, i) => {
      const x = x0 + i * (w + gap);
      const sel = i === this.levelCursor;
      screen.box(x, 35, w, 7, sel ? '#7CFC00' : '#8a7f66', sel ? 'double' : undefined);
      screen.text(x + Math.floor((w - String(c.diff).length) / 2), 36, `${c.diff}`, sel ? '#ffe680' : '#c9c2a8');
      wrapText(c.name, w - 2).slice(0, 2).forEach((l, k) => screen.text(x + 1, 38 + k, l, sel ? '#fff' : '#9a927a'));
    });
    screen.textCenter(44, '[←/→] elegir liga   [ENTER] confirmar', '#c9c2a8');

    if (input.hit('ArrowLeft')) this.levelCursor = (this.levelCursor + CITIES.length - 1) % CITIES.length;
    if (input.hit('ArrowRight')) this.levelCursor = (this.levelCursor + 1) % CITIES.length;
    if (input.hit('Enter') || input.hit(' ')) {
      const lvl = CITIES[this.levelCursor].diff;
      if (lvl !== 1) {
        player.currentLeagueLevel = lvl;
        player.leagueWorld = LeagueWorld.generate(lvl, player.clubName);
        player.cup = Cup.generate(player.leagueWorld, player.club, player.club.avgSkill(player.roster));
        player.seasonClock.scheduleCup(player.seasonClock.firstFreeDayFrom(3, player.league));
        player.save();
      }
      this.levelChosen = true;
    }
  }

  _drawDifficultyPicker() {
    const { screen, input, player } = this.game;
    screen.textCenter(33, '¿CON QUÉ DIFICULTAD EMPEZAMOS?', '#ffb347');
    const w = 36, gap = 2, total = DIFFICULTIES.length * w + (DIFFICULTIES.length - 1) * gap;
    const x0 = Math.floor((screen.cols - total) / 2);
    DIFFICULTIES.forEach((d, i) => {
      const x = x0 + i * (w + gap);
      const sel = i === this.diffCursor;
      screen.box(x, 35, w, 8, sel ? '#7CFC00' : '#8a7f66', sel ? 'double' : undefined);
      screen.text(x + Math.floor((w - d.name.length) / 2), 36, d.name, sel ? '#ffe680' : '#c9c2a8');
      wrapText(d.desc, w - 4).forEach((l, k) => screen.text(x + 2, 38 + k, l, '#9a927a'));
    });
    screen.textCenter(44, '[←/→] elegir   [ENTER] confirmar y empezar', '#c9c2a8');
    screen.textCenter(45, `[D] Modo Debugger: ${player.debugMode ? 'ACTIVADO' : 'desactivado'} — resuelve partidos por estadísticas y deja ver plantillas rivales`,
      player.debugMode ? '#7ec850' : '#8a8a7a');

    if (input.hit('ArrowLeft')) this.diffCursor = (this.diffCursor + DIFFICULTIES.length - 1) % DIFFICULTIES.length;
    if (input.hit('ArrowRight')) this.diffCursor = (this.diffCursor + 1) % DIFFICULTIES.length;
    if (input.hit('d') || input.hit('D')) { player.debugMode = !player.debugMode; player.save(); }
    if (input.hit('Enter') || input.hit(' ')) {
      const d = DIFFICULTIES[this.diffCursor];
      player.difficulty = d.id;
      player.money = Math.round(player.money * d.moneyMult);
      player.difficultyChosen = true;
      player.save();
    }
  }
}
