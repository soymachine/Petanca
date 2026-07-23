import { clamp, gauss, rnd } from '../core/utils.js';
import { ABUELO_DATA, STAT_KEYS } from '../data/abuelos.js';

// curva de nivel: nivel 1 cuesta 89 XP, nivel 2 126, nivel 3 171... el
// término cuadrático hace que la distancia entre niveles crezca cada vez
// más (+37, +45, +53, +61...), no solo el coste base — así los niveles
// altos cuestan de verdad, no es una recta con más margen. Los puntos por
// nivel (10, 15, 20... en la escala vieja) se reparten al 85% y luego a la
// mitad otra vez para que subir de nivel siga siendo un premio, pero cada
// vez menos generoso.
// Constantes pensadas para retocarse fácil si el ritmo no cuaja jugando.
const LEVEL_CAP = 12;
function xpToNextLevel(level) { return 60 + level * 25 + level * level * 4; }
function pointsForLevel(level) { return Math.max(1, Math.round((10 + (level - 1) * 5) * 0.85 * 0.25 * 0.5)); }

// tope de `legacy`/`seasonLog` por hueco de plantilla: BUG real (no solo
// cosmético) encontrado tras un "QuotaExceededError" al guardar — ninguno
// de los dos arrays se podaba nunca, y desde que el retiro con honores se
// dispara solo al simular (ver Career.retireWithHonors / Game.js
// _debugRollOutcome), un hueco puede acumular cientos de generaciones en
// una sola sesión larga de Modo Debugger, cada una añadiendo su fila para
// siempre. La Panteón y la ficha de detalle nunca muestran ni de lejos
// tantas filas, así que podar las más antiguas no quita nada visible.
const MAX_LEGACY = 20;
const MAX_SEASON_LOG = 60;

// Estado vivo de un abuelo de la peña: stamina, moral, entrenamiento
// acumulado, amuleto, generación (nietos) y estadísticas de carrera.
// Responsabilidad única: todo lo que cambia turno a turno para UN abuelo.
export class AbueloState {
  constructor(id, data = {}) {
    this.id = id;
    this.st = data.st ?? 100;
    this.mo = data.mo ?? 0;
    // bonus{} vive en unidades de la escala 0-100 (ver getStat/getStatDisplay
    // más abajo) — un solo almacén sirve tanto para el motor de tiro (que
    // sigue leyendo 1-10, sin cambios) como para la progresión nueva
    this.bonus = data.bonus ?? {};
    this.item = data.item ?? null;
    this.gen = data.gen ?? 0;
    this.torneos = data.torneos ?? 0;
    this.genStats = data.genStats ?? null;
    this.career = data.career ?? { wins: 0, losses: 0, bestStreak: 0, closestWin: null };
    this.formStreak = data.formStreak ?? 0; // partidos de liga ganados seguidos (se corta al perder)
    this.mentorOf = data.mentorOf ?? null; // id de otro abuelo al que hace de mentor
    this.age = data.age ?? Math.round(rnd(64, 78));
    // {name, nationality, portrait} si el hueco lo ocupa un fichaje —
    // nationality se recorta a {code,label} también al cargar, por si venía
    // de un guardado de antes del arreglo del bug de Club.toJSON (ver ese
    // comentario) con el objeto de NATIONALITIES completo embebido
    this.signed = data.signed
      ? { ...data.signed, nationality: data.signed.nationality ? { code: data.signed.nationality.code, label: data.signed.nationality.label } : data.signed.nationality }
      : null;
    this.injuredUntil = data.injuredUntil ?? 0; // día de temporada hasta el que está de baja (0 = sano)
    // generaciones anteriores de este mismo hueco (ver retireToGrandchild) —
    // recortado a MAX_LEGACY también al cargar, para que un guardado ya
    // hinchado por partidas de antes de este arreglo se autocure solo en
    // cuanto se abra de nuevo (ver comentario en MAX_LEGACY más arriba)
    this.legacy = (data.legacy ?? []).slice(-MAX_LEGACY);
    this.xp = data.xp ?? 0; // progreso de XP dentro del nivel actual
    this.level = data.level ?? 0;
    this.points = data.points ?? 0; // puntos ganados y aún sin repartir entre stats
    // techo por stat (1..10) de un fichaje Sin Equipo: null si no aplica
    // (fichaje normal, sin techo más allá del tope general de 100)
    this.potentialCap = data.potentialCap ?? null;
    // eco heredado del abuelo saliente en el último relevo (ver
    // retireToGrandchild): {clima: 'LLUVIA'} o {stat: 'pulso'} — null si
    // este hueco aún va por su primera generación
    this.inherited = data.inherited ?? null;
    // deuda de sangre: {clubId, label} si el abuelo murió con una revancha
    // pendiente (némesis activa o derbi en contra) — se salda ganando a
    // ese club con el nieto alineado (ver Career.settleDebts)
    this.debt = data.debt ?? null;
    // presagio de la edad ya disparado (ver data/agingFlavor.js /
    // Game.js._maybeAgingForeshadow): como mucho una vez por generación,
    // para no repetir el mismo aviso cada semana
    this.agingFlavorSeen = data.agingFlavorSeen ?? false;
    // histórico temporada a temporada de ESTE hueco de la plantilla (ver
    // recordSeasonSnapshot, llamado desde Career.js al cerrar cada
    // temporada): a diferencia de `career` (que se resetea a cero en cada
    // relevo generacional) y de `legacy` (un resumen por GENERACIÓN, no por
    // temporada), esto es una fila por cada temporada jugada, generación
    // tras generación, para poder ver la evolución real del hueco en la
    // vista de detalle de Mi Peña
    this.seasonLog = (data.seasonLog ?? []).slice(-MAX_SEASON_LOG);
  }

