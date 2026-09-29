// Pista del partido en perspectiva "tipográfica" (docs/REDISENO.md, Fase 3):
// el suelo es grava hecha de glifos (· , . : ° o) proyectados en 3D que
// encogen con la distancia, las bolas son esferas sombreadas con su sombra
// en el suelo, y el cielo/luz cambian con el clima. Solo DIBUJA: lee el
// estado de Match (bolas, boliche, terreno, clima) y la cámara.
import { CW, CH, THROW_X, BALL_R, JACK_R, GRAV } from '../../physics/constants.js';
import { isRainy } from '../../data/climas.js';

const FONT = '"Menlo", "Consolas", "DejaVu Sans Mono", monospace';

// cielo por clima: [arriba, horizonte], color de la niebla del fondo y luz
export const SKY = {
  SOL: ['#2a4a78', '#e8b872', '#d9b47a', 1],
  LLUVIA: ['#1c2632', '#5a6a78', '#5f6c76', 0.72],
  VIENTO: ['#2a4460', '#b8c8c8', '#a8b4b0', 0.92],
  CALOR: ['#5a3a28', '#ffb866', '#e8a868', 1.05],
  NIEBLA: ['#4a5256', '#9aa4a4', '#a0a8a8', 0.8],
  HELADA: ['#3a5068', '#dfeaf2', '#c8d8e2', 0.95],
  TORMENTA: ['#1a1428', '#4a3a5a', '#4a4458', 0.6],
};

// Paleta del modo ASCII (Fase 6b): cuatro zonas con tono Y luminancia bien
// distintos para que en caracteres no se confundan — cielo, silueta del
// pueblo (oscura, con ventanas), terreno exterior (verde oscuro frío) y
// la pista (albero cálido y claro). [cielo arriba, cielo horizonte,
// pueblo delante, pueblo detrás, exterior lejos, exterior cerca, pista
// cerca, pista lejos, niebla]
export const ASCII_PAL = {
  SOL:      ['#0c1838', '#6a3c80', '#170c22', '#2e1c44', '#1c4031', '#2e7643', '#e8b868', '#b98848', '#5a4a6a'],
  LLUVIA:   ['#08101e', '#2c3c56', '#0c121e', '#1a2436', '#163429', '#245c39', '#bea070', '#8e7650', '#3a4656'],
  VIENTO:   ['#0e2244', '#4a6c90', '#0e1628', '#1e2e46', '#1c4031', '#2e7643', '#e6bc72', '#b48c50', '#4a5a70'],
  CALOR:    ['#24102e', '#b0482c', '#1c0a14', '#3a1a24', '#384c29', '#537330', '#f4c878', '#c4944c', '#8a4a38'],
  NIEBLA:   ['#262c34', '#687278', '#30363e', '#444c54', '#263931', '#395946', '#caa878', '#9a8460', '#7c868a'],
  HELADA:   ['#0c1e3a', '#5a7c9e', '#101c32', '#1e2e48', '#203649', '#305370', '#e6f0f6', '#aac0ce', '#6a8098'],
  TORMENTA: ['#06040c', '#2c1a3e', '#08040e', '#160e22', '#13261c', '#204029', '#a88a5e', '#7a6444', '#2a2436'],
};

export const BALL_COLORS = {
  P: ['#e8f6ff', '#5ab4dc', '#163a52'],
  A: ['#ffe8e8', '#d86060', '#4a1414'],
  T: ['#f0ece0', '#9a968a', '#3a3830'],
  J: ['#fff8d0', '#f0c030', '#6a4a08'],
  J2: ['#fff0d8', '#ff9c5b', '#6a3008'],
};

function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function shade(hex, k) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

export class PerspectiveCourt {
  constructor() {
    this._court = null;
    this.stones = [];
    this.arc = [];        // posiciones recientes de la bola en juego (X, L, Z)
    this._arcBall = null;
    this._glyphCache = new Map();
  }

