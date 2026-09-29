// El partido renderizado en ASCII (docs/REDISENO.md, Fase 6).
//
// La escena 3D de PerspectiveCourt es la CAPA LÓGICA: se pinta (solo el
// fondo) en un lienzo pequeño y AsciiRaster la convierte en caracteres.
// Encima, todo lo que tiene que leerse nítido se dibuja directamente como
// ASCII con la proyección exacta de la cámara:
//   · vectores: líneas de cal, marcas de distancia, círculo de tiro,
//     retícula, guía de trayectoria, punto de caída, dianas de entreno;
//   · sprites: bolas y boliche como discos sombreados, sus sombras (que se
//     separan de la bola cuando vuela), la estela y chispas/polvo ASCII;
//   · clima: lluvia / | \, nieve * ·, calima ~, rachas de viento.
// La 3D en píxeles no se ve nunca.
import { CW, CH, THROW_X, BALL_R, JACK_R } from '../../physics/constants.js';
import { isRainy } from '../../data/climas.js';
import { AsciiBuffer, convert, drawLine, drawText, drawBall, shadeEllipse, hexToInt, mixInt, lineGlyph, SX, SY } from './AsciiRaster.js';
import { AsciiOut } from './AsciiOut.js';
import { PerspectiveCourt, BALL_COLORS } from './PerspectiveCourt.js';

const AIM_PHASES = ['aim', 'spin', 'loft', 'power'];
const COL = {
  line: hexToInt('#efe4c4'), lineDim: hexToInt('#b8ab86'), mark: hexToInt('#d8cca8'),
  reticle: hexToInt('#ffffff'), guide: hexToInt('#9df09d'), guideHi: hexToInt('#d8ffb0'),
  sweet: hexToInt('#ffd24a'), bad: hexToInt('#ff7a5a'), jackLine: hexToInt('#ffe14d'),
  rain: hexToInt('#9cc8ea'), snow: hexToInt('#eef6ff'), heat: hexToInt('#ffcf8a'), wind: hexToInt('#d8d0a8'),
  dust: hexToInt('#d8c49a'), spark: hexToInt('#fff3c4'), ring: hexToInt('#ffd24a'),
};
const BALLS = Object.fromEntries(Object.entries(BALL_COLORS).map(([k, v]) => [k, v.map(hexToInt)]));

export class AsciiScene {
  constructor(court) {
    this.court = court;              // PerspectiveCourt compartido (capa lógica)
    this.out = new AsciiOut();
    this.parts = [];                 // partículas ASCII (polvo, chispas)
    this._bgKey = null;
    this._frame = 0;
  }

  // (sx, sy) en px de pantalla → celda ASCII fraccionaria
  _cell(p) {
    const L = this.lay;
    return { c: (p.sx - L.x) / L.acw, r: (p.sy - L.y) / L.ach, s: p.s, d: p.d };
  }
  _pw(cam, x, y, z = 0) { const p = cam.projectWorld(x, y, z); return p ? this._cell(p) : null; }

  // --- entrada principal: pinta la vista del partido en ASCII ---
  draw(ctx, R, cam, M, t, vis, ui) {
    const lay = this.out.layout(R, ui.x, ui.y, ui.w, ui.h);
    this.lay = lay;
    cam.setView(lay.x, lay.y, lay.w, lay.h);
    if (!this.buf || this.buf.cols !== lay.cols || this.buf.rows !== lay.rows) {
      this.buf = new AsciiBuffer(lay.cols, lay.rows);
      this.base = new AsciiBuffer(lay.cols, lay.rows);
      this._bgKey = null;
    }
    this._background(R, cam, M, t, vis);
    const buf = this.buf;
    buf.copyFrom(this.base);
    this._lines(cam, M);
    if (M.training) this._trainingMarks(cam, M);
    this._aim(cam, M, t, ui.view);
    this._trail(cam, M);
    this._sprites(cam, M, vis);
    this._weather(cam, M, t);
    this._particles(ui.dt || 1 / 60);
    // franja de abajo más oscura: ahí va la narración
    for (let c = 0; c < buf.cols; c++) {
      buf.darken(c, buf.rows - 1, 0.35);
      buf.darken(c, buf.rows - 2, 0.55);
      if (lay.density > 1) buf.darken(c, buf.rows - 3, 0.75);
    }
    this.out.blit(ctx, buf);
  }