  static fromJSON(id, json) {
    const s = new AbueloState(id, json || {});
    // guardado de antes de este sistema (no tiene "xp"): el bonus ya
    // ganado con el entrenamiento viejo estaba en unidades 1-10, así que
    // se migra ×10 una sola vez para no perder ese progreso al pasar de escala
    if (json && json.xp === undefined && json.bonus) {
      const migrated = {};
      for (const k of Object.keys(json.bonus)) migrated[k] = json.bonus[k] * 10;
      s.bonus = migrated;
    }
    return s;
  }
  toJSON() {
    return {
      st: this.st, mo: this.mo, bonus: this.bonus, item: this.item, gen: this.gen,
      torneos: this.torneos, genStats: this.genStats, career: this.career, mentorOf: this.mentorOf,
      age: this.age, signed: this.signed, formStreak: this.formStreak, injuredUntil: this.injuredUntil,
      legacy: this.legacy, xp: this.xp, level: this.level, points: this.points,
      potentialCap: this.potentialCap, inherited: this.inherited, debt: this.debt,
      agingFlavorSeen: this.agingFlavorSeen, seasonLog: this.seasonLog,
    };
  }

  // ficha a un jugador del mercado en este hueco de la plantilla: adopta su
  // nombre, nacionalidad, retrato y estadísticas (que a partir de ahora
  // gobiernan el juego real, igual que un relevo generacional). Si viene de
  // Sin Equipo, `potentialCap` fija el techo por stat hasta el que podrá
  // entrenar (en vez del tope general de 100).
  signPlayer(rivalPlayer) {
    this.genStats = { ...rivalPlayer.stats };
    this.bonus = {};
    this.xp = 0; this.level = 0; this.points = 0;
    this.age = rivalPlayer.age;
    this.potentialCap = rivalPlayer.potentialCap ?? null;
    // solo code/label, nunca el objeto de NATIONALITIES completo (con su
    // pool de ~200 nombres) — mismo bug que en Club.toJSON, ver ese
    // comentario; aquí nunca hace falta el pool, solo se lee .label/.code
    this.signed = { name: rivalPlayer.name, nationality: { code: rivalPlayer.nationality.code, label: rivalPlayer.nationality.label }, portrait: rivalPlayer.portrait, miniPortrait: rivalPlayer.miniPortrait };
  }

  get displayName() { return this.signed ? this.signed.name : null; }

  _baseStat10(k) {
    return (this.genStats && this.genStats[k] !== undefined) ? this.genStats[k] : ABUELO_DATA[this.id].stats[k];
  }

