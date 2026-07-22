import { Roster } from './Roster.js';
import { Season } from './Season.js';
import { Campaign } from './Campaign.js';
import { NewsFeed } from './NewsFeed.js';
import { Sponsorship } from './Sponsorship.js';
import { FacilityManager } from './FacilityManager.js';
import { LineupPresets } from './LineupPresets.js';
import { LeagueWorld } from '../domain/LeagueWorld.js';
import { ForeignLeagueWorld } from '../domain/ForeignLeagueWorld.js';
import { awayCountriesFor } from '../data/countries.js';
import { emptyConsumableStock } from '../data/consumables.js';
import { SeasonClock } from '../domain/SeasonClock.js';
import { FreeAgentPool } from '../domain/FreeAgentPool.js';
import { Cup } from '../domain/Cup.js';
import { EuropeanCup } from '../domain/EuropeanCup.js';
import { ScoutStaff } from './ScoutStaff.js';
import { boardObjectiveFor, rollWeeklyGoal, weeklyGoalToJSON, weeklyGoalFromJSON } from '../data/boardObjectives.js';
import { hashStr, clamp } from '../core/utils.js';
import { founderStatsForLevel } from '../data/abuelos.js';
import { strengthFor } from '../data/countries.js';

const SAVE_KEY = 'petanka_save_v4';
const LEGACY_KEYS = ['petanka_save_v3', 'petanka_save_v2', 'petanka_save_v1'];
const ACTIVE_SLOT_KEY = 'petanka_active_slot';
const SLOT_COUNT = 3;

// perfiles de partida: el 1 usa la clave de siempre (para no romper
// guardados existentes); el 2 y el 3 tienen su propia clave aparte.
function keyForSlot(slot) { return slot === 1 ? SAVE_KEY : `${SAVE_KEY}_slot${slot}`; }
const CLUB_NAMES = ['PEÑA EL BOLICHE', 'CLUB LA BOINA', 'SOCIEDAD SAN ISIDRO', 'AGRUPACIÓN LA AMISTAD'];

function xpForLevel(lv) { return lv * 300; }

