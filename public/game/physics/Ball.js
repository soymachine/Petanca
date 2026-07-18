// Una bola (o el boliche) en la pista: posición, velocidad y altura de vuelo.
export class Ball {
  constructor({ x, y, z = 0.01, vx = 0, vy = 0, vz = 0, owner, spin = 0, moving = false }) {
    this.x = x; this.y = y; this.z = z;
    this.vx = vx; this.vy = vy; this.vz = vz;
    this.owner = owner; // 'P' | 'A' | 'J' | 'J2' | 'T' (bola vieja de entrenamiento)
    this.spin = spin;
    this.moving = moving;
    this.landed = false;
    this.hitTree = false;
    this.thrower = null;      // índice del abuelo que la lanzó (owner 'P')
    // modificadores del juego de bolas usado (ver src/data/bolas.js)
    this.windFactor = 1;
    this.rollMod = 1;
    this.impact = 1;
    this.grip = false;
    this.wetPenalty = 1;
    // posición original (bolas viejas del entrenamiento de tiro)
    this.ox = x; this.oy = y;
    this.wasHit = false; // true si alguna vez recibió un impacto real (no solo corrección de solape)
  }

  get isJack() { return this.owner === 'J' || this.owner === 'J2'; }
}
