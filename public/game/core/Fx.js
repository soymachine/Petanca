// Efectos "juice" por encima de la rejilla: partículas, sacudida de
// pantalla, destellos, texto flotante, rótulos grandes y la transición
// entre pantallas. Todo en coordenadas de CELDA (fraccionarias), así que
// las pantallas lo usan igual que put/text: fx.burst(40, 20, {...}).
// Lo dibuja core/CanvasRenderer.js (draw: dentro de la sacudida;
// drawOverlay: fijo en pantalla). Respeta Settings (reducir movimiento).
// Ver docs/REDISENO.md, Fase 1.
import { Settings } from './Settings.js';

const RAIN = '░▒▓█▀▄01ABCDEFGHJKLMNPRSTUVWXYZ#@%&*+=<>?';

export class Fx {
  constructor() {
    this.particles = [];
    this.texts = [];
    this.banners = [];
    this._shake = 0;
    this._flash = null;
    this._transition = null;
    this.t = 0;
  }

  update(dt) {
    this.t += dt;
    for (const p of this.particles) {
      p.vy += (p.gravity || 0) * dt;
      p.vx *= 1 - (p.drag || 0) * dt; p.vy *= 1 - (p.drag || 0) * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.age += dt;
    }
    this.particles = this.particles.filter((p) => p.age < p.life);
    for (const t of this.texts) { t.age += dt; t.y += t.vy * dt; t.vy *= 1 - 1.8 * dt; }
    this.texts = this.texts.filter((t) => t.age < t.life);
    for (const b of this.banners) b.age += dt;
    this.banners = this.banners.filter((b) => b.age < b.life);
    this._shake = Math.max(0, this._shake - dt * 6 * Math.max(0.4, this._shake));
    if (this._flash) { this._flash.age += dt; if (this._flash.age > this._flash.life) this._flash = null; }
    if (this._transition) { this._transition.age += dt; if (this._transition.age > this._transition.life) this._transition = null; }
  }

  // --- API para las pantallas ---

