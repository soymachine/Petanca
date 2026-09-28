import { TITLE_ART } from '../data/art/staticArt.js';
import { Player } from '../model/Player.js';
import { DIFFICULTIES } from '../data/difficulty.js';
import { CITIES } from '../data/cities.js';
import { LeagueWorld } from '../domain/LeagueWorld.js';
import { ForeignLeagueWorld } from '../domain/ForeignLeagueWorld.js';
import { Cup } from '../domain/Cup.js';
import { Club } from '../domain/Club.js';
import { setHomeCountry } from '../data/activeRoster.js';
import { MetaProgress } from '../model/MetaProgress.js';
import { citiesFor, awayCountriesFor, countryLabel, strengthFor } from '../data/countries.js';
import { wrapText, hitRect } from '../core/utils.js';
import { founderStatsForLevel } from '../data/abuelos.js';
import { EDITION } from '../core/edition.js';
import { Settings } from '../core/Settings.js';
import { TitleScene } from '../ui/TitleScene.js';
import { CrestGenerator } from '../portraits/CrestGenerator.js';
import { UI, TONE, tint } from '../ui/theme.js';
import { panel, bigButton, button } from '../ui/widgets.js';

const PICKABLE_COUNTRIES = ['ES', 'FR', 'IT', 'BE', 'CH', 'PT'];

export class TitleScreen {
  constructor(game) {
    this.game = game;
    this.diffCursor = 1;
    this.pickingSlot = false;
    this.slotCursor = Player.activeSlot() - 1;
    this.importMsg = null;
    // selector de país/ciudad de una partida nueva (ver MetaProgress.js):
    // solo se le pregunta esto a un Player recién construido, uno por uno
    this.countryChosen = false;
    this.countryCursor = 0;
    this.selectedCountry = 'ES';
    this.cityChosen = false;
    this.cityCursor = 0;
    this.scene = new TitleScene();
    this.t = 0;
  }

  // tarjeta elegible de los selectores (país/ciudad/dificultad/perfil):
  // devuelve true si se ha hecho clic en ella
  _card(x, y, w, h, sel, locked) {
    const { screen, input } = this.game;
    const over = !locked && hitRect(input.mouse.cx, input.mouse.cy, x, y, w, h);
    const tone = locked ? '#3a372f' : sel ? TONE.good : over ? UI.accentHi : UI.edge;
    panel(screen, x, y, w, h, { tone, style: sel && !locked ? 'double' : 'single', fill: locked ? '#0d1016' : sel ? tint(TONE.good, 0.14) : over ? UI.panelHi : 'rgba(16,21,31,0.92)' });
    return over && input.mouse.clicked;
  }