  // fondo: la 3D en el lienzo lógico → ASCII. Se reconvierte al moverse la
  // cámara, al cambiar de fase (surcos nuevos) y cada pocos frames si hay
  // algo animado en la pista (charcos, árbol); si no, se reutiliza
  _background(R, cam, M, t, vis) {
    const lay = this.lay;
    const LW = lay.cols * SX, LH = lay.rows * SY;
    if (!this._lc || this._lc.width !== LW || this._lc.height !== LH) {
      this._lc = document.createElement('canvas');
      this._lc.width = LW; this._lc.height = LH;
      this._lctx = this._lc.getContext('2d', { willReadFrequently: true });
      this._bgKey = null;
    }
    const animated = (M.court.puddles && M.court.puddles.length) || M.court.tree || M.court.slope;
    const key = [cam.x, cam.l, cam.z, cam.hz, cam.zoom, M.weather.type, M.court === this._court, M.phase, lay.key].join('|');
    this._frame++;
    if (key === this._bgKey && !(animated && this._frame % 6 === 0) && this._frame % 45 !== 0) return;
    this._bgKey = key; this._court = M.court;
    const c = this._lctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#000'; c.fillRect(0, 0, LW, LH);
    const kx = LW / lay.w, ky = LH / lay.h;
    c.setTransform(kx, 0, 0, ky, -lay.x * kx, -lay.y * ky);
    this.court.draw(c, cam, M, t, vis, { background: true });
    const img = c.getImageData(0, 0, LW, LH);
    convert(img, this.base, this.out.glyphSet(R.fontFamily));
  }

  // líneas de cal, marcas de distancia y círculo de lanzamiento
  _lines(cam, M) {
    const buf = this.buf, asp = this.lay.aspect;
    const x0 = Math.max(0, cam.x + 1.2);
    const seg = (ax, ay, bx, by, col, o = {}) => {
      const a = this._pw(cam, ax, ay), b = this._pw(cam, bx, by);
      if (a && b) drawLine(buf, a.c, a.r, b.c, b.r, col, { aspect: asp, ...o });
    };
    seg(x0, 0, CW, 0, COL.line);
    seg(x0, CH, CW, CH, COL.line);
    seg(CW, 0, CW, CH, COL.lineDim);
    // marcas cada 10 desde el círculo, con el número si hay sitio
    for (let m = 10; THROW_X + m < CW; m += 10) {
      const xm = THROW_X + m;
      if (xm < x0) continue;
      const p = this._pw(cam, xm, 0), q = this._pw(cam, xm, CH);
      if (p) buf.set(Math.floor(p.c), Math.floor(p.r), '+', COL.mark);
      if (q) buf.set(Math.floor(q.c), Math.floor(q.r), '+', COL.mark);
      const n = this._pw(cam, xm, -1.6);
      if (n && n.s > 2.2) drawText(buf, Math.floor(n.c) - (m >= 100 ? 1 : 0), Math.floor(n.r), String(m), COL.lineDim);
    }
    // círculo de tiro: polígono de 28 lados con el glifo de cada tramo
    let prev = null;
    for (let i = 0; i <= 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      const p = cam.project(THROW_X + Math.cos(a) * 2.2, Math.sin(a) * 2.2, 0);
      const q = p ? this._cell(p) : null;
      if (q && prev) drawLine(buf, prev.c, prev.r, q.c, q.r, COL.line, { aspect: asp });
      prev = q;
    }
  }