  // chispas/polvo desde (x,y) en celdas: n partículas, color(es), velocidad
  // en celdas/s, vida en s; `glyph` opcional (si no, puntos cuadrados)
  burst(x, y, { n = 12, color = '#ffe14d', colors = null, speed = 8, life = 0.7, gravity = 18, spread = Math.PI * 2, angle = -Math.PI / 2, size = 0.22, glyph = null, drag = 1.5 } = {}) {
    const big = Settings.get('reduceMotion') ? 0.4 : 1;
    const count = Math.round(n * big);
    for (let i = 0; i < count; i++) {
      const a = angle + (Math.random() - 0.5) * spread;
      const v = speed * (0.35 + Math.random() * 0.65);
      this.particles.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.55, gravity, drag,
        age: 0, life: life * (0.6 + Math.random() * 0.6),
        color: colors ? colors[i % colors.length] : color, size: size * (0.6 + Math.random() * 0.8), glyph,
      });
    }
  }

  // texto que sube y se desvanece ("+3", "¡BIEN!") — size en celdas de alto
  float(x, y, text, color = '#ffe680', { size = 1, life = 1.2, rise = 3 } = {}) {
    this.texts.push({ x, y, text, color, size, life, age: 0, vy: -rise });
  }

  // rótulo grande centrado en pantalla ("¡CARREAU!"), con resplandor
  banner(text, color = '#ffe14d', { life = 1.4, size = 4, sub = null } = {}) {
    this.banners.push({ text, color, life, size, sub, age: 0 });
  }

  shake(amount = 0.5) {
    if (!Settings.motion('shake')) return;
    this._shake = Math.min(2, Math.max(this._shake, amount));
  }

  flash(color = '#ffffff', alpha = 0.35, life = 0.25) {
    if (Settings.get('reduceMotion')) alpha *= 0.4;
    this._flash = { color, alpha, life, age: 0 };
  }

  // la llama el renderer con una copia del último frame de la pantalla
  // anterior: la nueva la va destapando con un frente de lluvia de glifos
  beginTransition(snapshot) {
    if (!Settings.motion('transitions')) return;
    this._transition = { snapshot, age: 0, life: 0.38, seed: Math.random() * 1000 };
  }

  shakeOffset() {
    if (this._shake <= 0.001) return { x: 0, y: 0 };
    const s = this._shake;
    return { x: (Math.sin(this.t * 71) + Math.sin(this.t * 37)) * 0.5 * s * 0.6, y: (Math.cos(this.t * 63) + Math.sin(this.t * 29)) * 0.5 * s * 0.4 };
  }

  // --- dibujo (lo llama el renderer) ---

  draw(ctx, R) {
    for (const p of this.particles) {
      const k = 1 - p.age / p.life;
      ctx.globalAlpha = Math.max(0, Math.min(1, k * 1.4));
      ctx.fillStyle = p.color;
      const px = R.ox + p.x * R.cw, py = R.oy + p.y * R.ch;
      if (p.glyph) {
        ctx.font = `${R.fontPx * (0.6 + p.size * 2)}px ${R.fontFamily}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(p.glyph, px, py);
      } else {
        const s = Math.max(1, p.size * R.ch * (0.5 + k * 0.5));
        ctx.fillRect(px - s / 2, py - s / 2, s, s);
      }
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const t of this.texts) {
      const k = t.age / t.life;
      ctx.globalAlpha = k < 0.7 ? 1 : Math.max(0, 1 - (k - 0.7) / 0.3);
      const pop = k < 0.12 ? 0.6 + (k / 0.12) * 0.55 : 1.15 - Math.min(0.15, (k - 0.12));
      ctx.font = `bold ${R.fontPx * t.size * pop}px ${R.fontFamily}`;
      ctx.shadowColor = t.color; ctx.shadowBlur = R.ch * 0.5;
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, R.ox + t.x * R.cw, R.oy + t.y * R.ch);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
  }

  drawOverlay(ctx, R) {
    if (this._flash) {
      const f = this._flash;
      ctx.globalAlpha = f.alpha * (1 - f.age / f.life);
      ctx.fillStyle = f.color;
      ctx.fillRect(0, 0, R.W, R.H);
      ctx.globalAlpha = 1;
    }
    for (const b of this.banners) this._drawBanner(ctx, R, b);
    if (this._transition) this._drawTransition(ctx, R, this._transition);
  }

  _drawBanner(ctx, R, b) {
    const k = b.age / b.life;
    const inT = Math.min(1, b.age / 0.18);
    const out = k > 0.8 ? 1 - (k - 0.8) / 0.2 : 1;
    const scale = 0.4 + 0.6 * easeOutBack(inT);
    const cx = R.W / 2, cy = R.oy + R.ch * (R.screenRows ? R.screenRows * 0.42 : 18);
    ctx.save();
    ctx.globalAlpha = Math.max(0, out);
    // franja oscura detrás
    const bandH = R.ch * b.size * 1.7;
    ctx.fillStyle = 'rgba(8,10,14,0.72)';
    ctx.fillRect(0, cy - bandH / 2, R.W, bandH);
    ctx.fillStyle = b.color;
    ctx.fillRect(0, cy - bandH / 2, R.W, Math.max(1, R.dpr * 2));
    ctx.fillRect(0, cy + bandH / 2 - Math.max(1, R.dpr * 2), R.W, Math.max(1, R.dpr * 2));
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `bold ${R.fontPx * b.size * scale}px ${R.fontFamily}`;
    ctx.shadowColor = b.color; ctx.shadowBlur = R.ch * 1.2;
    ctx.fillStyle = b.color;
    ctx.fillText(b.text, cx, cy - (b.sub ? R.ch * 0.5 : 0));
    ctx.shadowBlur = 0;
    if (b.sub) {
      ctx.font = `${R.fontPx * 1.1}px ${R.fontFamily}`;
      ctx.fillStyle = '#e8e0c8';
      ctx.fillText(b.sub, cx, cy + R.ch * b.size * 0.55);
    }
    ctx.restore();
  }

  _drawTransition(ctx, R, tr) {
    const k = Math.min(1, tr.age / tr.life);
    const e = easeInOut(k);
    // frente diagonal que avanza de izquierda a derecha; a su derecha
    // sigue viéndose la pantalla anterior
    const slope = R.H * 0.35;
    const front = -slope + e * (R.W + slope * 2);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(front, 0); ctx.lineTo(R.W, 0); ctx.lineTo(R.W, R.H); ctx.lineTo(front - slope, R.H);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(tr.snapshot, 0, 0);
    ctx.restore();
    // lluvia de glifos en el frente
    ctx.save();
    ctx.font = `${R.fontPx}px ${R.fontFamily}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const rows = Math.ceil(R.H / R.ch);
    for (let r = 0; r < rows; r++) {
      const y = r * R.ch + R.ch / 2;
      const fx = front - slope * (y / R.H);
      for (let j = 0; j < 3; j++) {
        const x = fx - j * R.cw * 1.1;
        const n = Math.floor((tr.seed + r * 13.7 + j * 5.3 + tr.age * 60) % RAIN.length);
        ctx.globalAlpha = 1 - j * 0.3;
        ctx.fillStyle = j === 0 ? '#fff3c4' : '#ffb347';
        ctx.fillText(RAIN[n], x, y);
      }
    }
    ctx.restore();
  }
}

function easeOutBack(t) { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
