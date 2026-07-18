import { clamp, gauss, rnd } from '../core/utils.js';
import { ABUELO_DATA } from '../data/abuelos.js';

// curva de nivel: nivel 1 cuesta 30 XP, nivel 2 50, nivel 3 70... y cada
// subida da más puntos que la anterior (10, 15, 20...) — constantes
// pensadas para retocarse fácil si el ritmo no cuaja jugando
const LEVEL_CAP = 12;
function xpToNextLevel(level) { return 30 + level * 20; }
function pointsForLevel(level) { return 10 + (level - 1) * 5; }

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
    this.signed = data.signed ?? null; // {name, nationality, portrait} si el hueco lo ocupa un fichaje
    this.injuredUntil = data.injuredUntil ?? 0; // día de temporada hasta el que está de baja (0 = sano)
    this.legacy = data.legacy ?? []; // generaciones anteriores de este mismo hueco (ver retireToGrandchild)
    this.xp = data.xp ?? 0; // progreso de XP dentro del nivel actual
    this.level = data.level ?? 0;
    this.points = data.points ?? 0; // puntos ganados y aún sin repartir entre stats
    // techo por stat (1..10) de un fichaje Sin Equipo: null si no aplica
    // (fichaje normal, sin techo más allá del tope general de 100)
    this.potentialCap = data.potentialCap ?? null;
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
      potentialCap: this.potentialCap,
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
    this.signed = { name: rivalPlayer.name, nationality: rivalPlayer.nationality, portrait: rivalPlayer.portrait, miniPortrait: rivalPlayer.miniPortrait };
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
    return clamp(this._baseStat10(k) * 10 + (this.bonus[k] || 0), 0, cap);
  }

  addMoral(d, gimnasioBonus = false) {
    if (this.id === 4) d *= 2; // EL RUBIO: presumido
    const floor = this.id === 0 ? 0 : (this.item && this.item.id === 'petaca' ? -10 : -20);
    this.mo = clamp(this.mo + d, floor, 20);
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

  // releva al abuelo por su nieto: stats nuevas, misma cara, cansancio a cero.
  // También es lo que ocurre (con otro tono) cuando el abuelo fallece: el
  // testigo pasa a la familia y el hueco de la peña sigue vivo. Antes de
  // relevar, se guarda un resumen de la generación saliente — si no, no
  // queda ni rastro de quién jugó antes en ese hueco.
  retireToGrandchild(reason = 'retiro') {
    this.legacy.push({
      gen: this.gen, name: this.signed ? this.signed.name : null, age: this.age,
      wins: this.career.wins, losses: this.career.losses, bestStreak: this.career.bestStreak,
      reason,
    });
    const ks = ['pulso', 'brazo', 'mana', 'temple', 'aguante'];
    const genStats = {};
    for (const k of ks) {
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
  }

  // probabilidad de fallecer esta temporada: crece con la edad a partir de
  // los 70, y se mantiene siempre pequeña.
  deathChance() {
    return clamp((this.age - 70) * 0.0007, 0, 0.018);
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

  // en racha (3+ victorias seguidas): un pelín más firme en la mesa
  get inFormBonus() { return this.formStreak >= 3; }

  isInjured(currentDay) { return this.injuredUntil > currentDay; }
}