  // stat que lee el motor de tiro: SIN cambios de contrato, sigue siendo
  // 1-10 exacto (mismo balance de partido de siempre) — solo que ahora se
  // deriva redondeando la versión de grano fino de abajo
  getStat(k) {
    return clamp(Math.round(this.getStatDisplay(k) / 10), 1, 10);
  }

  // stat de grano fino (0-100) para la UI y el reparto de puntos de nivel
  getStatDisplay(k) {
    const cap = this.potentialCap ? this.potentialCap[k] * 10 : 100;
    return clamp(this._baseStat10(k) * 10 + (this.bonus[k] || 0) - this.ageDeclineFor(k), 0, cap);
  }

  // declive físico por la edad: a partir de los 78 años empieza a notarse,
  // y crece cuadrático (cada año pasado ese umbral pesa más que el
  // anterior, no una recta) — el aguante y el pulso (piernas y mano firme)
  // se resienten antes que la maña o el temple (la cabeza aguanta mejor
  // que el cuerpo). No toca `bonus` ni `genStats`: el entrenamiento
  // invertido sigue ahí, solo se resta encima al mostrar/usar la stat.
  ageDeclineFor(k) {
    if (this.age < 78) return 0;
    const over = this.age - 78;
    const sensitivity = { aguante: 1.3, pulso: 1.0, brazo: 0.9, mana: 0.6, temple: 0.3 };
    return Math.round(over * over * 0.15 * (sensitivity[k] ?? 1));
  }

  // moral con rendimientos decrecientes: cuanto más cerca del techo (o del
  // suelo), más cuesta seguir moviéndose en esa dirección — así un +20 (o
  // un -20) hay que ganárselo con varios empujones seguidos, no de un tirón,
  // y no se queda ahí clavado para siempre (ver moralWeeklyDecay).
  addMoral(d, gimnasioBonus = false) {
    if (this.id === 4) d *= 2; // EL RUBIO: presumido
    const floor = this.id === 0 ? 0 : (this.item && this.item.id === 'petaca' ? -10 : -20);
    const cap = 20;
    if (d > 0) d *= clamp((cap - this.mo) / cap, 0.15, 1);
    else if (d < 0) d *= clamp((this.mo - floor) / (cap - floor), 0.15, 1);
    this.mo = clamp(this.mo + d, floor, cap);
  }

  // deriva semanal hacia el neutro: sin nada que la alimente, la moral se
  // acerca un 8% a 0 cada semana — un chute puntual (fiestas, un amuleto)
  // ya no dura toda la temporada si no se refuerza.
  moralWeeklyDecay() {
    this.mo = Math.round(this.mo - this.mo * 0.08);
  }

  // recuperación semanal de stamina: los años pasan factura (a partir de
  // los 65, cada año de más recupera algo menos, con suelo del 55% a edad
  // muy avanzada) y el aguante ayuda un poco más allá de bajar el coste en
  // partido.
  //
  // BUG real encontrado simulando cientos de semanas seguidas (una sola
  // plantilla, sin rotar): con +28 (o incluso con el +30 de antes de bajar
  // esto), el coste por partido — (45 - aguante*2), ver Match.js matchEnd y
  // Game._debugRollOutcome — supera a esta recuperación para CUALQUIER
  // abuelo de aguante medio (5-7), así que la stamina no se estabiliza en
  // ningún punto intermedio: cae en picado hasta el suelo (0) y se queda
  // ahí para siempre. A stamina 0, fatiguePenalty castiga el "skill"
  // efectivo casi a un tercio — un jugador que nunca rota queda permanente
  // e invisiblemente mermado, arrastrando su ratio de victorias muy por
  // debajo del 50% y arriesgando la quiebra (ver GAME OVER) sin que nada en
  // pantalla explique por qué. Subir a +34 hace que un aguante medio (5)
  // quede casi en equilibrio (leve declive) y aguante 6+ ya sea sostenible
  // en solitario — el aguante bajo sigue penalizando de verdad, y rotar
  // sigue ayudando, pero jugar siempre con el mismo abuelo deja de ser un
  // agujero negro de rendimiento.
  recoverWeekly(baseBonus = 0) {
    const ageFactor = clamp(1 - Math.max(0, this.age - 65) * 0.01, 0.55, 1);
    const aguanteHelp = (ABUELO_DATA[this.id].stats.aguante - 5) * 0.6;
    this.st = clamp(this.st + (34 + baseBonus) * ageFactor + aguanteHelp, 0, 100);
  }

