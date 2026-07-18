import { rnd, clamp, dist2d } from '../core/utils.js';
import { CW, CH } from './constants.js';
import { isRainy } from '../data/climas.js';

const GROUND_COLS = ['#b7ab63', '#9a8f4e', '#847a41'];

// El terreno de una partida: calvas de tierra, desgaste en directo y los
// rasgos propios de cada pista (charcos, árbol, pendiente, bandas duras...).
export class Court {
  constructor(featureId) {
    this.featureId = featureId;
    this.ground = [];  // 0..2, calvas más oscuras = más fricción
    this.wear = [];    // desgaste acumulado durante la partida (surcos)
    this.puddles = [];
    this.tree = null;
    this.slope = 0;
    this.wallBounce = 0.4;
    this.frictionMod = 1;
    this.weather = 'SOL';
    this._buildGround();
  }

  _buildGround() {
    this.ground = []; this.wear = [];
    const blobs = [];
    // Roma ('uneven'): adoquines irregulares por todas partes, más calvas
    // y más pequeñas que la media — cada tirada bota distinto
    const nBlobs = this.featureId === 'flat' ? 0 : this.featureId === 'uneven' ? 22 : 12;
    const rMin = this.featureId === 'uneven' ? 1.4 : 2.5, rMax = this.featureId === 'uneven' ? 3.5 : 6.5;
    for (let i = 0; i < nBlobs; i++) {
      blobs.push({ x: rnd(6, CW - 6), y: rnd(3, CH - 3), r: rnd(rMin, rMax) });
    }
    for (let y = 0; y < CH; y++) {
      this.ground.push(new Array(CW).fill(0));
      this.wear.push(new Array(CW).fill(0));
      for (let x = 0; x < CW; x++) {
        let dark = 0;
        for (const b of blobs) {
          const d = Math.sqrt((x - b.x) ** 2 + ((y - b.y) * 2) ** 2);
          if (d < b.r) dark += d < b.r * 0.55 ? 2 : 1;
        }
        this.ground[y][x] = Math.min(2, dark);
      }
    }
  }

  setupFeature(weather, cityDiff) {
    this.weather = weather;
    this.puddles = []; this.tree = null; this.slope = 0; this.wallBounce = 0.4; this.frictionMod = 1;
    switch (this.featureId) {
      case 'slope': this.slope = 2.2; break;
      case 'fastdry': this.frictionMod = 0.8; break;
      case 'walls': this.wallBounce = 0.78; break;
      case 'puddles': {
        const n = weather === 'LLUVIA' ? 4 : 2;
        for (let i = 0; i < n; i++) this.puddles.push({ x: rnd(30, CW - 12), y: rnd(4, CH - 4), r: rnd(2.2, 4) });
        break;
      }
      case 'tree':
        this.tree = { x: rnd(65, 95), y: rnd(7, CH - 7), r: rnd(6, 9) };
        break;

      // --- países extranjeros: mismos primitivos (frictionMod/slope/
      // puddles/tree), aplicados a lo que describe cada `feature.desc` ---

      // Toulouse (polvo de ladrillo) y Porto (humedad pesada): frenan la
      // bola de forma pareja en toda la pista, sin calvas concretas
      case 'brick':
      case 'heavy':
        this.frictionMod = 1.2;
        break;
      // Gent: canales por todas partes, la tierra se queda blanda —
      // frenado aún más marcado que el ladrillo o la humedad
      case 'soft':
        this.frictionMod = 1.45;
        break;
      // Firenze (piedra seca recocida por el sol) y Roma (adoquín duro):
      // superficie más dura y rápida, la bola rueda de más
      case 'heatstone':
      case 'uneven':
        this.frictionMod = 0.85;
        break;
      // Bern: con helada de verdad, el suelo se queda aún más resbaladizo
      // de lo que ya deja HELADA por sí sola (dedos entumecidos + hielo)
      case 'cold':
        if (weather === 'HELADA') this.frictionMod *= 0.85;
        break;
      // Coimbra: cuestas empedradas que frenan cuesta arriba — arrastre,
      // no una deriva direccional como en 'slope'
      case 'uphill':
        this.frictionMod = 1.3;
        break;
    }
  }

  inPuddle(x, y) {
    for (const p of this.puddles) if (dist2d(x, y, p.x, p.y) < p.r) return true;
    return false;
  }

  markWear(x, y) {
    const wy = Math.floor(clamp(y, 0, CH - 1)), wx = Math.floor(clamp(x, 0, CW - 1));
    if (this.wear[wy]) this.wear[wy][wx] = Math.min(2.5, this.wear[wy][wx] + 0.03);
  }

  friction(x, y, ball) {
    const g = (this.ground[Math.floor(clamp(y, 0, CH - 1))] || [])[Math.floor(clamp(x, 0, CW - 1))] || 0;
    let f = g === 2 ? 2.4 : g === 1 ? 1.6 : 1;
    const grip = ball && ball.grip;
    if (isRainy(this.weather) && !grip) f *= 1.35 * (ball && ball.wetPenalty ? ball.wetPenalty : 1);
    if (this.weather === 'HELADA') f *= 0.4;
    if (this.inPuddle(x, y)) f *= grip ? 2.2 : 4;
    f *= this.frictionMod || 1;
    if (ball && ball.rollMod) f *= ball.rollMod;
    const wear = (this.wear[Math.floor(clamp(y, 0, CH - 1))] || [])[Math.floor(clamp(x, 0, CW - 1))] || 0;
    f *= 1 + wear * 0.18;
    return f;
  }

  // microclima local: el viento no sopla igual en toda la cancha
  localWindFactor(x, y) {
    if (this.tree) {
      const d = dist2d(x, y, this.tree.x, this.tree.y);
      if (d < this.tree.r * 1.6) return 0.4 + 0.6 * (d / (this.tree.r * 1.6));
    }
    if (this.featureId === 'walls') {
      const distEdge = Math.min(y, CH - y);
      if (distEdge < 4) return 1.5 - distEdge * 0.12;
    }
    return 1;
  }

  colorAt(x, y) {
    const wet = isRainy(this.weather);
    const icy = this.weather === 'HELADA';
    let col = GROUND_COLS[this.ground[y][x]];
    if (wet) col = ['#9a955e', '#82804a', '#6f6e3e'][this.ground[y][x]];
    if (icy) col = ['#c9dce6', '#a8c0cc', '#8ba8b6'][this.ground[y][x]];
    return col;
  }
}