// Raíz del guardado: todo lo que persiste de una partida. Compone las demás
// clases de modelo en vez de ser un objeto plano gigante.
export class Player {
  constructor() {
    // seguimiento de economía (ver pestaña Economía en El Club /
    // economyLastWeeks): se declara ANTES de fijar el dinero inicial porque
    // this.money ya pasa por el setter de más abajo — con seasonClock
    // todavía sin existir en este punto, ese primer ajuste no se cuenta
    // como ingreso (es capital de fundación, no una transacción de verdad)
    this._money = 0;
    this.totalEarned = 0; // suma histórica de toda la vida, nunca se poda
    this.totalSpent = 0;
    this.economyByWeek = {}; // { [weekIndex]: { income, expense } } — ventana móvil (ver el setter de money), no crece sin límite
    this.money = 150;
    this.xp = 0;
    this.level = 1;
    this.wins = 0;
    this.losses = 0;
    this.captain = 0;
    this.freePick = true;
    this.roster = new Roster([0]);
    this.season = new Season();
    this.campaign = new Campaign();
    this.news = new NewsFeed();
    this.sponsorship = new Sponsorship();
    this.facilities = new FacilityManager();
    this.presets = new LineupPresets();
    this.bolasOwned = [0];
    this.bolaSel = 0;
    // existencias de consumibles de un solo uso en partido (tila/gel/talco/
    // "a por todas" — ver data/consumables.js): distinto de los amuletos de
    // toda la vida (this.roster.get(id).item), esto es stock de club que se
    // va gastando tirada a tirada, no algo equipado a un abuelo en concreto
    this.consumables = emptyConsumableStock();
    this.nemesis = null;
    this.derbyClubId = null;
    this.derbyHistory = { wins: 0, losses: 0 };
    this.citiesWon = [];
    this.nemesisDefeats = 0;
    // victorias en la Copa de Europa contra un club de un país más fuerte
    // que el tuyo (Francia/Italia/Bélgica, strength>1 — ver countries.js):
    // dar la campanada fuera cuenta más para el prestigio que ganar en casa
    this.euroUpsets = 0;
    this.seasonTitles = 0;
    this.stormWins = 0;
    this.boardConfidence = 60; // 0-100: paciencia de la junta directiva
    this.boardUltimatums = 0;
    this.boardCrisis = false; // true tras un primer ultimátum de la temporada: el segundo ya no es solo una multa
    // números rojos sostenidos: jornadas SEGUIDAS cerrando la semana con
    // dinero negativo (ver Career.finishWeeklyMatch/GAME_OVER_NEGATIVE_WEEKS)
    // — al llegar al límite, gameOver se queda fijo en true para siempre
    // (no se resetea ni cargando la partida) y bloquea el juego en
    // GameOverScreen hasta empezar una partida nueva en este perfil.
    this.negativeWeeksStreak = 0;
    this.gameOver = false;
    this.difficulty = 'normal';
    this.difficultyChosen = false;
    // modo Debugger: fuerza los partidos a resolverse por estadísticas y
    // deja mirar plantillas rivales al vuelo — para testear sistemas rápido
    this.debugMode = false;
    this.pressPromise = null;
    // revelado progresivo de onboarding: Mercado, Ojeadores, Patrocinios y
    // Junta empiezan ocultos en una partida NUEVA y se van desbloqueando
    // solos las primeras semanas (ver Career._maybeRevealSystems), con su
    // propio titular de Hemeroteca al abrirse — para no volcar los nueve
    // apartados del juego encima de quien acaba de empezar. No cambia
    // ninguna simulación de fondo (el Mercado y la Junta siguen corriendo
    // igual): solo tapa la pestaña hasta que toca enseñarla.
    this.systemsRevealed = { mercado: false, ojeadores: false, patrocinios: false, junta: false };
    // aviso de "primera vez, mira Ayuda" en Inicio: se apaga solo al
    // visitar Ayuda una vez, o pasada la primera semana si no se visita
    this.helpHintSeen = false;
    this.friendliesLeft = 3; // amistosos de pretemporada disponibles esta temporada
    this.cupTitles = 0;
    this.euroCupTitles = 0;
    this.dailyBest = {};
    // libro de récords del Panteón: la mayor paliza dada, cualquiera que
    // sea la competición — {margin, rival, cityName} o null hasta la primera
    this.bestMarginWin = null;
    // anales del club: a diferencia de `news` (un buffer rodante de 30
    // titulares que se borra solo), esto es permanente — solo los hitos
    // de verdad (títulos, ascenso a Madrid, campanadas, fallecimientos,
    // pareja de leyenda) entran aquí, y no se podan nunca. Ver
    // Player.addAnnal y la sección histórica de HemerotecaScreen.js.
    this.annals = [];
    // resumen de cada temporada de liga cerrada: ciudad/nivel, puesto final,
    // ascenso/descenso y premios de la peña — a diferencia de `annals` (solo
    // los hitos más gordos), esto es un registro completo temporada a
    // temporada para la subsección Históricos. Ver Career.js donde se
    // cierra la temporada.
    this.seasonHistory = [];
    this.reachedTopFlight = false; // ya se anotó el hito de llegar por primera vez a Madrid (nivel 8)
    // resultados de partidos jugados, por día del calendario absoluto —
    // para poder mostrar el marcador al hacer rollover sobre un día ya
    // pasado en la Agenda. Solo hace falta guardar la temporada en curso
    // (se vacía en Career.js cuando la liga cierra temporada), así que no
    // crece sin límite como un histórico permanente de verdad.
    this.matchResults = {};
    // compenetración de parejas: "idMenor-idMayor" -> partidos jugados
    // juntos (ver Roster.chemistryKey / Career.js)
    this.chemistry = {};
    // eventos de decisión del calendario: ids ya salidos (para no repetir
    // hasta agotar el pool) y secuelas agendadas a futuro — ver
    // data/decisionEvents.js y SeasonClock
    this.seenDecisions = [];
    this.pendingDecisions = []; // [{day, id, ctx}]
    // temporadas de liga completadas: mueve la exigencia de boardObjectiveFor
    // de forma continua (antes se guiaba por currentLeagueLevel, que se
    // queda parado en 8 al llegar a Madrid y no refleja cuántas temporadas
    // llevas jugando de verdad)
    this.seasonsPlayed = 0;
    // percepción pública del mánager: -50 (comedido) .. +50 (fanfarrón),
    // se mueve con las respuestas en Rueda de Prensa (ver PressScreen.js) y
    // colorea las pullas rivales (data/rivalPersonality.js) y quién firma
    // la crónica (match/Chronicle.js) — una reputación que se construye a
    // lo largo de la carrera, no solo lo que pasó esta semana
    this.publicImage = 0;
    this.boardGoal = boardObjectiveFor(1, 1);
    this.weeklyGoal = rollWeeklyGoal();

    // país de casa: España por defecto (el resto se elige y se desbloquea
    // en TitleScreen — ver MetaProgress.js). Una partida nueva SIEMPRE
    // arranca así; si se elige otro país, TitleScreen regenera clubName/
    // leagueWorld/foreignLeagues/cup tal cual hace ya el selector de nivel
    // de debug, no aquí en el constructor.
    this.homeCountry = 'ES';

    // liga y calendario
    this.clubName = CLUB_NAMES[Math.floor(Math.random() * CLUB_NAMES.length)];
    this.currentLeagueLevel = 1; // Albacete
    // el fundador arranca a la altura de esta liga, no con stats fijas de
    // serie (ver founderStatsForLevel) — así en una liga alta cuesta de
    // verdad, y en una baja no llega ya sobrado
    this.roster.get(0).genStats = founderStatsForLevel(this.currentLeagueLevel * strengthFor(this.homeCountry));
    this.leagueWorld = LeagueWorld.generate(this.currentLeagueLevel, this.clubName, this.homeCountry);
    this.seasonClock = new SeasonClock();
    this.freeAgents = new FreeAgentPool();
    this.freeAgents.refresh();
    this.scoutStaff = new ScoutStaff();
    this.cup = Cup.generate(this.leagueWorld, this.club, this.club.avgSkill(this.roster));
    this.seasonClock.scheduleCup(this.seasonClock.firstFreeDayFrom(3, this.league));
    this.promotions = 0;
    this.relegations = 0;

    // las ligas de fondo de los 5 países que NO son el de casa (Francia,
    // Italia, Bélgica, Suiza, Portugal si juegas en España; España + 4 de
    // esos 5 si juegas en un país extranjero): 100% IA, nunca las juega el
    // jugador directamente — se simulan semana a semana (ver Career.js)
    // para que tengan una clasificación real cuando toque sortear la Copa
    // de Europa
    this.foreignLeagues = new Map();
    for (const { code, cities } of awayCountriesFor(this.homeCountry)) this.foreignLeagues.set(code, ForeignLeagueWorld.generate(code, cities));
    this.euroCup = null; // se genera al terminar una temporada en nivel 8 quedando entre los primeros
  }