  hasImmunity(weatherKey) {
    const d = ABUELO_DATA[this.id];
    if (d.clima && d.clima[weatherKey] === 1) return true;
    if (this.item && this.item.id === 'panuelo' && this.item.clima === weatherKey) return true;
    return false;
  }

  // mecanismos viejos de mejora (mentor, ARRIME/TIRO, premio de temporada):
  // se quedan con la misma firma en todos sus sitios de llamada, pero como
  // bonus{} ahora vive en unidades 0-100, se escala ×10 para que su efecto
  // relativo de siempre no cambie
  train(statKey, bonusAmount) {
    if (this.getStat(statKey) < 10) this.bonus[statKey] = (this.bonus[statKey] || 0) + bonusAmount * 10;
    else this.addMoral(3); // ya está al máximo: al menos se divierte
  }

  // --- XP/nivel: la progresión nueva, ganada jugando (ver Match.js/Career.js) ---
  xpToNextLevel() { return xpToNextLevel(this.level); }
  isMaxLevel() { return this.level >= LEVEL_CAP; }

  // suma XP y sube de nivel en bucle mientras alcance el umbral; devuelve
  // las subidas ocurridas (para poder anunciarlas en las noticias)
  addXp(amount) {
    if (amount <= 0 || this.isMaxLevel()) return [];
    this.xp += amount;
    const ups = [];
    while (!this.isMaxLevel() && this.xp >= this.xpToNextLevel()) {
      this.xp -= this.xpToNextLevel();
      this.level++;
      const gained = pointsForLevel(this.level);
      this.points += gained;
      ups.push({ level: this.level, points: gained });
    }
    if (this.isMaxLevel()) this.xp = 0;
    return ups;
  }

  // gasta puntos del banco en una stat concreta, sin poder gastar de más
  // ni pasar del tope de 100 (el propio getStatDisplay ya clampea, pero
  // aquí además se evita "malgastar" puntos en una stat ya al máximo)
  allocatePoint(statKey, amount = 1) {
    amount = Math.min(amount, this.points);
    if (amount <= 0) return 0;
    const room = 100 - this.getStatDisplay(statKey);
    const spend = Math.min(amount, room);
    if (spend <= 0) return 0;
    this.bonus[statKey] = (this.bonus[statKey] || 0) + spend;
    this.points -= spend;
    return spend;
  }

  // mejor stat (grano fino) del abuelo saliente, antes de que el relevo
  // resetee bonus/genStats — es lo que hereda el nieto si no le toca eco
  // climático (ver retireToGrandchild)
  _bestOutgoingStat() {
    let best = STAT_KEYS[0], bestVal = this.getStatDisplay(best);
    for (const k of STAT_KEYS) {
      const v = this.getStatDisplay(k);
      if (v > bestVal) { bestVal = v; best = k; }
    }
    return best;
  }

