import { SCOUT_TEMPLATES } from '../data/scouts.js';

let nextId = 1;

// La plantilla de ojeadores contratados. Cada uno está en uno de tres
// estados: parado, "ojeando un país" (mode:'country' — va sacando
// excedentes nuevos al Mercado con cadencia según su nivel) o "ojeando a
// un jugador" concreto ya descubierto (mode:'player' — tras varias
// semanas revela sus stats reales). Un ojeador solo puede estar en un
// estado a la vez: asignarlo a otra cosa suelta lo que tuviera antes.
export class ScoutStaff {
  constructor(hired = []) {
    // guardados de antes de este sistema no tienen `mode`: se conserva el
    // ojeador (ya pagado) pero se resetea cualquier asignación vieja a
    // parado, en vez de arrastrar un `assignedTo` que ya no significa lo
    // mismo bajo las reglas nuevas
    this.hired = hired.map((h) => {
      const isOldFormat = !('mode' in h);
      return {
        id: h.id, templateId: h.templateId,
        mode: isOldFormat ? null : (h.mode ?? null),
        country: isOldFormat ? null : (h.country ?? null),
        assignedTo: isOldFormat ? null : (h.assignedTo ?? null),
        assignedWeek: isOldFormat ? null : (h.assignedWeek ?? null),
        lastDiscoveryWeek: isOldFormat ? null : (h.lastDiscoveryWeek ?? null),
      };
    });
    for (const h of this.hired) if (h.id >= nextId) nextId = h.id + 1;
  }

  static fromJSON(json) { return new ScoutStaff(json || []); }
  toJSON() { return this.hired; }

  hire(templateId) {
    this.hired.push({ id: nextId++, templateId, mode: null, country: null, assignedTo: null, assignedWeek: null, lastDiscoveryWeek: null });
  }

  template(scoutId) {
    const h = this.hired.find((x) => x.id === scoutId);
    return h ? SCOUT_TEMPLATES.find((t) => t.id === h.templateId) : null;
  }

  // pone a un ojeador a ojear un país entero: suelta cualquier país o
  // jugador que tuviera asignado antes
  assignCountry(scoutId, country, week) {
    const h = this.hired.find((x) => x.id === scoutId);
    if (!h) return;
    h.mode = 'country'; h.country = country;
    h.assignedTo = null; h.assignedWeek = week; h.lastDiscoveryWeek = week;
  }

  // pone a un ojeador a centrarse en un jugador YA DESCUBIERTO en
  // concreto: si otro ojeador ya lo vigilaba, se le suelta primero (un
  // jugador solo tiene un ojeador encima a la vez)
  assignPlayer(scoutId, seedKey, week) {
    for (const h of this.hired) if (h.mode === 'player' && h.assignedTo === seedKey) this.unassign(h.id);
    const h = this.hired.find((x) => x.id === scoutId);
    if (!h) return;
    h.mode = 'player'; h.assignedTo = seedKey;
    h.country = null; h.assignedWeek = week; h.lastDiscoveryWeek = null;
  }

  unassign(scoutId) {
    const h = this.hired.find((x) => x.id === scoutId);
    if (h) { h.mode = null; h.country = null; h.assignedTo = null; h.assignedWeek = null; h.lastDiscoveryWeek = null; }
  }

  scoutOf(seedKey) { return this.hired.find((h) => h.mode === 'player' && h.assignedTo === seedKey) || null; }
  countryScoutOf(country) { return this.hired.find((h) => h.mode === 'country' && h.country === country) || null; }

  // se llama cuando un jugador deja el Mercado de verdad (fichado, o ya
  // no está en venta): libera al ojeador que lo vigilaba en concreto para
  // que se pueda reasignar
  releaseTarget(seedKey) {
    const h = this.scoutOf(seedKey);
    if (h) this.unassign(h.id);
  }

  // tras un ciclo del Mercado, suelta a los ojeadores cuyo objetivo
  // (un jugador en concreto) ya no está en venta
  pruneAssignments(validSeedKeys) {
    for (const h of this.hired) {
      if (h.mode === 'player' && h.assignedTo && !validSeedKeys.has(h.assignedTo)) this.unassign(h.id);
    }
  }
}