  // --- textura de grava: se genera una vez por terreno ---
  _ensureTexture(M) {
    if (this._court === M.court && this._weather === M.weather.type) return;
    this._court = M.court; this._weather = M.weather.type;
    const rnd = mulberry32(Math.floor((M.court.ground[5] || []).reduce((s, v, i) => s + v * (i + 1), 7) * 9973));
    const GL = ['·', '·', '.', ',', ':', '°', '·', '.'];
    this.stones = [];
    for (let i = 0; i < 1100; i++) {
      const x = rnd() * CW, y = rnd() * CH;
      const col = M.court.colorAt(Math.min(CW - 1, Math.floor(x)), Math.min(CH - 1, Math.floor(y)));
      const big = rnd() < 0.05;
      this.stones.push({ x, y, g: big ? '•' : GL[Math.floor(rnd() * GL.length)], col: shade(col, 0.72 + rnd() * 0.5), sz: big ? 0.5 : 0.35 + rnd() * 0.3 });
    }
  }

  // glifo pre-renderizado grande (se escala con drawImage: barato)
  _glyph(g, col) {
    const key = g + col;
    let c = this._glyphCache.get(key);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = 32; c.height = 40;
    const x = c.getContext('2d');
    x.font = `32px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = col; x.fillText(g, 16, 21);
    this._glyphCache.set(key, c);
    return c;
  }

  // opts.background (Fase 6, partido en ASCII): solo el fondo — cielo,
  // pueblo, suelo, grava, rasgos de la pista, árbol y niebla —, sin líneas,
  // bolas, arco ni clima (esos los dibuja AsciiScene como ASCII nítido) y
  // sin la caché de píxeles (la caché va en el ASCII ya convertido)
  draw(ctx, cam, M, t, visible = () => true, opts = {}) {
    this._visible = visible;
    this._ensureTexture(M);
    const v = cam.view;
    ctx.save();
    ctx.beginPath(); ctx.rect(v.x, v.y, v.w, v.h); ctx.clip();
    const sky = SKY[M.weather.type] || SKY.SOL;
    if (opts.background) {
      // sin las piedras en píxeles: en ASCII la grava ya es el grano de
      // caracteres
      this._ascii = true;
      this._drawSky(ctx, cam, sky, M, t);
      this._drawGround(ctx, cam, sky, M);
      this._drawFeatures(ctx, cam, M, t);
      if (M.court.tree) this._drawTreeCanopy(ctx, cam, M.court.tree, t);
      this._drawFog(ctx, cam, sky, M);
      this._ascii = false;
      ctx.restore();
      return;
    }
    this._drawStatic(ctx, cam, sky, M, t);
    this._drawFeatures(ctx, cam, M, t);
    if (M.training) this._drawTrainingMarks(ctx, cam, M, t);
    this._trackArc(M);
    this._drawArc(ctx, cam);
    this._drawBalls(ctx, cam, M, sky, t);
    this._drawWeather(ctx, cam, M, t);
    this._drawFog(ctx, cam, sky, M);
    ctx.restore();
  }

  // cielo, pueblo, suelo, grava y líneas no dependen del tiempo, solo de la
  // cámara, el tamaño, el clima y el terreno: con la cámara quieta (apuntar,
  // esperar a la IA...) se pintan una vez en un lienzo aparte y luego se
  // copian de golpe — lo más caro de la escena, sobre todo las ~1100
  // piedras. Con la cámara en marcha se pinta directo, como antes.
  _drawStatic(ctx, cam, sky, M, t) {
    const v = cam.view;
    const key = [Math.round(v.x), Math.round(v.y), Math.round(v.w), Math.round(v.h), cam.x, cam.l, cam.z, cam.hz, cam.zoom, M.weather.type, M.city && M.city.name].join('|');
    const still = key === this._lastKey;
    this._lastKey = key;
    const paint = (c) => {
      this._drawSky(c, cam, sky, M, t);
      this._drawGround(c, cam, sky, M);
      this._drawStones(c, cam, sky);
      this._drawLines(c, cam);
    };
    if (!still || typeof document === 'undefined') { paint(ctx); return; }
    if (this._bgKey !== key || this._bgCourt !== M.court) {
      const w = Math.max(1, Math.ceil(v.w)), h = Math.max(1, Math.ceil(v.h));
      if (!this._bg) this._bg = document.createElement('canvas');
      if (this._bg.width !== w || this._bg.height !== h) { this._bg.width = w; this._bg.height = h; }
      const c = this._bg.getContext('2d');
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, w, h);
      c.translate(-v.x, -v.y);
      paint(c);
      this._bgKey = key; this._bgCourt = M.court;
    }
    ctx.drawImage(this._bg, v.x, v.y);
  }

  _drawSky(ctx, cam, sky, M, t) {
    const v = cam.view;
    const hy = cam.horizonY;
    const pal = this._ascii ? (ASCII_PAL[M.weather.type] || ASCII_PAL.SOL) : null;
    const g = ctx.createLinearGradient(0, v.y, 0, hy);
    g.addColorStop(0, pal ? pal[0] : sky[0]); g.addColorStop(1, pal ? pal[1] : sky[1]);
    ctx.fillStyle = g;
    ctx.fillRect(v.x, v.y, v.w, Math.max(0, hy - v.y) + 2);
    // silueta del pueblo en el horizonte: dos capas de bloques (la de
    // atrás más clara por la bruma) con ventanas encendidas y parallax
    const unit = Math.max(3, v.w / 140);
    for (const layer of [0, 1]) {
      const rnd = mulberry32((M.city && M.city.name ? M.city.name.length * 131 : 7) + 11 + layer * 57);
      const par = -cam.l * unit * (layer ? 0.5 : 0.25);
      const base = pal ? (layer ? pal[2] : pal[3]) : layer ? blend(shade(sky[1], 0.35), '#140f0a', 0.35) : blend(shade(sky[1], 0.7), sky[0], 0.35);
      let x = v.x - unit * 12 + (par % (unit * 6));
      while (x < v.x + v.w + unit * 12) {
        const w = unit * (2 + Math.floor(rnd() * 5));
        const tall = rnd() < 0.07;
        const h = unit * (layer ? 1.2 + rnd() * 4 : 2.5 + rnd() * 5) * (tall ? 2.2 : 1);
        ctx.fillStyle = base;
        ctx.fillRect(Math.round(x), Math.round(hy - h), Math.ceil(w), Math.ceil(h + 1));
        if (tall) { ctx.fillRect(Math.round(x + w / 2 - unit * 0.3), Math.round(hy - h - unit * 1.5), Math.ceil(unit * 0.6), Math.ceil(unit * 1.5)); }
        if (layer) {
          ctx.fillStyle = pal ? '#ffb040' : 'rgba(255,214,140,0.55)';
          for (let wy = hy - h + unit; wy < hy - unit * 0.5; wy += unit * 1.3) {
            for (let wx = x + unit * 0.5; wx < x + w - unit * 0.4; wx += unit * 1.2) {
              if (rnd() < 0.3) ctx.fillRect(Math.round(wx), Math.round(wy), Math.max(1, Math.round(unit * 0.35)), Math.max(1, Math.round(unit * 0.45)));
            }
          }
        }
        x += w + unit * (rnd() < 0.3 ? 2 : 0);
      }
    }
    // sol / luna
    if (M.weather.type === 'SOL' || M.weather.type === 'CALOR') {
      const sx = v.x + v.w * 0.78, sy = v.y + (hy - v.y) * 0.35;
      const r = unit * 3;
      const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 4);
      sg.addColorStop(0, 'rgba(255,240,200,0.9)'); sg.addColorStop(0.25, 'rgba(255,220,150,0.35)'); sg.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = sg; ctx.fillRect(sx - r * 4, sy - r * 4, r * 8, r * 8);
    }
  }

  // suelo: fuera de la pista (tierra/hierba oscura) + la pista por franjas
  // de profundidad, cada una del color medio del terreno y oscurecida por
  // la niebla de la distancia
  _drawGround(ctx, cam, sky, M) {
    const v = cam.view;
    const hy = cam.horizonY;
    const pal = this._ascii ? (ASCII_PAL[M.weather.type] || ASCII_PAL.SOL) : null;
    const og = ctx.createLinearGradient(0, hy, 0, v.y + v.h);
    og.addColorStop(0, pal ? pal[4] : shade(sky[2], 0.5)); og.addColorStop(1, pal ? pal[5] : shade('#3a3a22', sky[3]));
    ctx.fillStyle = og;
    ctx.fillRect(v.x, hy, v.w, v.y + v.h - hy);

    const x0 = Math.max(0, cam.x + 0.8);
    const steps = 48;
    for (let i = 0; i < steps; i++) {
      // franjas más finas cerca (distribución cuadrática)
      const a = x0 + (CW - x0) * Math.pow(i / steps, 1.6);
      const b = x0 + (CW - x0) * Math.pow((i + 1) / steps, 1.6);
      const pa = [cam.projectWorld(a, 0), cam.projectWorld(a, CH)];
      const pb = [cam.projectWorld(b, 0), cam.projectWorld(b, CH)];
      if (!pa[0] || !pb[0]) continue;
      const mid = Math.min(CW - 1, Math.floor((a + b) / 2));
      const col = M.court.colorAt(mid, Math.floor(CH / 2));
      const fog = Math.min(1, ((a + b) / 2 - cam.x) / 180);
      // franjas alternas (se nota la profundidad en píxeles); en ASCII no,
      // que el conversor las convierte en rayas
      // en ASCII: albero de la paleta (cerca → lejos), sin franjas ni el
      // gris del terreno por celda, que el conversor convertía en rayas
      ctx.fillStyle = pal ? blend(shade(pal[6], 1), pal[7], Math.min(1, fog * 1.6))
        : blend(shade(col, (0.62 + (i % 2) * 0.03) * sky[3]), sky[2], fog * 0.55);
      ctx.beginPath();
      ctx.moveTo(pa[0].sx, pa[0].sy); ctx.lineTo(pa[1].sx, pa[1].sy);
      // solape entre franjas; en ASCII el lienzo es pequeño y medio píxel
      // deja costuras oscuras que el conversor lee como rayas
      const ov = this._ascii ? 4 : 0.5;
      ctx.lineTo(pb[1].sx, pb[1].sy + ov); ctx.lineTo(pb[0].sx, pb[0].sy + ov);
      ctx.closePath(); ctx.fill();
    }
  }

  _drawStones(ctx, cam, sky) {
    // tope de tamaño: de cerca una piedra no puede ser más que un glifo
    // grande (si no, a ras de suelo se ven letras gigantes)
    const hMax = cam.view.h * 0.045;
    for (const s of this.stones) {
      const p = cam.projectWorld(s.x, s.y, 0);
      if (!p) continue;
      const h = Math.min(hMax, p.s * s.sz * 2.2);
      if (h < 1.2) continue;
      if (p.sx < cam.view.x - h || p.sx > cam.view.x + cam.view.w + h || p.sy > cam.view.y + cam.view.h + h) continue;
      const img = this._glyph(s.g, s.col);
      const w = h * 0.8;
      ctx.globalAlpha = Math.min(1, 0.35 + h / 14) * (sky[3] > 0.8 ? 1 : 0.8);
      ctx.drawImage(img, p.sx - w / 2, p.sy - h * 0.55, w, h);
    }
    ctx.globalAlpha = 1;
  }

  _line(ctx, cam, x1, y1, x2, y2, color, width) {
    const a = cam.projectWorld(x1, y1), b = cam.projectWorld(x2, y2);
    if (!a || !b) return;
    ctx.strokeStyle = color; ctx.lineWidth = width;
    ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke();
  }

  _drawLines(ctx, cam) {
    const x0 = Math.max(0, cam.x + 1);
    const w = Math.max(1, cam.view.w / 700);
    this._line(ctx, cam, x0, 0, CW, 0, 'rgba(240,230,200,0.55)', w * 1.5);
    this._line(ctx, cam, x0, CH, CW, CH, 'rgba(240,230,200,0.55)', w * 1.5);
    this._line(ctx, cam, CW, 0, CW, CH, 'rgba(240,230,200,0.45)', w);
    // marcas de distancia cada 10 unidades desde el círculo
    ctx.font = `${Math.round(cam.view.w / 110)}px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    for (let m = 10; THROW_X + m < CW; m += 10) {
      const xm = THROW_X + m;
      if (xm < x0) continue;
      this._line(ctx, cam, xm, -0.6, xm, 0.6, 'rgba(240,230,200,0.5)', w);
      this._line(ctx, cam, xm, CH - 0.6, xm, CH + 0.6, 'rgba(240,230,200,0.5)', w);
      const p = cam.projectWorld(xm, -1.2);
      if (p && p.s > 2.5) { ctx.fillStyle = 'rgba(240,230,200,0.5)'; ctx.fillText(String(m), p.sx, p.sy); }
    }
    // círculo de lanzamiento
    ctx.strokeStyle = 'rgba(255,240,210,0.8)'; ctx.lineWidth = w * 2;
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      const p = cam.project(THROW_X + Math.cos(a) * 2.2, Math.sin(a) * 2.2, 0);
      if (!p) continue;
      if (i === 0) ctx.moveTo(p.sx, p.sy); else ctx.lineTo(p.sx, p.sy);
    }
    ctx.stroke();
  }

  _drawFeatures(ctx, cam, M, t) {
    const court = M.court;
    // desgaste: surcos más oscuros donde han caído/rodado bolas
    ctx.fillStyle = 'rgba(40,30,15,0.35)';
    for (let y = 0; y < CH; y += 1) {
      const row = court.wear[y];
      if (!row) continue;
      for (let x = 0; x < CW; x += 1) {
        if (row[x] < 0.6) continue;
        const p = cam.projectWorld(x + 0.5, y + 0.5);
        if (!p || p.s < 1.5) continue;
        const r = p.s * 0.45 * Math.min(1.4, row[x] / 1.5);
        ctx.fillRect(p.sx - r, p.sy - r * 0.3, r * 2, r * 0.6);
      }
    }
    for (const pd of court.puddles || []) this._drawPuddle(ctx, cam, pd, t);
    if (court.slope) {
      ctx.font = `bold ${Math.round(cam.view.w / 70)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let x = 30; x < CW; x += 25) {
        const p = cam.projectWorld(x, CH - 3);
        if (!p) continue;
        ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 3 + x);
        ctx.fillStyle = '#e8d890';
        ctx.save(); ctx.translate(p.sx, p.sy); ctx.scale(Math.min(3, p.s / 8), Math.min(3, p.s / 8) * 0.5); ctx.fillText('▼', 0, 0); ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
    if (court.tree) this._drawTreeShadow(ctx, cam, court.tree);
  }

  // entrenamientos: diana de 3 anillos alrededor del boliche (todos los
  // drills que puntúan por cercanía), "+" donde estaban las bolas viejas
  // (TIRO) y marca del obstáculo a rodear (EFECTO) — lo mismo que la vista
  // clásica, en perspectiva
  _drawTrainingMarks(ctx, cam, M, t) {
    const lw = Math.max(1, cam.view.w / 600);
    if (M.training !== 'TIRO' && M.jack) {
      const rings = [[9, 'rgba(132,122,65,0.8)'], [6, 'rgba(176,154,80,0.9)'], [3, 'rgba(232,200,50,1)']];
      for (const [r, col] of rings) {
        const p = cam.projectWorld(M.jack.x, M.jack.y);
        if (!p) continue;
        const rx = r * p.s, ry = rx * Math.max(0.12, Math.min(0.6, (cam.z * 1.1) / p.d));
        ctx.strokeStyle = col; ctx.lineWidth = lw * (r === 3 ? 2.5 : 1.5);
        ctx.beginPath(); ctx.ellipse(p.sx, p.sy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
      }
    }
    for (const b of M.balls) {
      if (b.owner !== 'T') continue;
      const p = cam.projectWorld(b.ox, b.oy);
      if (!p) continue;
      const r = Math.max(4, p.s * 1.1);
      ctx.strokeStyle = M.training === 'EFECTO' ? 'rgba(200,120,70,0.9)' : 'rgba(220,215,190,0.7)'; ctx.lineWidth = lw * 2;
      ctx.beginPath(); ctx.moveTo(p.sx - r, p.sy); ctx.lineTo(p.sx + r, p.sy); ctx.moveTo(p.sx, p.sy - r * 0.4); ctx.lineTo(p.sx, p.sy + r * 0.4); ctx.stroke();
    }
  }

  _ellipse(ctx, cam, x, y, rReal, fill) {
    const p = cam.projectWorld(x, y);
    if (!p) return null;
    const rx = rReal * p.s;
    const ry = rx * Math.max(0.12, Math.min(0.6, (cam.z * 1.1) / p.d));
    ctx.fillStyle = fill;
    ctx.beginPath(); ctx.ellipse(p.sx, p.sy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    return { p, rx, ry };
  }

  _drawPuddle(ctx, cam, pd, t) {
    const e = this._ellipse(ctx, cam, pd.x, pd.y, pd.r, 'rgba(60,110,150,0.75)');
    if (!e) return;
    ctx.strokeStyle = 'rgba(190,225,245,0.5)'; ctx.lineWidth = Math.max(1, e.rx / 30);
    for (let k = 0; k < 2; k++) {
      const ph = (t * 0.6 + k * 0.5) % 1;
      ctx.globalAlpha = 1 - ph;
      ctx.beginPath(); ctx.ellipse(e.p.sx, e.p.sy, e.rx * ph, e.ry * ph, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  _drawTreeShadow(ctx, cam, tree) {
    this._ellipse(ctx, cam, tree.x, tree.y, tree.r * 0.9, 'rgba(20,40,15,0.35)');
  }

  // copa del árbol (Valencia): por encima de las bolas lejanas, pero se
  // dibuja con las bolas ordenado por profundidad (ver _drawBalls)
  _drawTreeCanopy(ctx, cam, tree, t) {
    const base = cam.projectWorld(tree.x, tree.y, 0);
    if (!base) return;
    const trunkTop = cam.projectWorld(tree.x, tree.y, 5);
    ctx.strokeStyle = '#5a3a20'; ctx.lineWidth = Math.max(2, base.s * 0.7);
    ctx.beginPath(); ctx.moveTo(base.sx, base.sy); ctx.lineTo(trunkTop.sx, trunkTop.sy); ctx.stroke();
    const rnd = mulberry32(Math.floor(tree.x * 97 + tree.y * 13));
    for (let i = 0; i < 70; i++) {
      const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * tree.r * 0.8;
      const h = 5 + rnd() * tree.r * 0.8 + Math.sin(t * 1.5 + i) * 0.15;
      const p = cam.project(tree.x + Math.cos(a) * rr, (tree.y - CH / 2) * 2 + Math.sin(a) * rr * 1.2, h);
      if (!p) continue;
      const g = ['♣', '♠', '❀', '♣'][i % 4];
      const img = this._glyph(g, i % 5 === 0 ? '#6aaa5a' : i % 2 ? '#2d6b35' : '#3f8a45');
      const s = p.s * 1.6;
      ctx.drawImage(img, p.sx - s * 0.4, p.sy - s * 0.5, s * 0.8, s);
    }
  }

  _trackArc(M) {
    const b = M.lastThrown;
    if (b !== this._arcBall) { this._arcBall = b; this.arc = []; }
    if (b && b.moving) {
      this.arc.push({ X: b.x, L: (b.y - CH / 2) * 2, Z: b.z || 0 });
      if (this.arc.length > 160) this.arc.shift();
    }
  }

  _drawArc(ctx, cam) {
    const n = this.arc.length;
    if (n < 2) return;
    const col = this._arcBall && this._arcBall.owner === 'A' ? '255,140,140' : '150,215,255';
    for (let i = 0; i < n; i += 2) {
      const a = this.arc[i];
      const p = cam.project(a.X, a.L, a.Z + BALL_R);
      if (!p) continue;
      const k = i / n;
      ctx.fillStyle = `rgba(${col},${0.15 + k * 0.5})`;
      const r = Math.max(1, p.s * 0.22);
      ctx.fillRect(p.sx - r, p.sy - r, r * 2, r * 2);
    }
  }

  _drawBalls(ctx, cam, M, sky, t) {
    const items = [];
    const vis = this._visible || (() => true);
    for (const b of M.balls) if (vis(b)) items.push({ b, r: BALL_R });
    if (M.jack && M.training !== 'TIRO' && vis(M.jack)) items.push({ b: M.jack, r: JACK_R });
    if (M.twinJacks && M.jack2 && vis(M.jack2)) items.push({ b: M.jack2, r: JACK_R });
    if (M.court.tree) items.push({ tree: M.court.tree, x: M.court.tree.x });
    // de lejos a cerca
    items.sort((a, b) => (b.tree ? b.x : b.b.x) - (a.tree ? a.x : a.b.x));
    // sombras primero (todas en el suelo)
    for (const it of items) {
      if (it.tree) continue;
      const z = it.b.z || 0;
      this._ellipse(ctx, cam, it.b.x, it.b.y, it.r * (1 + Math.min(1.5, z * 0.06)), `rgba(10,8,4,${0.45 / (1 + z * 0.08)})`);
    }
    for (const it of items) {
      if (it.tree) { this._drawTreeCanopy(ctx, cam, it.tree, t); continue; }
      this._drawSphere(ctx, cam, it.b, it.r, sky);
    }
  }

  _drawSphere(ctx, cam, b, r, sky) {
    const p = cam.projectWorld(b.x, b.y, (b.z || 0) + r);
    if (!p) return;
    const rad = Math.max(1.5, r * p.s);
    const c = BALL_COLORS[b.owner] || BALL_COLORS.T;
    const g = ctx.createRadialGradient(p.sx - rad * 0.35, p.sy - rad * 0.4, rad * 0.05, p.sx, p.sy, rad);
    g.addColorStop(0, c[0]); g.addColorStop(0.45, c[1]); g.addColorStop(1, c[2]);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(p.sx, p.sy, rad, 0, Math.PI * 2); ctx.fill();
    // estrías de las bolas de acero (las del jugador y rival)
    if ((b.owner === 'P' || b.owner === 'A') && rad > 6) {
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = Math.max(1, rad / 10);
      ctx.beginPath(); ctx.ellipse(p.sx, p.sy, rad * 0.95, rad * 0.35, -0.3, 0, Math.PI * 2); ctx.stroke();
    }
    if (b.moving) {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = Math.max(1, rad / 8);
      ctx.beginPath(); ctx.arc(p.sx, p.sy, rad * 1.25, 0, Math.PI * 2); ctx.stroke();
    }
    b._screen = { x: p.sx, y: p.sy, r: rad }; // para rótulos/efectos de la vista
  }

  // clima en 3D: las partículas de Weather (posiciones en el terreno) se
  // levantan en columnas animadas — lluvia en trazos oblicuos con el viento,
  // nieve que cae despacio, calima que sube
  _drawWeather(ctx, cam, M, t) {
    const type = M.weather.type;
    const parts = M.weather.particles || [];
    if (!parts.length) return;
    const wind = M.weather.wind || { x: 0, y: 0 };
    ctx.save();
    for (let i = 0; i < parts.length; i++) {
      const pt = parts[i];
      if (isRainy(type)) {
        const z = 14 - ((t * 22 + i * 3.7) % 14);
        const a = cam.projectWorld(pt.x, pt.y, z);
        const b = cam.projectWorld(pt.x + wind.x * 0.4, pt.y + wind.y * 0.2, z - 1.6);
        if (!a || !b) continue;
        ctx.strokeStyle = 'rgba(160,200,230,0.45)'; ctx.lineWidth = Math.max(1, a.s * 0.08);
        ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke();
      } else if (type === 'HELADA') {
        const z = 12 - ((t * 2.5 + i * 1.3) % 12);
        const p = cam.projectWorld(pt.x + Math.sin(t + i) * 0.8, pt.y, z);
        if (!p) continue;
        ctx.fillStyle = 'rgba(235,245,255,0.8)';
        const r = Math.max(1, p.s * 0.18);
        ctx.fillRect(p.sx - r, p.sy - r, r * 2, r * 2);
      } else if (type === 'CALOR') {
        const z = (t * 1.5 + i * 0.9) % 6;
        const p = cam.projectWorld(pt.x, pt.y, z);
        if (!p) continue;
        ctx.strokeStyle = `rgba(255,220,150,${0.25 * (1 - z / 6)})`; ctx.lineWidth = Math.max(1, p.s * 0.08);
        ctx.beginPath(); ctx.moveTo(p.sx - p.s * 0.8, p.sy); ctx.quadraticCurveTo(p.sx, p.sy - p.s * 0.4, p.sx + p.s * 0.8, p.sy); ctx.stroke();
      } else if (type === 'VIENTO') {
        const z = 1 + (i % 5);
        const p = cam.projectWorld(pt.x, pt.y, z);
        if (!p) continue;
        ctx.strokeStyle = 'rgba(220,215,180,0.35)'; ctx.lineWidth = Math.max(1, p.s * 0.06);
        ctx.beginPath(); ctx.moveTo(p.sx, p.sy); ctx.lineTo(p.sx + wind.y * p.s * 2, p.sy - wind.x * p.s * 0.6); ctx.stroke();
      }
    }
    ctx.restore();
  }

  // niebla de distancia + efectos de clima por encima de la escena
  _drawFog(ctx, cam, sky, M) {
    const v = cam.view;
    const hy = cam.horizonY;
    let dens = M.weather.type === 'NIEBLA' ? 0.75 : isRainy(M.weather.type) || M.weather.type === 'TORMENTA' ? 0.4 : 0.18;
    // en ASCII más suave: que no aplane las cuatro zonas de la paleta
    if (this._ascii) dens *= 0.5;
    const g = ctx.createLinearGradient(0, hy - v.h * 0.05, 0, hy + v.h * 0.35);
    const fc = this._ascii ? (ASCII_PAL[M.weather.type] || ASCII_PAL.SOL)[8] : sky[2];
    g.addColorStop(0, hexA(fc, dens)); g.addColorStop(1, hexA(fc, 0));
    ctx.fillStyle = g;
    ctx.fillRect(v.x, hy - v.h * 0.05, v.w, v.h * 0.4);
  }

  // punto de caída previsto (vuelo parabólico sin viento) y arco
  // punteado limitado por la guía (la Maña decide cuánto se ve)
  static predict(M, power) {
    const prof = M.throwProfile();
    const speed = 14 + power * prof.maxPow;
    const vh = speed * Math.cos(M.loft), vz = speed * Math.sin(M.loft);
    const T = (2 * vz) / GRAV;
    const carry = vh * T;
    const ang = M.aimAngle;
    return {
      speed, vh, vz, T, carry, guideDist: prof.guideLen * 1.6,
      land: { x: THROW_X + Math.cos(ang) * carry, y: CH / 2 + Math.sin(ang) * carry },
      at: (tt) => ({ x: THROW_X + Math.cos(ang) * vh * tt, y: CH / 2 + Math.sin(ang) * vh * tt, z: vz * tt - 0.5 * GRAV * tt * tt }),
    };
  }
}

function blend(rgb, hex, k) {
  const m = rgb.match(/\d+/g).map(Number);
  const h = hex.replace('#', '');
  const o = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  return `rgb(${m.map((v, i) => Math.round(v + (o[i] - v) * k)).join(',')})`;
}

function hexA(hex, a) {
  const h = hex.replace('#', '');
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`;
}
