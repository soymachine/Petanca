const WEEKDAYS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

// El calendario semanal: los partidos de liga caen siempre en domingo: el
// resto de la semana se puede agendar un entrenamiento por hueco. El botón
// de "avanzar día" salta directamente al próximo día con algo que hacer.
export class SeasonClock {
  constructor(day = 1, trainings = {}, cupMatches = {}, seasonWeekOffset = 0, euroCupMatches = {}) {
    this.day = day; // 1 = lunes de la semana 1
    this.trainings = trainings; // { [day]: { abueloId, drill } }
    this.cupMatches = cupMatches; // { [day]: true } — días con partido de Copa agendado
    this.euroCupMatches = euroCupMatches; // { [day]: true } — días con partido de Copa de Europa agendado
    // league.matchday se reinicia a 0 en cada temporada nueva (ascenso,
    // descenso o repesca en la misma liga), pero la semana del calendario
    // (this.day) nunca se reinicia: sigue subiendo desde el día 1 de toda
    // la partida. Este offset traduce "semana absoluta" a "jornada de la
    // temporada actual" — sin él, tras la primera temporada la jornada
    // calculada se dispara por encima de fixtures.length y ningún domingo
    // vuelve a detectarse como día de partido (bug real, no cosmético).
    this.seasonWeekOffset = seasonWeekOffset;
  }

  static fromJSON(json) {
    return json ? new SeasonClock(json.day, json.trainings, json.cupMatches, json.seasonWeekOffset || 0, json.euroCupMatches || {}) : new SeasonClock();
  }
  toJSON() {
    return {
      day: this.day, trainings: this.trainings, cupMatches: this.cupMatches,
      seasonWeekOffset: this.seasonWeekOffset, euroCupMatches: this.euroCupMatches,
    };
  }

  // se llama justo cuando una liga reinicia su calendario (temporada nueva,
  // con o sin cambio de categoría): la jornada 0 de esa liga cae la semana
  // que viene, así que el offset se fija para que matchdayForWeek(esa
  // semana) dé 0.
  markSeasonStart() { this.seasonWeekOffset = this.weekIndex + 1; }

  // jornada de liga (0-based) que le corresponde a una semana absoluta
  // dada, según la temporada actualmente en curso
  matchdayForWeek(weekIndex) { return weekIndex - this.seasonWeekOffset; }

  scheduleCup(day) { this.cupMatches[day] = true; }
  clearCup(day) { delete this.cupMatches[day]; }
  scheduleEuroCup(day) { this.euroCupMatches[day] = true; }
  clearEuroCup(day) { delete this.euroCupMatches[day]; }

  // el primer día libre (sin entreno, sin domingo de liga, sin otro cruce
  // de Copa —doméstica o de Europa— ya agendado) a partir de un
  // desplazamiento mínimo
  firstFreeDayFrom(minOffset, league) {
    for (let d = this.day + minOffset; d < this.day + minOffset + 14; d++) {
      const wd = (d - 1) % 7;
      if (wd === 6) continue; // domingo es de liga
      if (this.trainings[d] || this.cupMatches[d] || this.euroCupMatches[d]) continue;
      return d;
    }
    return this.day + minOffset;
  }

  get weekIndex() { return Math.floor((this.day - 1) / 7); }       // 0-based
  get weekday() { return (this.day - 1) % 7; }                      // 0 lunes .. 6 domingo
  get weekdayName() { return WEEKDAYS[this.weekday]; }
  get isMatchDay() { return this.weekday === 6; }
  get matchdayIndex() { return this.matchdayForWeek(this.weekIndex); } // jornada que toca hoy si es domingo

  dateLabel() { return `semana ${this.weekIndex + 1}, ${this.weekdayName}`; }

  scheduleTraining(day, abueloId, drill) { this.trainings[day] = { abueloId, drill }; }
  clearTraining(day) { delete this.trainings[day]; }
  trainingToday() { return this.trainings[this.day] || null; }