  // releva al abuelo por su nieto: stats nuevas, misma cara, cansancio a cero.
  // También es lo que ocurre (con otro tono) cuando el abuelo fallece: el
  // testigo pasa a la familia y el hueco de la peña sigue vivo. Antes de
  // relevar, se guarda un resumen de la generación saliente — si no, no
  // queda ni rastro de quién jugó antes en ese hueco. `debt`, si se pasa
  // (solo en un relevo por fallecimiento con revancha pendiente — ver
  // Game.js), es lo que arrastra el nieto hasta que la salde (ver
  // Career.settleDebts).
  retireToGrandchild(reason = 'retiro', debt = null) {
    this.legacy.push({
      gen: this.gen, name: this.signed ? this.signed.name : null, age: this.age,
      wins: this.career.wins, losses: this.career.losses, bestStreak: this.career.bestStreak,
      reason,
    });
    if (this.legacy.length > MAX_LEGACY) this.legacy = this.legacy.slice(-MAX_LEGACY);
    const outgoingBestStat = this._bestOutgoingStat();
    const immuneClimas = Object.keys(ABUELO_DATA[this.id].clima).filter((k) => ABUELO_DATA[this.id].clima[k] === 1);

    const genStats = {};
    for (const k of STAT_KEYS) {
      const base = ABUELO_DATA[this.id].stats[k];
      genStats[k] = clamp(base + Math.round(gauss() * 2) + (k === 'aguante' ? 1 : 0), 3, 9);
    }
    this.genStats = genStats;
    this.bonus = {};
    this.potentialCap = null;
    this.xp = 0; this.level = 0; this.points = 0;
    this.torneos = 0;
    this.mo = 0;
    this.st = 100;
    this.gen += 1;
    this.age = Math.round(rnd(32, 46));
    this.signed = null;
    this.career = { wins: 0, losses: 0, bestStreak: 0, closestWin: null };
    this.formStreak = 0;

    // herencia: un eco del abuelo saliente, elegido al azar entre una
    // afinidad climática suavizada (si era inmune a algo) o un empujón en
    // su mejor stat — nunca las dos a la vez, para que sea un rasgo con
    // sabor y no una acumulación de bonus gratis
    let inherited;
    if (immuneClimas.length && Math.random() < 0.5) {
      inherited = { clima: immuneClimas[Math.floor(Math.random() * immuneClimas.length)] };
    } else {
      this.bonus[outgoingBestStat] = (this.bonus[outgoingBestStat] || 0) + 10;
      inherited = { stat: outgoingBestStat };
    }
    this.inherited = inherited;
    this.debt = debt;
    this.agingFlavorSeen = false; // generación nueva, todavía nada que presagiar
    return { inherited, debt };
  }

  // probabilidad de fallecer esta temporada: crece con la edad a partir de
  // los 70, cada vez más deprisa (término cuadrático, no una recta) — a
  // los 75 sigue siendo un riesgo pequeño, a los 90 ya pesa de verdad,
  // acompañando al declive físico de ageDeclineFor en vez de ser una
  // tirada de dados desconectada de cómo se le ve jugar.
  deathChance() {
    const over = Math.max(0, this.age - 70);
    return clamp(over * over * 0.00003 + over * 0.0003, 0, 0.05);
  }

  recordMatchResult(won, marginPoints) {
    if (won) {
      this.career.wins++;
      this.formStreak = (this.formStreak || 0) + 1;
      if (this.formStreak > this.career.bestStreak) this.career.bestStreak = this.formStreak;
      if (marginPoints !== undefined && marginPoints !== null) {
        if (this.career.closestWin === null || marginPoints < this.career.closestWin) {
          this.career.closestWin = marginPoints;
        }
      }
    } else { this.career.losses++; this.formStreak = 0; }
  }

  // fotografía de fin de temporada para el histórico de la vista de detalle
  // (ver PenyaScreen._drawAbueloDetail): se guardan las victorias/derrotas
  // ACUMULADAS de la generación actual (career.wins/losses, que ya vive en
  // el propio estado) en vez de intentar llevar la cuenta de un delta por
  // separado — la diferencia entre dos filas consecutivas de la misma
  // generación ya da las victorias/derrotas de esa temporada en concreto;
  // si `gen` cambia de una fila a la siguiente, el salto se debe a un
  // relevo (la cuenta vuelve a cero), no a una temporada floja de verdad.
  recordSeasonSnapshot(season, level) {
    const avgStat = Math.round(STAT_KEYS.reduce((sum, k) => sum + this.getStatDisplay(k), 0) / STAT_KEYS.length);
    this.seasonLog.push({
      season, level, gen: this.gen, age: this.age, moral: this.mo,
      cumWins: this.career.wins, cumLosses: this.career.losses, avgStat,
    });
    if (this.seasonLog.length > MAX_SEASON_LOG) this.seasonLog = this.seasonLog.slice(-MAX_SEASON_LOG);
  }

  // en racha (3+ victorias seguidas): un pelín más firme en la mesa
  get inFormBonus() { return this.formStreak >= 3; }

  isInjured(currentDay) { return this.injuredUntil > currentDay; }
}