  get league() { return this.leagueWorld.leagueOf(this.currentLeagueLevel); }
  get club() { return this.league.playerClub; }

  // el dinero se lee/escribe en TODO el código como un campo normal
  // (`player.money += x`, `player.money -= y`...): en vez de tocar cada uno
  // de esos sitios para llevar la cuenta de ingresos/gastos, se intercepta
  // aquí — cualquier `+=`/`-=`/`=` sobre player.money pasa por este setter
  // sin que el resto del juego tenga que enterarse. Solo cuenta cuando
  // seasonClock ya existe (fuera del propio constructor): el dinero inicial
  // de fundación no es una "transacción" que tenga sentido en el gráfico.
  get money() { return this._money; }
  set money(v) {
    const delta = v - this._money;
    this._money = v;
    if (!delta || !this.seasonClock) return;
    if (delta > 0) this.totalEarned += delta; else this.totalSpent += -delta;
    const wk = this.seasonClock.weekIndex;
    if (!this.economyByWeek[wk]) this.economyByWeek[wk] = { income: 0, expense: 0 };
    if (delta > 0) this.economyByWeek[wk].income += delta; else this.economyByWeek[wk].expense += -delta;
    // ventana móvil: solo hacen falta unas pocas semanas de sobra sobre las
    // 20 que enseña el gráfico de Economía — el resto no aporta nada y
    // haría crecer el guardado sin límite en una partida larga
    const cutoff = wk - 30;
    for (const k of Object.keys(this.economyByWeek)) { if (Number(k) < cutoff) delete this.economyByWeek[k]; }
  }

