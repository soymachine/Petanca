import { FACILITIES } from '../data/facilities.js';

const byId = (id) => FACILITIES.find((f) => f.id === id);

// Mejoras del descampado: inversión permanente que beneficia a toda la
// plantilla (no a un abuelo concreto). Cada mejora tiene varios niveles.
export class FacilityManager {
  constructor(levels = {}) {
    // compat: guardados antiguos guardaban un array de ids (equivalente a
    // nivel 1 de cada una); los nuevos guardan { id: nivel }
    if (Array.isArray(levels)) {
      this.levels = {};
      for (const id of levels) this.levels[id] = 1;
    } else {
      this.levels = { ...levels };
    }
  }
  static fromJSON(json) { return new FacilityManager(json); }
  toJSON() { return this.levels; }

  levelOf(id) { return this.levels[id] || 0; }
  has(id) { return this.levelOf(id) > 0; }

  // tier ya comprado (con sus efectos), o null si aún no se tiene ninguno
  currentTier(id) {
    const f = byId(id), lvl = this.levelOf(id);
    return f && lvl > 0 ? f.levels[lvl - 1] : null;
  }
  // siguiente tier a comprar (con precio/efectos), o null si está al máximo
  nextTier(id) {
    const f = byId(id), lvl = this.levelOf(id);
    return f && lvl < f.levels.length ? f.levels[lvl] : null;
  }

  buy(id) {
    if (!this.nextTier(id)) return false;
    this.levels[id] = this.levelOf(id) + 1;
    return true;
  }

  trainingCost() { return 30 - (this.currentTier('luz')?.staSaved || 0); }
  extraRecoveryOnTravel() { return this.currentTier('cobertizo')?.recovery || 0; }
  sweetSpotWidthBonus() { return this.currentTier('marcador')?.sweetBonus || 0; }
  trainingStatBonus() { return this.currentTier('gimnasio')?.statBonus || 1; }
  matchMoneyMultiplier() { return this.currentTier('grada')?.moneyMult || 1; }
  sponsorMultiplier() { return this.currentTier('cartel')?.sponsorMult || 1; }
  eventChanceMultiplier() { return this.currentTier('botiquin')?.eventMult || 1; }

  list() {
    return FACILITIES.map((f) => {
      const level = this.levelOf(f.id);
      return {
        id: f.id, name: f.name, level, maxLevel: f.levels.length,
        current: this.currentTier(f.id), next: this.nextTier(f.id),
      };
    });
  }
}