  draw() {
    const { screen, input, player, frame, photoBanner } = this.game;
    screen.clear();
    this.t += this.game.lastDt || 1 / 60;
    // escena animada de fondo (ui/TitleScene.js) entre el logo y el menú
    const still = Settings.get('reduceMotion') || this.game.frozen;
    const t = still ? 2.2 : this.t;
    screen.layer('under', (c, R) => this.scene.draw(c, R, 8.5, 31, t, still));
    // el logo, con su resplandor y un leve balanceo
    const lx = Math.floor((screen.cols - 60) / 2), ly = 1;
    screen.block(lx, ly, TITLE_ART, '#ffb347');
    screen.glow(lx, ly, 60, TITLE_ART.length);
    screen.textCenter(ly + TITLE_ART.length + 1, '~ el noble arte de la petanca española ~', '#e8c890');
    void photoBanner;

    if (this.pickingSlot) { this._drawSlotPicker(); return; }
    // un perfil que ya llegó a GAME OVER (ver Career.finishWeeklyMatch)
    // se queda bloqueado ahí aunque se recargue la página — no hay "seguir
    // jugando" posible, solo empezar de cero (ver GameOverScreen)
    if (player.gameOver) { this.game.state = 'gameover'; return; }
    if (!player.difficultyChosen) {
      // partida nueva de verdad: primero país (ver MetaProgress.js — todos
      // bloqueados menos España hasta ganar la primera Copa de Europa),
      // luego ciudad dentro de ese país (bloqueadas por encima del techo ya
      // alcanzado alguna vez ahí), y solo entonces la dificultad de siempre
      if (!this.countryChosen) { this._drawCountryPicker(); return; }
      if (!this.cityChosen) { this._drawCityPicker(); return; }
      this._drawDifficultyPicker();
      return;
    }

    // tarjeta del club + botón grande de empezar
    const cw = 70, cx0 = Math.floor((screen.cols - cw) / 2);
    panel(screen, cx0, 32, cw, 5, { tone: UI.edge, fill: 'rgba(16,21,31,0.92)' });
    screen.drawPortrait(CrestGenerator.generateMini(player.clubName), cx0 + 2, 32);
    screen.text(cx0 + 12, 33, player.clubName, UI.accentHi);
    screen.text(cx0 + 12, 34, `Liga de ${player.league.cityName} · nivel ${player.currentLeagueLevel}/8`, UI.text);
    screen.text(cx0 + 12, 35, `${player.money}€   ·   ${player.wins}G ${player.losses}P   ·   perfil ${Player.activeSlot()}/${Player.SLOT_COUNT}`, UI.textDim);
    const start = bigButton(this.game, Math.floor((screen.cols - 50) / 2), 38, 50, '▶  EMPEZAR A JUGAR  [ENTER]', { tone: TONE.good, selected: frame % 40 < 26 });
    const canErase = player.wins + player.losses > 0;
    const bx = Math.floor((screen.cols - (canErase ? 46 : 20)) / 2);
    const goSlots = button(this.game, bx, 42, '[P] PERFILES', { w: 20 });
    const erase = canErase && button(this.game, bx + 22, 42, '[B] BORRAR PARTIDA', { w: 24, tone: TONE.bad });
    screen.text(Math.floor((screen.cols - 54) / 2), 45, 'F11 pantalla completa · F8 efectos CRT · F7 vista del partido', UI.textFaint);

    if (start || input.hit('Enter') || input.hit(' ')) this.game.state = 'hub';
    if (erase) {
      this.game.player = Player.resetSave();
      this.diffCursor = 1;
    }
    if (goSlots) { this.pickingSlot = true; this.slotCursor = Player.activeSlot() - 1; }
    if (input.hit('b') || input.hit('B')) {
      this.game.player = Player.resetSave();
      this.diffCursor = 1;
    }
    if (input.hit('p') || input.hit('P')) { this.pickingSlot = true; this.slotCursor = Player.activeSlot() - 1; }
  }