  // últimas `n` semanas de ingreso/gasto, terminando en la semana actual,
  // siempre con `n` entradas (las semanas sin movimiento salen a 0) — para
  // que el gráfico de barras de Economía tenga siempre el mismo ancho
  economyLastWeeks(n) {
    const current = this.seasonClock.weekIndex;
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const wk = current - i;
      const e = wk >= 0 ? this.economyByWeek[wk] : null;
      out.push({ weekIndex: wk, income: e ? e.income : 0, expense: e ? e.expense : 0 });
    }
    return out;
  }

  // reputación de mánager: prestigio en el circuito, distinto del "renombre"
  // (que solo mide XP). Crece con los logros gordos, no con jugar partidos
  // sueltos — así que hace falta currículum de verdad para desbloquear
  // ojeadores y patrocinios de primer nivel.
  get managerRep() {
    const rep = this.seasonTitles * 30 + this.promotions * 15 + this.campaign.claimed.length * 10
      + this.nemesisDefeats * 5 + this.derbyHistory.wins * 3 + this.euroUpsets * 8 - this.boardUltimatums * 10;
    return Math.max(0, rep);
  }

  get managerRepLabel() {
    const rep = this.managerRep;
    if (rep >= 100) return 'Leyenda del circuito';
    if (rep >= 50) return 'Respetado en la comarca';
    if (rep >= 20) return 'Conocido por la zona';
    return 'Debutante';
  }

  // el derbi: un rival fijo de tu liga actual, distinto del némesis (que
  // cambia según a quién le hayas perdido última). Se elige una vez por
  // liga (determinista, mientras no asciendas/desciendas) y se conserva
  // su historial de enfrentamientos aunque cambies de liga y vuelvas.
  get derbyClub() {
    const league = this.league;
    const others = league.clubs.filter((c) => !c.isPlayer);
    if (!others.length) return null;
    if (!this.derbyClubId || !others.some((c) => c.id === this.derbyClubId)) {
      const idx = Math.abs(hashStr(`${this.clubName}-${league.cityName}`)) % others.length;
      this.derbyClubId = others[idx].id;
    }
    return league.clubById(this.derbyClubId);
  }

  xpForNextLevel() { return xpForLevel(this.level); }

  // hito para siempre: a diferencia de `news.push`, esto nunca se borra
  addAnnal(text) {
    this.annals.push({ text, day: this.seasonClock.day, dateLabel: this.seasonClock.dateLabel() });
  }

  // rendimientos decrecientes al acercarse a los extremos (±50), igual que
  // la moral de un abuelo: hacen falta varias ruedas de prensa seguidas del
  // mismo signo para labrarse fama de verdad, no una sola declaración
  nudgePublicImage(d) {
    const cap = 50;
    if (d > 0) d *= clamp((cap - this.publicImage) / cap, 0.2, 1);
    else if (d < 0) d *= clamp((this.publicImage + cap) / cap, 0.2, 1);
    this.publicImage = clamp(this.publicImage + d, -cap, cap);
  }

  addReward(xp, money) {
    this.xp += xp;
    this.money += money;
    let ups = 0;
    while (this.xp >= xpForLevel(this.level)) {
      this.xp -= xpForLevel(this.level);
      this.level++;
      ups++;
    }
    return ups;
  }

  // vista plana usada por Campaign.checkAndClaim (necesita duck-typing simple)
  snapshotForCampaign() {
    return {
      wins: this.wins,
      roster: this.roster.ids,
      citiesWon: this.citiesWon,
      nemesisDefeats: this.nemesisDefeats,
      seasonTitles: this.seasonTitles,
      stormWins: this.stormWins,
      promotions: this.promotions,
      cupTitles: this.cupTitles,
      euroCupTitles: this.euroCupTitles,
      euroUpsets: this.euroUpsets,
      reachedTopFlight: this.reachedTopFlight,
      level: this.level,
      state: Object.fromEntries(this.roster.ids.map((id) => [id, this.roster.get(id)])),
    };
  }

  save() {
    localStorage.setItem(keyForSlot(Player.activeSlot()), JSON.stringify(this.toJSON()));
  }

  static activeSlot() { return Number(localStorage.getItem(ACTIVE_SLOT_KEY)) || 1; }
  static switchSlot(slot) { localStorage.setItem(ACTIVE_SLOT_KEY, String(slot)); }

  // resumen rápido de un slot para el selector de perfiles, sin construir
  // un Player entero: null si está vacío
  static slotSummary(slot) {
    try {
      const raw = localStorage.getItem(keyForSlot(slot));
      if (!raw) return null;
      const json = JSON.parse(raw);
      return { clubName: json.clubName || '(sin nombre)', money: json.money ?? 0, wins: json.wins ?? 0, losses: json.losses ?? 0, level: json.level ?? 1 };
    } catch (e) { return null; }
  }
  static get SLOT_COUNT() { return SLOT_COUNT; }

  // copia de seguridad de un perfil: el JSON tal cual vive en localStorage,
  // para descargarlo a un archivo o cargarlo en otro navegador/máquina
  static exportSlot(slot) { return localStorage.getItem(keyForSlot(slot)); }
  static importIntoSlot(slot, jsonString) {
    JSON.parse(jsonString); // lanza si no es JSON válido: no se guarda basura
    localStorage.setItem(keyForSlot(slot), jsonString);
  }

  toJSON() {
    return {
      v: 6,
      money: this.money, xp: this.xp, level: this.level, wins: this.wins, losses: this.losses,
      captain: this.captain, freePick: this.freePick,
      ...this.roster.toJSON(),
      season: this.season.toJSON(),
      campaign: this.campaign.toJSON(),
      news: this.news.toJSON(),
      sponsorship: this.sponsorship.toJSON(),
      facilities: this.facilities.toJSON(),
      presets: this.presets.toJSON(),
      bolasOwned: this.bolasOwned, bolaSel: this.bolaSel, consumables: this.consumables,
      nemesis: this.nemesis, citiesWon: this.citiesWon,
      derbyClubId: this.derbyClubId, derbyHistory: this.derbyHistory,
      nemesisDefeats: this.nemesisDefeats, euroUpsets: this.euroUpsets, seasonTitles: this.seasonTitles, stormWins: this.stormWins,
      dailyBest: this.dailyBest, boardGoal: this.boardGoal, weeklyGoal: weeklyGoalToJSON(this.weeklyGoal),
      boardConfidence: this.boardConfidence, boardUltimatums: this.boardUltimatums, boardCrisis: this.boardCrisis,
      negativeWeeksStreak: this.negativeWeeksStreak, gameOver: this.gameOver,
      difficulty: this.difficulty, difficultyChosen: this.difficultyChosen, debugMode: this.debugMode, pressPromise: this.pressPromise,
      systemsRevealed: this.systemsRevealed, helpHintSeen: this.helpHintSeen,
      friendliesLeft: this.friendliesLeft, cup: this.cup ? this.cup.toJSON() : null, cupTitles: this.cupTitles,
      euroCupTitles: this.euroCupTitles,
      bestMarginWin: this.bestMarginWin, chemistry: this.chemistry, seasonsPlayed: this.seasonsPlayed,
      publicImage: this.publicImage, annals: this.annals, seasonHistory: this.seasonHistory, reachedTopFlight: this.reachedTopFlight,
      matchResults: this.matchResults,
      seenDecisions: this.seenDecisions, pendingDecisions: this.pendingDecisions,
      homeCountry: this.homeCountry,
      clubName: this.clubName, currentLeagueLevel: this.currentLeagueLevel,
      leagueWorld: this.leagueWorld.toJSON(),
      seasonClock: this.seasonClock.toJSON(),
      freeAgents: this.freeAgents.toJSON(),
      scoutStaff: this.scoutStaff.toJSON(),
      promotions: this.promotions, relegations: this.relegations,
      foreignLeagues: Object.fromEntries([...this.foreignLeagues].map(([code, w]) => [code, w.toJSON()])),
      euroCup: this.euroCup ? this.euroCup.toJSON() : null,
      totalEarned: this.totalEarned, totalSpent: this.totalSpent, economyByWeek: this.economyByWeek,
    };
  }

  static load() {
    const slot = Player.activeSlot();
    try {
      const raw = localStorage.getItem(keyForSlot(slot));
      if (raw) return Player.fromJSON(JSON.parse(raw));
      if (slot === 1) {
        for (const key of LEGACY_KEYS) {
          const legacy = localStorage.getItem(key);
          if (legacy) return Player.fromLegacyJSON(JSON.parse(legacy));
        }
      }
    } catch (e) { /* guardado corrupto: empezamos de cero */ }
    return new Player();
  }

  static fromJSON(json) {
    const p = new Player(); // ya genera un mundo de ligas nuevo; lo sustituimos si hay guardado
    // se asigna directamente al campo interno (no player.money = ...): pasar
    // por el setter aquí registraría la diferencia entre el dinero recién
    // construido (150€) y el guardado como si fuera una transacción real de
    // esta semana, inflando el gráfico de Economía con un ingreso fantasma
    // cada vez que se carga la partida
    p._money = json.money ?? 150; p.xp = json.xp ?? 0; p.level = json.level ?? 1;
    p.wins = json.wins ?? 0; p.losses = json.losses ?? 0;
    p.captain = json.captain ?? 0; p.freePick = json.freePick ?? false;
    p.roster = Roster.fromJSON(json);
    p.season = Season.fromJSON(json.season);
    p.campaign = Campaign.fromJSON(json.campaign);
    p.news = NewsFeed.fromJSON(json.news || []);
    p.sponsorship = Sponsorship.fromJSON(json.sponsorship);
    p.facilities = FacilityManager.fromJSON(json.facilities || []);
    p.presets = LineupPresets.fromJSON(json.presets || []);
    p.bolasOwned = json.bolasOwned || [0];
    p.bolaSel = json.bolaSel ?? 0;
    // guardado de antes de los consumibles: arranca con las existencias a
    // cero (nunca se ha comprado ninguno todavía), nunca revienta la carga
    p.consumables = { ...emptyConsumableStock(), ...(json.consumables || {}) };
    p.nemesis = json.nemesis || null;
    p.derbyClubId = json.derbyClubId || null;
    p.derbyHistory = json.derbyHistory || { wins: 0, losses: 0 };
    p.citiesWon = json.citiesWon || [];
    p.nemesisDefeats = json.nemesisDefeats || 0;
    p.euroUpsets = json.euroUpsets || 0;
    p.seasonTitles = json.seasonTitles || 0;
    p.stormWins = json.stormWins || 0;
    p.boardConfidence = json.boardConfidence ?? 60;
    p.boardUltimatums = json.boardUltimatums || 0;
    p.boardCrisis = json.boardCrisis || false;
    p.negativeWeeksStreak = json.negativeWeeksStreak || 0;
    p.gameOver = json.gameOver || false;
    p.difficulty = json.difficulty || 'normal';
    p.difficultyChosen = json.difficultyChosen ?? true; // guardados antiguos no vieron el selector: no interrumpir
    p.debugMode = json.debugMode ?? false;
    p.pressPromise = json.pressPromise || null;
    // guardado de antes del revelado progresivo: se da por ya visto todo
    // (nunca se tapa una pestaña a quien ya llevaba partida en marcha) —
    // solo una partida NUEVA (Player recién construido) arranca oculta
    p.systemsRevealed = json.systemsRevealed || { mercado: true, ojeadores: true, patrocinios: true, junta: true };
    p.helpHintSeen = json.helpHintSeen ?? true;
    p.friendliesLeft = json.friendliesLeft ?? 3;
    p.cup = json.cup ? Cup.fromJSON(json.cup) : null;
    p.cupTitles = json.cupTitles || 0;
    p.euroCupTitles = json.euroCupTitles || 0;
    p.bestMarginWin = json.bestMarginWin || null;
    p.chemistry = json.chemistry || {};
    // guardado de antes de este contador: se aproxima con el nivel de liga
    // actual (razonable — para llegar ahí hace falta haber jugado al menos
    // esas temporadas) en vez de arrancar de golpe en la exigencia mínima
    p.seasonsPlayed = json.seasonsPlayed ?? Math.max(1, json.currentLeagueLevel || 1);
    p.publicImage = json.publicImage ?? 0;
    p.annals = json.annals || [];
    p.seasonHistory = json.seasonHistory || [];
    p.matchResults = json.matchResults || {};
    p.seenDecisions = json.seenDecisions || [];
    p.pendingDecisions = json.pendingDecisions || [];
    p.dailyBest = json.dailyBest || {};
    p.boardGoal = json.boardGoal || boardObjectiveFor(1);
    p.weeklyGoal = weeklyGoalFromJSON(json.weeklyGoal);
    // guardado de antes de la meta-progresión (elegir país): se da por
    // España, el único país jugable que existía entonces
    p.homeCountry = json.homeCountry || 'ES';
    p.clubName = json.clubName || p.clubName;
    p.currentLeagueLevel = json.currentLeagueLevel ?? 1;
    // guardado antiguo sin el flag: si ya estaba en Madrid, se da por
    // anotado el hito (evita duplicar el anal en la próxima temporada)
    p.reachedTopFlight = json.reachedTopFlight ?? (p.currentLeagueLevel >= 8);
    // guardados anteriores al overhaul del Mercado (v5) o al de los países
    // extranjeros (v6: un ForeignLeagueWorld genérico por país en vez de
    // un único `frenchLeagues` especial) traen un mundo de ligas con una
    // forma que ya no es compatible: se descarta y se deja el mundo recién
    // generado por el constructor, en vez de intentar migrarlo a medias.
    const worldIsCurrent = (json.v ?? 0) >= 6;
    if (worldIsCurrent && json.leagueWorld) p.leagueWorld = LeagueWorld.fromJSON(json.leagueWorld);
    if (json.seasonClock) p.seasonClock = SeasonClock.fromJSON(json.seasonClock);
    // autocura de guardados de antes de que existiera seasonWeekOffset (o ya
    // desincronizados por el bug que impedía detectar los domingos de liga
    // pasada la primera temporada): se recalcula asumiendo que el partido de
    // esta semana, si toca, aún no se ha jugado — el caso normal al cargar.
    if (json.seasonClock && json.seasonClock.seasonWeekOffset === undefined) {
      p.seasonClock.seasonWeekOffset = p.seasonClock.weekIndex - p.league.matchday;
    }
    if (worldIsCurrent && json.freeAgents) p.freeAgents = FreeAgentPool.fromJSON(json.freeAgents);
    p.freeAgents.refresh();
    p.scoutStaff = ScoutStaff.fromJSON(json.scoutStaff);
    p.promotions = json.promotions || 0;
    p.relegations = json.relegations || 0;
    if (worldIsCurrent && json.foreignLeagues) {
      p.foreignLeagues = new Map();
      for (const { code } of awayCountriesFor(p.homeCountry)) {
        p.foreignLeagues.set(code, ForeignLeagueWorld.fromJSON(code, json.foreignLeagues[code]));
      }
    }
    p.euroCup = json.euroCup ? EuropeanCup.fromJSON(json.euroCup) : null;
    // guardado de antes de la pestaña Economía: se arranca sin histórico
    // (no hay forma de reconstruir semanas pasadas), no revienta la carga
    p.totalEarned = json.totalEarned || 0;
    p.totalSpent = json.totalSpent || 0;
    p.economyByWeek = json.economyByWeek || {};
    return p;
  }

  // partidas guardadas de versiones anteriores a la liga (v1-v3): se
  // conserva la plantilla y el progreso, y se genera un mundo de ligas
  // nuevo empezando en el escalón más bajo.
  static fromLegacyJSON(o) {
    const p = new Player();
    p.difficultyChosen = true; // guardado de una versión anterior al selector: no interrumpir
    p.systemsRevealed = { mercado: true, ojeadores: true, patrocinios: true, junta: true }; // partida ya en marcha: nada que tapar
    p.helpHintSeen = true;
    p.homeCountry = 'ES'; // el único país jugable cuando se guardó esta partida
    p._money = o.money ?? 150; p.xp = o.xp ?? 0; p.level = o.level ?? 1; // ver nota de fromJSON: bypass del setter
    p.wins = o.wins ?? 0; p.losses = o.losses ?? 0;
    if (o.roster) {
      p.roster = new Roster(o.roster, o.state || {});
      p.freePick = !!o.freePick;
      p.captain = o.captain ?? o.roster[0] ?? 0;
    } else if (o.face !== undefined) {
      p.roster = new Roster([o.face]);
      p.captain = o.face;
      p.freePick = false;
    }
    if (o.bolasOwned) p.bolasOwned = o.bolasOwned;
    if (o.bolaSel !== undefined) p.bolaSel = o.bolaSel;
    p.nemesis = o.nemesis || null;
    if (o.facilities) p.facilities = FacilityManager.fromJSON(o.facilities);
    if (o.news) p.news = NewsFeed.fromJSON(o.news);
    if (o.campaign) p.campaign = Campaign.fromJSON(o.campaign);
    p.news.push('La peña se apunta a la liga federada: empieza la temporada en Albacete.');
    return p;
  }

  static resetSave() {
    localStorage.removeItem(keyForSlot(Player.activeSlot()));
    if (Player.activeSlot() === 1) for (const k of LEGACY_KEYS) localStorage.removeItem(k);
    return new Player();
  }
}
