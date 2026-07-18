// Alineaciones guardadas: nombre -> {formato, team[]} para aplicar de un golpe.
export class LineupPresets {
  constructor(items = []) { this.items = items.slice(); } // [{name, formato, team}]
  static fromJSON(json) { return new LineupPresets(json); }
  toJSON() { return this.items; }

  save(name, formato, team) {
    const existing = this.items.find((p) => p.name === name);
    if (existing) { existing.formato = formato; existing.team = team.slice(); }
    else this.items.push({ name, formato, team: team.slice() });
    if (this.items.length > 5) this.items.shift();
  }

  remove(name) { this.items = this.items.filter((p) => p.name !== name); }
}