  _drawSlotPicker() {
    const { screen, input } = this.game;
    screen.textCenter(33, 'PERFILES DE PARTIDA', UI.accentHi);
    const w = 34, gap = 3, n = Player.SLOT_COUNT, total = n * w + (n - 1) * gap;
    const x0 = Math.floor((screen.cols - total) / 2);
    let pick = false;
    for (let i = 0; i < n; i++) {
      const slot = i + 1;
      const x = x0 + i * (w + gap);
      const sel = i === this.slotCursor;
      const active = slot === Player.activeSlot();
      if (this._card(x, 35, w, 7, sel, false)) { this.slotCursor = i; pick = true; }
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
    if (pick || input.hit('Enter') || input.hit(' ')) {
      const slot = this.slotCursor + 1;
      if (slot !== Player.activeSlot()) {
        Player.switchSlot(slot);
        if (typeof window !== 'undefined' && window.location && window.location.reload) window.location.reload();
        else {
          this.game.player = Player.load();
          // el perfil al que se cambia puede ser de otro país de casa: el
          // roster de 10 abuelos/retratos activo (ver data/activeRoster.js)
          // hay que recalcularlo aquí también, no solo al arrancar Game
          setHomeCountry(this.game.player.homeCountry);
        }
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

  // Selector de país de una partida nueva: España siempre disponible, el
  // resto bloqueado hasta ganar la primera Copa de Europa en cualquier
  // partida (ver MetaProgress.unlockAllCountries, disparado desde
  // Game._finishEuroCupMatch) — ese desbloqueo es de por vida, para
  // cualquier partida futura, no solo la que estaba en marcha al ganarla.
  // En edición 'demo' (ver core/edition.js) MetaProgress.unlockAllCountries
  // es un no-op, así que estas casillas se quedan en BLOQUEADO para
  // siempre sin tocar nada más aquí — el texto de abajo es lo único que
  // cambia para no prometer un desbloqueo que esa edición no puede cumplir.
  _drawCountryPicker() {
    const { screen, input } = this.game;
    screen.textCenter(31, '¿DESDE QUÉ PAÍS EMPEZAMOS?', UI.accentHi);
    screen.textCenter(32, EDITION === 'demo'
      ? 'el resto de países están disponibles en la versión completa'
      : 'el resto se desbloquea al ganar la primera Copa de Europa', UI.textDim);
    const w = 20, gap = 2, total = PICKABLE_COUNTRIES.length * w + (PICKABLE_COUNTRIES.length - 1) * gap;
    const x0 = Math.floor((screen.cols - total) / 2);
    let pick = false;
    PICKABLE_COUNTRIES.forEach((code, i) => {
      const x = x0 + i * (w + gap);
      const sel = i === this.countryCursor;
      const unlocked = MetaProgress.isCountryUnlocked(code);
      if (this._card(x, 34, w, 7, sel, !unlocked)) { this.countryCursor = i; pick = true; }
      const label = countryLabel(code);
      screen.text(x + Math.max(0, Math.floor((w - label.length) / 2)), 36, label, !unlocked ? '#6a6355' : sel ? '#ffe680' : '#c9c2a8');
      if (!unlocked) screen.text(x + Math.floor((w - 9) / 2), 38, 'BLOQUEADO', '#8a5a3a');
    });
    screen.textCenter(44, '[←/→] elegir país   [ENTER] confirmar', '#c9c2a8');

    if (input.hit('ArrowLeft')) this.countryCursor = (this.countryCursor + PICKABLE_COUNTRIES.length - 1) % PICKABLE_COUNTRIES.length;
    if (input.hit('ArrowRight')) this.countryCursor = (this.countryCursor + 1) % PICKABLE_COUNTRIES.length;
    if (pick || input.hit('Enter') || input.hit(' ')) {
      const code = PICKABLE_COUNTRIES[this.countryCursor];
      if (MetaProgress.isCountryUnlocked(code)) {
        this.selectedCountry = code;
        this.countryChosen = true;
        this.cityCursor = 0;
      }
    }
  }

  // Selector de ciudad dentro del país elegido: solo el suelo de ese país
  // (Albacete en España, la ciudad de nivel 6 en un extranjero) está
  // garantizado; el resto se va desbloqueando partida a partida al
  // ascender (ver MetaProgress.recordLevelReached, Career.js fin de
  // temporada) — lo alcanzado en UNA partida sirve para elegir de entrada
  // en la SIGUIENTE, no en la que está en marcha.
  _drawCityPicker() {
    const { screen, input } = this.game;
    const country = this.selectedCountry;
    const cities = citiesFor(country);
    const maxSel = MetaProgress.maxSelectableLevel(country);
    screen.textCenter(31, `¿EN QUÉ CIUDAD DE ${countryLabel(country).toUpperCase()} EMPEZAMOS?`, UI.accentHi);
    screen.textCenter(32, 'las demás se desbloquean subiendo de categoría en otras partidas', UI.textDim);
    const w = 15, gap = 1, total = cities.length * w + (cities.length - 1) * gap;
    const x0 = Math.floor((screen.cols - total) / 2);
    let pick = false;
    cities.forEach((c, i) => {
      const x = x0 + i * (w + gap);
      const sel = i === this.cityCursor;
      const unlocked = c.diff <= maxSel;
      if (this._card(x, 35, w, 7, sel, !unlocked)) { this.cityCursor = i; pick = true; }
      screen.text(x + Math.floor((w - String(c.diff).length) / 2), 36, `${c.diff}`, !unlocked ? '#6a6355' : sel ? '#ffe680' : '#c9c2a8');
      wrapText(c.name, w - 2).slice(0, 2).forEach((l, k) => screen.text(x + 1, 38 + k, l, !unlocked ? '#5a5347' : sel ? '#fff' : '#9a927a'));
      if (!unlocked) screen.text(x + Math.floor((w - 9) / 2), 40, 'BLOQUEADA', '#8a5a3a');
    });
    screen.textCenter(44, '[←/→] elegir ciudad   [ENTER] confirmar   [ESC] cambiar de país', '#c9c2a8');

    if (input.hit('ArrowLeft')) this.cityCursor = (this.cityCursor + cities.length - 1) % cities.length;
    if (input.hit('ArrowRight')) this.cityCursor = (this.cityCursor + 1) % cities.length;
    if (input.hit('Escape')) { this.countryChosen = false; input.pressed.Escape = false; }
    if (pick || input.hit('Enter') || input.hit(' ')) {
      const city = cities[this.cityCursor];
      if (city.diff <= maxSel) {
        this._confirmCountryAndCity(country, city.diff);
        this.cityChosen = true;
      }
    }
  }

  // aplica el país/ciudad elegidos al Player recién construido: si es
  // España-Albacete (el estado por defecto del constructor) no hay nada
  // que regenerar; para cualquier otra combinación, reconstruye clubName/
  // leagueWorld/foreignLeagues/cup igual que ya hacía el viejo picker de
  // debug para un nivel dentro de España, más el reparto de abuelos/
  // retratos activo (ver data/activeRoster.js) y quién se simula de fondo.
  _confirmCountryAndCity(country, level) {
    const { player } = this.game;
    if (country !== 'ES' || level !== 1) {
      player.homeCountry = country;
      player.clubName = Club.randomName(new Set(), country);
      player.currentLeagueLevel = level;
      setHomeCountry(country);
      player.leagueWorld = LeagueWorld.generate(level, player.clubName, country);
      player.foreignLeagues = new Map();
      for (const { code, cities } of awayCountriesFor(country)) player.foreignLeagues.set(code, ForeignLeagueWorld.generate(code, cities));
      // el fundador arranca a la altura de la liga elegida, no con las
      // stats fijas de serie del constructor (pensadas para Albacete) —
      // ver founderStatsForLevel
      player.roster.get(0).genStats = founderStatsForLevel(level * strengthFor(country));
      player.cup = Cup.generate(player.leagueWorld, player.club, player.club.avgSkill(player.roster));
      // player.euroCup ya es null desde el constructor (no se sortea hasta
      // el fin de la primera temporada, ver Career.js) — nada que rehacer
      // aquí para este país/nivel
      // el constructor de Player ya había agendado un cruce de Copa por
      // defecto (España/Albacete, antes de saber qué ciudad se iba a elegir
      // de verdad) — sin limpiarlo primero, firstFreeDayFrom lo ve ocupado
      // y agenda el cruce real al día SIGUIENTE, dejando dos partidos de
      // Copa contra el mismo rival en días consecutivos (bug real, no solo
      // cosmético: ambos leen del mismo `player.cup`)
      player.seasonClock.cupMatches = {};
      player.seasonClock.scheduleCup(player.seasonClock.firstFreeDayFrom(3, player.league));
    }
    player.save();
  }

  _drawDifficultyPicker() {
    const { screen, input, player } = this.game;
    screen.textCenter(33, '¿CON QUÉ DIFICULTAD EMPEZAMOS?', UI.accentHi);
    const w = 36, gap = 2, total = DIFFICULTIES.length * w + (DIFFICULTIES.length - 1) * gap;
    const x0 = Math.floor((screen.cols - total) / 2);
    let pick = false;
    DIFFICULTIES.forEach((d, i) => {
      const x = x0 + i * (w + gap);
      const sel = i === this.diffCursor;
      if (this._card(x, 35, w, 8, sel, false)) { this.diffCursor = i; pick = true; }
      screen.text(x + Math.floor((w - d.name.length) / 2), 36, d.name, sel ? '#ffe680' : '#c9c2a8');
      wrapText(d.desc, w - 4).forEach((l, k) => screen.text(x + 2, 38 + k, l, '#9a927a'));
    });
    screen.textCenter(44, '[←/→] elegir   [ENTER] confirmar y empezar', '#c9c2a8');
    screen.textCenter(45, `[D] Modo Debugger: ${player.debugMode ? 'ACTIVADO' : 'desactivado'} — resuelve partidos por estadísticas y deja ver plantillas rivales`,
      player.debugMode ? '#7ec850' : '#8a8a7a');

    if (input.hit('ArrowLeft')) this.diffCursor = (this.diffCursor + DIFFICULTIES.length - 1) % DIFFICULTIES.length;
    if (input.hit('ArrowRight')) this.diffCursor = (this.diffCursor + 1) % DIFFICULTIES.length;
    if (input.hit('d') || input.hit('D')) { player.debugMode = !player.debugMode; player.save(); }
    if (pick || input.hit('Enter') || input.hit(' ')) {
      const d = DIFFICULTIES[this.diffCursor];
      player.difficulty = d.id;
      player.money = Math.round(player.money * d.moneyMult);
      player.difficultyChosen = true;
      player.save();
    }
  }
}