  // 7 días vistos desde hoy + un desplazamiento (0 = esta semana, 7 = la
  // siguiente...), con lo que hay agendado en cada uno
  weekFrom(startOffset, league) {
    const out = [];
    for (let i = 0; i < 7; i++) {
      const d = this.day + startOffset + i;
      const wd = (d - 1) % 7;
      const isSunday = wd === 6;
      const wk = Math.floor((d - 1) / 7);
      const training = this.trainings[d] || null;
      const md = this.matchdayForWeek(wk);
      const hasFixture = isSunday && league && md >= 0 && md < league.fixtures.length;
      const hasCup = !!this.cupMatches[d];
      const hasEuroCup = !!this.euroCupMatches[d];
      out.push({ day: d, weekdayName: WEEKDAYS[wd], isMatchDay: isSunday, hasFixture, hasCup, hasEuroCup, training, weekIndex: wk, matchdayIndex: md });
    }
    return out;
  }

  nextWeek(league) { return this.weekFrom(0, league); }

  // los 7 días de una semana concreta por índice (0 = la primera de la
  // partida), en vez de relativos a "hoy": para pintar un calendario de
  // posiciones FIJAS (lunes siempre en la misma columna) que no se
  // desplaza día a día, solo cambia de página semana a semana.
  weekAt(weekIndex, league) {
    const out = [];
    for (let wd = 0; wd < 7; wd++) {
      const d = weekIndex * 7 + wd + 1;
      const isSunday = wd === 6;
      const training = this.trainings[d] || null;
      const md = this.matchdayForWeek(weekIndex);
      const hasFixture = isSunday && league && md >= 0 && md < league.fixtures.length;
      const hasCup = !!this.cupMatches[d];
      const hasEuroCup = !!this.euroCupMatches[d];
      out.push({ day: d, weekdayName: WEEKDAYS[wd], isMatchDay: isSunday, hasFixture, hasCup, hasEuroCup, training, weekIndex, matchdayIndex: md });
    }
    return out;
  }

  // avanza exactamente UN día (para poder animarlo en la Agenda paso a
  // paso); devuelve qué hay ese día — 'match'|'cup'|'training'|'negotiation'|'free'
  advanceOneDay(league, rollNegotiation) {
    this.day++;
    if (this.euroCupMatches[this.day]) return { type: 'eurocup', day: this.day };
    if (this.cupMatches[this.day]) return { type: 'cup', day: this.day };
    if (this.trainings[this.day]) return { type: 'training', ...this.trainings[this.day], day: this.day };
    if (this.isMatchDay && league && this.matchdayIndex < league.fixtures.length) {
      return { type: 'match', matchdayIndex: this.matchdayIndex, day: this.day };
    }
    if (this.weekday === 0 && rollNegotiation) {
      const offer = rollNegotiation();
      if (offer) return { type: 'negotiation', offer, day: this.day };
    }
    return { type: 'free', day: this.day };
  }

  // avanza día a día hasta el próximo domingo con partido, un entrenamiento
  // agendado, o (con baja probabilidad) una negociación de fichaje —
  // devuelve qué lo paró, o null si se acabaron los días razonables (tope)
  advanceToNextEvent(league, rollNegotiation) {
    const cap = 30;
    for (let i = 0; i < cap; i++) {
      this.day++;
      if (this.euroCupMatches[this.day]) return { type: 'eurocup', day: this.day };
      if (this.cupMatches[this.day]) return { type: 'cup', day: this.day };
      if (this.trainings[this.day]) return { type: 'training', ...this.trainings[this.day], day: this.day };
      if (this.isMatchDay && league && this.matchdayIndex < league.fixtures.length) {
        return { type: 'match', matchdayIndex: this.matchdayIndex, day: this.day };
      }
      if (this.weekday === 0 && rollNegotiation) {
        const offer = rollNegotiation();
        if (offer) return { type: 'negotiation', offer, day: this.day };
      }
    }
    return null;
  }
}
