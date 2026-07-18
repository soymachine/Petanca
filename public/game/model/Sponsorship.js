import { SPONSOR_POOL, SHIRT_SPONSOR_POOL } from '../data/sponsors.js';

// Dos patrocinios a la vez: el de camiseta (permanente, paga una cantidad
// fija cada victoria de liga, se firma y dura hasta que se cambie) y el
// local por objetivos (temporal, paga una prima al cumplir el reto antes
// del plazo). Son independientes entre sí.
export class Sponsorship {
  constructor(active = null, shirt = null) {
    this.active = active; // { id, progress, deadlineJornada }
    this.shirt = shirt; // { id }
  }

  static fromJSON(json) { return new Sponsorship(json ? json.active : null, json ? json.shirt || null : null); }
  toJSON() { return { active: this.active, shirt: this.shirt }; }

  offerNew(currentJornada, managerRep = 0) {
    const pool = SPONSOR_POOL.filter((s) => (!this.active || s.id !== this.active.id) && managerRep >= (s.repRequired || 0));
    const deal = pool[Math.floor(Math.random() * pool.length)];
    this.active = { id: deal.id, progress: 0, deadlineJornada: currentJornada + deal.window };
    return deal;
  }

  currentDeal() { return this.active ? SPONSOR_POOL.find((s) => s.id === this.active.id) : null; }

  // registra un evento del metric indicado; devuelve {completed, expired} tras avanzar
  advance(metric, amount, currentJornada) {
    if (!this.active) return null;
    const deal = this.currentDeal();
    if (!deal || deal.metric !== metric) return null;
    this.active.progress += amount;
    if (this.active.progress >= deal.target) {
      const reward = deal.reward;
      this.active = null;
      return { completed: true, reward, deal };
    }
    if (currentJornada > this.active.deadlineJornada) {
      this.active = null;
      return { expired: true, deal };
    }
    return { completed: false, expired: false, deal };
  }

  tickJornada(currentJornada) {
    if (!this.active) return null;
    if (currentJornada > this.active.deadlineJornada) {
      const deal = this.currentDeal();
      this.active = null;
      return { expired: true, deal };
    }
    return null;
  }

  // --- patrocinador de camiseta ---
  shirtDeal() { return this.shirt ? SHIRT_SPONSOR_POOL.find((s) => s.id === this.shirt.id) : null; }
  signShirt(id) {
    const deal = SHIRT_SPONSOR_POOL.find((s) => s.id === id);
    if (!deal) return null;
    this.shirt = { id };
    return deal;
  }
  shirtWinBonus() { return this.shirtDeal()?.perWin || 0; }
}
