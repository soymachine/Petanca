import { rnd, clamp, mulberry32, hashStr } from '../core/utils.js';
import { RIVAL_PHOTO_POOL } from '../data/art/rivalPhotoPool.js';

const FREE_AGENT_NAMES = [
  'EL CHAVAL', 'EL RENACUAJO', 'PACHUCO', 'EL BECERRO', 'EL SOBRINO DEL BAR',
  'EL NIETO DE LA PANCHA', 'EL MOZO DE ALMACÉN', 'EL DE LA ESO', 'CANIJO',
  'EL DE LA BICI', 'EL APRENDIZ', 'EL YERNO NUEVO',
];

let nextId = 1;

// Un jugador Sin Equipo: no pertenece a ningún club ni liga y no cuesta
// nada ficharlo. A diferencia de la vieja cantera, no "madura" solo por
// pasar el tiempo — al no jugar no gana XP ni sube stats, así que se queda
// siempre igual mientras nadie lo ficha. Lo único que promete es su
// potencial (techo por stat): fichado y puesto a jugar, ESE es el límite
// hasta el que podrá entrenar, no el de cualquier otro jugador.
export class FreeAgent {
  constructor({ name, potential, age, id, stats, potentialRevealed }) {
    this.id = id ?? nextId++;
    this.name = name;
    this.nationality = { code: 'ES', label: 'Sin Equipo' };
    this.potential = potential; // techo por stat, 1..10
    this.age = age; // 50-60: más jóvenes que el resto del circuito (60-80)
    this.stats = stats; // stats actuales, bajas y fijas mientras esté aquí — SIEMPRE visibles
    // el potencial (techo) no se ve hasta que un ojeador lo scoutea a él en
    // concreto — sus stats actuales, bajas y sin coste, sí se ven siempre
    this.potentialRevealed = potentialRevealed ?? false;
    const entry = RIVAL_PHOTO_POOL[Math.abs(hashStr(`fa-${this.id}-${this.name}`)) % RIVAL_PHOTO_POOL.length];
    this.portrait = entry.photo;
    this.miniPortrait = entry.mini;
  }

  get potentialStars() {
    const avg = Object.values(this.potential).reduce((a, b) => a + b, 0) / 5;
    return Math.max(1, Math.min(5, Math.round(avg / 2)));
  }

  static generate() {
    const rng = mulberry32(hashStr(`fa-${nextId}-${Date.now() % 99991}-${Math.random()}`));
    const name = FREE_AGENT_NAMES[Math.floor(rng() * FREE_AGENT_NAMES.length)];
    const mkPotential = () => clamp(Math.round(rnd(4, 10)), 1, 10);
    const potential = { pulso: mkPotential(), brazo: mkPotential(), mana: mkPotential(), temple: mkPotential(), aguante: mkPotential() };
    // nivel inicial muy bajo, sin relación fuerte con su potencial: un techo
    // alto no se nota hasta que alguien se lo ficha y lo pone a entrenar
    const mkStat = () => clamp(Math.round(rnd(1, 3)), 1, 10);
    const stats = { pulso: mkStat(), brazo: mkStat(), mana: mkStat(), temple: mkStat(), aguante: mkStat() };
    const age = Math.round(rnd(50, 60));
    return new FreeAgent({ name, potential, age, stats });
  }
}