  // entrenos: diana de 3 anillos alrededor del boliche y + donde estaban
  // las bolas viejas (mismo dibujo que la vista clásica, en ASCII)
  _trainingMarks(cam, M) {
    const buf = this.buf;
    if (M.training !== 'TIRO' && M.jack) {
      const rings = [[9, '#847a41'], [6, '#b09a50'], [3, '#e8c832']];
      for (const [rr, col] of rings) this._groundEllipse(cam, M.jack.x, M.jack.y, rr, hexToInt(col));
    }
    for (const b of M.balls) {
      if (b.owner !== 'T') continue;
      const p = this._pw(cam, b.ox, b.oy);
      if (p) buf.set(Math.floor(p.c), Math.floor(p.r), '+', hexToInt(M.training === 'EFECTO' ? '#c87846' : '#dcd7be'));
    }
  }

  // elipse en el suelo (radio real rr) como trazo ASCII
  _groundEllipse(cam, x, y, rr, col, glyph = null) {
    let prev = null;
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const p = cam.project(x + Math.cos(a) * rr, (y - CH / 2) * 2 + Math.sin(a) * rr, 0);
      const q = p ? this._cell(p) : null;
      if (q && prev) drawLine(this.buf, prev.c, prev.r, q.c, q.r, col, { aspect: this.lay.aspect, glyph });
      prev = q;
    }
  }

  // retícula, guía de trayectoria y punto de caída (lo que antes era
  // _drawAimOverlay en píxeles, con la misma lógica)
  _aim(cam, M, t, view) {
    const ph = M.phase;
    if (!(M.turn === 'P' && (AIM_PHASES.includes(ph) || ph === 'jackAim' || ph === 'jackPower'))) return;
    const buf = this.buf, asp = this.lay.aspect;
    // retícula donde señalas: ( + ) en el suelo
    if (view.target) {
      const p = this._pw(cam, view.target.x, view.target.y);
      if (p) {
        const c = Math.floor(p.c), r = Math.floor(p.r);
        const w = Math.max(2, Math.round(p.s * 1.6 / this.lay.acw));
        buf.set(c, r, '+', COL.reticle);
        buf.set(c - w, r, '(', COL.reticle); buf.set(c + w, r, ')', COL.reticle);
        if (w > 2) { buf.set(c - w + 1, r, '-', COL.reticle); buf.set(c + w - 1, r, '-', COL.reticle); }
      }
    }
    if (ph.startsWith('jack')) {
      const a = this._pw(cam, THROW_X + 2, CH / 2), b = this._pw(cam, THROW_X + 60, CH / 2 + Math.sin(M.aimAngle) * 60);
      if (a && b) drawLine(buf, a.c, a.r, b.c, b.r, COL.jackLine, { aspect: asp, glyph: '·', every: 2 });
      return;
    }
    // guía: con la potencia actual (o media al apuntar), solo el tramo que
    // alcanza la Maña del abuelo
    const power = ph === 'power' ? M.power : 0.55;
    const pr = PerspectiveCourt.predict(M, power);
    const jitter = M.jitterA || 0;
    const steps = 40;
    const zMax = Math.max(1, (pr.vz * pr.vz) / (2 * 26));
    for (let i = 1; i <= steps; i++) {
      const tt = (i / steps) * pr.T;
      const pt = pr.at(tt);
      const horiz = pt.x - THROW_X;
      if (horiz > pr.guideDist) break;
      const q = this._pw(cam, pt.x, pt.y + Math.sin(jitter) * horiz * 0.5, Math.max(0, pt.z) + 0.3);
      if (!q) continue;
      const hi = pt.z / zMax;
      const fade = 1 - i / steps;
      const ch = hi > 0.85 ? '°' : hi > 0.4 ? '•' : '·';
      buf.set(Math.floor(q.c), Math.floor(q.r), ch, mixInt(mixInt(COL.guide, COL.guideHi, hi), 0x203020, (1 - fade) * 0.5));
    }
    if (ph === 'power') {
      const l = this._pw(cam, pr.land.x, pr.land.y);
      if (l) {
        const col = M.isSweet(M.power) ? COL.sweet : COL.bad;
        const on = Math.sin(t * 14) > -0.3;
        const c = Math.floor(l.c), r = Math.floor(l.r);
        buf.set(c, r, on ? 'X' : 'x', col, mixInt(col, 0, 0.7));
        buf.set(c - 1, r, '>', col); buf.set(c + 1, r, '<', col);
      }
    }
  }

  // estela de la bola en juego (posiciones recientes de PerspectiveCourt)
  _trail(cam, M) {
    this.court._trackArc(M);
    const arc = this.court.arc, n = arc.length;
    if (n < 2) return;
    const col = this.court._arcBall && this.court._arcBall.owner === 'A' ? hexToInt('#ff8c8c') : hexToInt('#96d7ff');
    for (let i = 0; i < n; i += 2) {
      const a = arc[i];
      const p = cam.project(a.X, a.L, a.Z + BALL_R);
      if (!p) continue;
      const q = this._cell(p);
      const k = i / n;
      const c = Math.floor(q.c), r = Math.floor(q.r);
      if (!this.buf.inside(c, r)) continue;
      this.buf.set(c, r, k > 0.8 ? '•' : k > 0.4 ? '·' : '.', mixInt(this.buf.bg[r * this.buf.cols + c], col, 0.35 + k * 0.6));
    }
  }

  // bolas y boliche: sombras en el suelo y luego los discos, de lejos a cerca
  _sprites(cam, M, vis) {
    const buf = this.buf, L = this.lay;
    const items = [];
    for (const b of M.balls) if (vis(b)) items.push({ b, r: BALL_R });
    if (M.jack && M.training !== 'TIRO' && vis(M.jack)) items.push({ b: M.jack, r: JACK_R });
    if (M.twinJacks && M.jack2 && vis(M.jack2)) items.push({ b: M.jack2, r: JACK_R });
    items.sort((a, b) => b.b.x - a.b.x);
    for (const it of items) {
      const z = it.b.z || 0;
      const g = cam.projectWorld(it.b.x, it.b.y, 0);
      if (!g) continue;
      const q = this._cell(g);
      const rx = (it.r * g.s * (1 + Math.min(1.5, z * 0.06))) / L.acw;
      const ry = Math.max(0.35, rx * (L.acw / L.ach) * Math.max(0.15, Math.min(0.6, (cam.z * 1.1) / g.d)));
      shadeEllipse(buf, q.c, q.r, Math.max(0.5, rx), ry, 0.35 + Math.min(0.5, z * 0.04));
    }
    for (const it of items) {
      const b = it.b;
      const p = cam.projectWorld(b.x, b.y, (b.z || 0) + it.r);
      if (!p) continue;
      const q = this._cell(p);
      const rad = Math.max(1, it.r * p.s);
      const key = b === M.jack ? 'J' : b === M.jack2 ? 'J2' : b.owner;
      const cols = BALLS[key] || BALLS.T;
      drawBall(buf, q.c, q.r, rad / L.acw, rad / L.ach, cols, { grooves: b.owner === 'P' || b.owner === 'A' });
      b._screen = { x: p.sx, y: p.sy, r: rad }; // para rótulos/efectos de la vista
    }
    // quién manda: la bola más cercana al boliche lleva un aro dorado
    const pb = M.bestBall && M.bestBall('P'), ab = M.bestBall && M.bestBall('A');
    const lead = pb && ab ? (pb.d < ab.d ? pb.b : ab.b) : pb ? pb.b : ab ? ab.b : null;
    if (lead && !lead.moving && vis(lead) && lead._screen && M.phase !== 'sim') {
      const q = this._cell({ sx: lead._screen.x, sy: lead._screen.y, s: 0, d: 0 });
      const w = Math.max(1, Math.round(lead._screen.r / L.acw)) + 1;
      buf.set(Math.floor(q.c) - w, Math.floor(q.r), '[', COL.ring);
      buf.set(Math.floor(q.c) + w, Math.floor(q.r), ']', COL.ring);
    }
  }

  // clima: las partículas de Weather levantadas en columnas, como caracteres
  _weather(cam, M, t) {
    const type = M.weather.type;
    const parts = M.weather.particles || [];
    if (!parts.length) return;
    const wind = M.weather.wind || { x: 0, y: 0 };
    const buf = this.buf;
    for (let i = 0; i < parts.length; i++) {
      const pt = parts[i];
      if (isRainy(type)) {
        const z = 14 - ((t * 22 + i * 3.7) % 14);
        const a = this._pw(cam, pt.x, pt.y, z), b = this._pw(cam, pt.x + wind.x * 0.4, pt.y + wind.y * 0.2, z - 1.6);
        if (!a || !b) continue;
        const ch = lineGlyph(b.c - a.c, b.r - a.r, 0.5, this.lay.aspect);
        buf.set(Math.floor(a.c), Math.floor(a.r), ch === '-' || ch === '_' || ch === '¯' ? '|' : ch, COL.rain);
        // salpicadura al tocar el suelo
        if (z < 1.2) { const g = this._pw(cam, pt.x, pt.y, 0); if (g) buf.set(Math.floor(g.c), Math.floor(g.r), '.', COL.rain); }
      } else if (type === 'HELADA') {
        const z = 12 - ((t * 2.5 + i * 1.3) % 12);
        const p = this._pw(cam, pt.x + Math.sin(t + i) * 0.8, pt.y, z);
        if (p) buf.set(Math.floor(p.c), Math.floor(p.r), i % 3 ? '·' : '*', COL.snow);
      } else if (type === 'CALOR') {
        const z = (t * 1.5 + i * 0.9) % 6;
        const p = this._pw(cam, pt.x, pt.y, z);
        if (p && z < 4) buf.set(Math.floor(p.c), Math.floor(p.r), '~', mixInt(COL.heat, 0x302010, z / 5));
      } else if (type === 'VIENTO') {
        const p = this._pw(cam, pt.x, pt.y, 1 + (i % 5));
        if (!p) continue;
        const len = 2 + (i % 3);
        for (let k = 0; k < len; k++) buf.set(Math.floor(p.c + k * Math.sign(wind.y || 1)), Math.floor(p.r), k === len - 1 ? '~' : '-', COL.wind);
      }
    }
  }

  // --- partículas ASCII (polvo al caer, chispas en los choques) ---
  burstAtScreen(sx, sy, kind) {
    if (!this.lay) return;
    const c = (sx - this.lay.x) / this.lay.acw, r = (sy - this.lay.y) / this.lay.ach;
    const dust = kind === 'dust';
    const n = dust ? 14 : 22;
    for (let i = 0; i < n; i++) {
      const a = dust ? -Math.PI * (0.1 + Math.random() * 0.8) : Math.random() * Math.PI * 2;
      const sp = (dust ? 6 : 14) * (0.4 + Math.random());
      this.parts.push({
        c, r, vc: Math.cos(a) * sp * 1.6, vr: Math.sin(a) * sp * 0.8, life: dust ? 0.7 : 0.5, max: dust ? 0.7 : 0.5,
        ch: dust ? ".,'`"[i % 4] : '*+x\''[i % 4], col: dust ? COL.dust : COL.spark, g: dust ? 14 : 6,
      });
    }
  }

  _particles(dt) {
    const buf = this.buf;
    this.parts = this.parts.filter((p) => (p.life -= dt) > 0);
    for (const p of this.parts) {
      p.c += p.vc * dt; p.r += p.vr * dt; p.vr += p.g * dt;
      const i = Math.floor(p.r) * buf.cols + Math.floor(p.c);
      if (!buf.inside(Math.floor(p.c), Math.floor(p.r))) continue;
      buf.set(Math.floor(p.c), Math.floor(p.r), p.ch, mixInt(buf.bg[i], p.col, Math.min(1, p.life / p.max + 0.3)));
    }
  }
}
