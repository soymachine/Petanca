import { rnd, clamp, mulberry32, hashStr } from '../core/utils.js';
import { pickNationality } from '../data/names.js';
import { RIVAL_PHOTO_POOL } from '../data/art/rivalPhotoPool.js';

let nextId = 1;

// Un jugador IA de cualquier club de cualquier liga: retrato de una foto
// real (Wikimedia Commons) filtrada a ASCII, igual que los abuelos
// protagonistas — se reparte de una pool pequeña entre los ~90 jugadores.
export class RivalPlayer {
  constructor({ name, nationality, stats, age, id, discovered, levelRange, statsRevealed }) {
    this.id = id ?? nextId++;
    this.name = name;
    this.nationality = nationality; // { code, label }
    this.stats = stats; // { pulso, brazo, mana, temple, aguante } 1..10
    this.age = age;
    const entry = RIVAL_PHOTO_POOL[Math.abs(hashStr(`${this.id}-${this.name}`)) % RIVAL_PHOTO_POOL.length];
    this.portrait = entry.photo; // grande: para pantallas con espacio (Mi Peña, alineación...)
    this.miniPortrait = entry.mini; // pequeño: para el HUD ajustado del partido
    this.clubId = null;
    // Mercado a ciegas: un jugador en venta (`forSale`, ver Club.js) solo
    // aparece en el Mercado del jugador cuando un ojeador lo "descubre"
    // ojeando su país (ver domain/Scouting.js). Hasta entonces no existe
    // de cara al jugador, aunque exista de verdad en el mundo simulado.
    this.discovered = discovered ?? false;
    // rango de nivel 0-100 que le calculó el ojeador que lo descubrió —
    // más ancho y menos centrado cuanto peor el ojeador (ver Scouting.js);
    // null si aún no lo ha descubierto nadie
    this.levelRange = levelRange ?? null;
    // ¿ya se le han revelado las 5 stats reales? (tras varias semanas de
    // un ojeador dedicado a ÉL en concreto, no solo a su país)
    this.statsRevealed = statsRevealed ?? false;
  }

  get avgSkill() {
    const s = this.stats;
    return (s.pulso + s.brazo + s.mana + s.temple + s.aguante) / 5;
  }

  // nivel 0-100 (antes solo se mostraba 1-10): la escala que ve el
  // jugador en el Mercado, tanto en el rango estimado como, tras
  // scoutearlo, en el valor real
  get level100() { return Math.round(this.avgSkill * 10); }

  get value() {
    return Math.round(50 + this.avgSkill * 45 + (this.age < 45 ? 40 : 0));
  }

  // genera un jugador nuevo con un nivel medio dado (1..10 aprox.), con
  // variación aleatoria alrededor de ese nivel. `forceNat` fuerza una
  // nacionalidad concreta (todos los clubes la fuerzan a la suya: no hay
  // mezcla de nacionalidades dentro de un mismo club). `usedNames`, si se
  // pasa, evita repetir un nombre ya usado en el mismo club (hasta 20
  // intentos; con pools de 200+ nombres no debería hacer falta agotarlos).
  static generate(levelAvg, forceNat = null, usedNames = null) {
    const rng = mulberry32(hashStr(`rp-${nextId}-${Date.now() % 99991}-${Math.random()}`));
    const nat = forceNat || pickNationality(rng);
    let name = nat.names[Math.floor(rng() * nat.names.length)];
    if (usedNames && usedNames.size < nat.names.length) {
      for (let tries = 0; tries < 20 && usedNames.has(name); tries++) {
        name = nat.names[Math.floor(rng() * nat.names.length)];
      }
    }
    const mk = () => clamp(Math.round(levelAvg + (rng() - 0.5) * 4), 1, 10);
    const stats = { pulso: mk(), brazo: mk(), mana: mk(), temple: mk(), aguante: mk() };
    // el circuito es de jubilados: el resto del sistema (jugadores con
    // equipo) tiene entre 60 y 80 años; los Sin Equipo (ver FreeAgent) son
    // los únicos más jóvenes, 50-60
    const age = Math.round(rnd(60, 80));
    return new RivalPlayer({ name, nationality: nat, stats, age });
  }
}
