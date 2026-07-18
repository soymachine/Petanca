import { rnd, clamp } from '../core/utils.js';
import { CW, CH } from './constants.js';
import { isRainy, isWindy } from '../data/climas.js';

// Estado meteorológico de una partida: viento, partículas ambientales y las
// gotas que se quedan pegadas "al cristal" durante la lluvia.
export class Weather {
  constructor(type, cityDiff, feature) {
    this.type = type;
    this.wind = { x: 0, y: 0 };
    this.particles = [];
    this.splats = [];
    this.roll(cityDiff, feature);
  }

  roll(cityDiff, feature) {
    let wStr;
    if (this.type === 'TORMENTA') wStr = rnd(3.2, 5.5);
    else if (this.type === 'VIENTO') wStr = rnd(2.4, 4.2);
    else if (this.type === 'LLUVIA') wStr = rnd(0.5, 1.8);
    else if (this.type === 'NIEBLA') wStr = rnd(0, 0.6);
    else wStr = rnd(0, 2.2) * (cityDiff >= 3 ? 1 : 0.5);
    // Zaragoza, Zürich (föhn) y Lisboa (atlántico): viento con sello propio,
    // nunca por debajo de un mínimo aunque el sorteo de intensidad sea flojo
    if (feature === 'cierzo' || feature === 'fohn' || feature === 'atlantic') wStr = Math.max(wStr, 1.5);
    const wAng = rnd(0, Math.PI * 2);
    this.wind = { x: Math.cos(wAng) * wStr, y: Math.sin(wAng) * wStr * 0.5 };
    this.initParticles();
  }

  initParticles() {
    this.particles = [];
    const wmag = Math.hypot(this.wind.x, this.wind.y);
    let n = 0;
    if (this.type === 'TORMENTA') n = 90;
    else if (this.type === 'LLUVIA') n = 60;
    else if (this.type === 'VIENTO') n = Math.round(wmag * 14);
    else if (this.type === 'NIEBLA') n = 46;
    else if (this.type === 'HELADA') n = 20;
    else if (wmag > 1) n = Math.round(wmag * 4);
    else if (this.type === 'CALOR') n = 14;
    for (let i = 0; i < n; i++) this.particles.push({ x: rnd(0, CW), y: rnd(0, CH), s: rnd(0.6, 1.4) });
  }

  // ráfagas continuas mientras se prepara el tiro: el viento no espera a que sueltes
  gust(frame, round) {
    if (!isWindy(this.type)) return;
    this.wind.x += Math.sin(frame * 0.07 + round) * 0.02;
    this.wind.y += Math.cos(frame * 0.05 + round * 1.3) * 0.014;
    const wm = Math.hypot(this.wind.x, this.wind.y);
    if (wm > 6.5) { this.wind.x *= 6.5 / wm; this.wind.y *= 6.5 / wm; }
  }

  // cada tiro pilla una racha distinta con vendaval/tormenta
  throwJitter() {
    if (!isWindy(this.type)) return;
    const jitter = rnd(-0.6, 0.6);
    this.wind.x += jitter * 0.5; this.wind.y += jitter * 0.25;
  }

  step(frame) {
    for (const p of this.particles) {
      if (isRainy(this.type)) { p.x += this.wind.x * 0.25 * p.s + 0.15; p.y += 0.85 * p.s; }
      else if (this.type === 'CALOR') { p.y -= 0.12 * p.s; p.x += Math.sin(frame * 0.15 + p.s * 9) * 0.25; }
      else if (this.type === 'NIEBLA') { p.x += Math.sin(frame * 0.02 + p.s * 5) * 0.12 + 0.05; }
      else if (this.type === 'HELADA') { p.y += 0.03 * p.s; p.x += Math.sin(frame * 0.05 + p.s * 4) * 0.08; }
      else { p.x += this.wind.x * 0.55 * p.s; p.y += this.wind.y * 0.28 * p.s; }
      if (p.x < 0) p.x += CW; if (p.x >= CW) p.x -= CW;
      if (p.y < 0) p.y += CH; if (p.y >= CH) p.y -= CH;
    }
    if (isRainy(this.type) && this.splats.length < 14 && Math.random() < 0.035) {
      this.splats.push({
        x: Math.floor(rnd(2, CW - 3)), y: Math.floor(rnd(1, CH - 2)),
        ttl: rnd(160, 340), big: Math.random() < 0.45,
      });
    }
    this.splats = this.splats.filter((s) => --s.ttl > 0);
  }

  get magnitude() { return Math.hypot(this.wind.x, this.wind.y); }
}
