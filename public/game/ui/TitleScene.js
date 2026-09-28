// Escena animada de la portada (docs/REDISENO.md, Fase 4): atardecer
// retro con sol a rayas, silueta de un pueblo, pista de albero en
// perspectiva con grava tipográfica (el ADN Neo-ASCII) y una bola que se
// lanza en bucle hacia el boliche, con su sombra, polvo al caer y un poco
// de rodadura. Todo en píxeles sobre la capa 'under' del renderer: no toca
// la rejilla de texto, así que el menú se dibuja encima sin más.
//
// Uso: const scene = new TitleScene(); cada frame
//   screen.layer('under', (c, R) => scene.draw(c, R, top, bottom, t, still))
// con top/bottom en filas de la rejilla y t en segundos.

const THROW_T = 1.5;   // vuelo
const ROLL_T = 0.45;   // rodadura tras caer
const HOLD_T = 1.1;    // pausa hasta el siguiente tiro
const CYCLE = THROW_T + ROLL_T + HOLD_T;
const MAX_BALLS = 5;

// bolas "ya jugadas" alrededor del boliche (profundidad z, lateral l)
const JACK = { z: 2.5, l: 0.05 };

function rand(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export class TitleScene {
  constructor() {
    this.cycle = -1;
    this.landed = [];
  }

  // destino de la bola del ciclo n (determinista: la escena se repite igual)
  _target(n) {
    return { z: JACK.z + (rand(n + 1) - 0.5) * 0.6, l: JACK.l + (rand(n + 7) - 0.5) * 0.35, mine: n % 2 === 0 };
  }

  draw(c, R, topRow, bottomRow, t, still = false) {
    const W = R.W, y0 = R.cy(topRow), y1 = R.cy(bottomRow);
    const h = y1 - y0;
    const hy = y0 + h * 0.46; // horizonte
    const cxm = W / 2;
    const K = y1 - hy;        // proyección: y = hy + K / z
    const KX = W * 0.36;      // x = cxm + l * KX / z
    // suelo en perspectiva: profundidad z (1 = cerca), lateral l, altura alt
    const P = (z, l, alt = 0) => ({ x: cxm + (l * KX) / z, y: hy + (K * (1 - alt)) / z });

    c.save();
    c.beginPath(); c.rect(0, y0, W, h); c.clip();

    // cielo de atardecer
    const sky = c.createLinearGradient(0, y0, 0, hy);
    sky.addColorStop(0, '#140c24');
    sky.addColorStop(0.45, '#4a1e3a');
    sky.addColorStop(0.8, '#b8503a');
    sky.addColorStop(1, '#f0a050');
    c.fillStyle = sky; c.fillRect(0, y0, W, hy - y0);

    // estrellas tenues arriba
    for (let i = 0; i < 60; i++) {
      const sx = rand(i * 3.1) * W, sy = y0 + rand(i * 5.7) * (hy - y0) * 0.45;
      const tw = still ? 0.5 : 0.35 + 0.35 * Math.sin(t * 1.3 + i);
      c.fillStyle = `rgba(255,240,220,${tw * 0.5})`;
      c.fillRect(sx, sy, Math.max(1, R.dpr), Math.max(1, R.dpr));
    }

    // sol retro a rayas, medio hundido en el horizonte
    const sunR = h * 0.24, sunX = cxm + W * 0.16, sunY = hy - sunR * 0.35;
    const sg = c.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
    sg.addColorStop(0, '#ffe58a'); sg.addColorStop(1, '#ff6a4a');
    c.save();
    c.beginPath(); c.arc(sunX, sunY, sunR, 0, Math.PI * 2); c.clip();
    c.fillStyle = sg; c.fillRect(sunX - sunR, sunY - sunR, sunR * 2, sunR * 2);
    c.fillStyle = '#b8503a';
    for (let k = 0; k < 6; k++) {
      const by = sunY + sunR * (0.05 + k * 0.17);
      c.fillRect(sunX - sunR, by, sunR * 2, Math.max(1, sunR * (0.025 + k * 0.018)));
    }
    c.restore();
    c.shadowColor = '#ffb060'; c.shadowBlur = sunR * 0.5;
    c.strokeStyle = 'rgba(255,200,120,0.15)'; c.lineWidth = 2;
    c.beginPath(); c.arc(sunX, sunY, sunR * 1.02, 0, Math.PI * 2); c.stroke();
    c.shadowBlur = 0;

    // silueta del pueblo: casas bajas, campanario y un par de cipreses
    c.fillStyle = '#26142a';
    let x = 0, n = 0;
    while (x < W) {
      const bw = W * (0.03 + rand(n * 1.7) * 0.05);
      const bh = h * (0.05 + rand(n * 2.3) * 0.08);
      c.fillRect(x, hy - bh, bw + 1, bh);
      // tejado a dos aguas en algunas
      if (rand(n * 4.1) > 0.5) {
        c.beginPath(); c.moveTo(x, hy - bh); c.lineTo(x + bw / 2, hy - bh - bh * 0.35); c.lineTo(x + bw, hy - bh); c.fill();
      }
      x += bw; n++;
    }
    const tx = cxm - W * 0.22, tw = W * 0.02, th = h * 0.3;
    c.fillRect(tx, hy - th, tw, th);
    c.beginPath(); c.moveTo(tx - tw * 0.2, hy - th); c.lineTo(tx + tw / 2, hy - th - h * 0.08); c.lineTo(tx + tw * 1.2, hy - th); c.fill();
    for (const [px, ph] of [[0.72, 0.16], [0.75, 0.2], [0.12, 0.14]]) {
      c.beginPath(); c.ellipse(W * px, hy - h * ph / 2, W * 0.007, h * ph / 2, 0, 0, Math.PI * 2); c.fill();
    }
    // ventanas encendidas
    for (let i = 0; i < 14; i++) {
      const wx = rand(i * 9.1) * W, wy = hy - h * (0.02 + rand(i * 3.3) * 0.06);
      c.fillStyle = `rgba(255,200,110,${0.5 + 0.3 * rand(i)})`;
      c.fillRect(wx, wy, Math.max(2, W * 0.003), Math.max(2, h * 0.012));
    }
    c.fillStyle = '#26142a';

    // suelo de albero
    const g = c.createLinearGradient(0, hy, 0, y1);
    g.addColorStop(0, '#5a3a2a'); g.addColorStop(0.4, '#8a6038'); g.addColorStop(1, '#c49060');
    c.fillStyle = g; c.fillRect(0, hy, W, y1 - hy);
    // resplandor del sol sobre el suelo
    const glow = c.createRadialGradient(sunX, hy, 0, sunX, hy, W * 0.35);
    glow.addColorStop(0, 'rgba(255,190,110,0.35)'); glow.addColorStop(1, 'rgba(255,190,110,0)');
    c.fillStyle = glow; c.fillRect(0, hy, W, y1 - hy);

    // grava tipográfica: puntos y comas que encogen con la distancia
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (let i = 0; i < 260; i++) {
      const z = 1.05 + Math.pow(rand(i * 1.3), 1.7) * 14;
      const l = (rand(i * 2.9) - 0.5) * 3.2 * z / 3;
      const p = P(z, l);
      if (p.x < -20 || p.x > W + 20) continue;
      const fs = Math.max(4, (R.ch * 1.2) / z);
      c.font = `${fs}px ${R.fontFamily || 'monospace'}`;
      c.fillStyle = `rgba(60,36,20,${Math.min(0.7, 0.9 / z + 0.15)})`;
      c.fillText('.,:;·\''[i % 6], p.x, p.y);
    }

    // la pista: rectángulo en perspectiva con sus líneas de cal
    const zNear = 1.15, zFar = 11, half = 0.9;
    const a = P(zNear, -half), b = P(zNear, half), cc = P(zFar, half), d = P(zFar, -half);
    c.strokeStyle = 'rgba(255,240,210,0.55)'; c.lineWidth = Math.max(1, R.dpr * 1.2);
    c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(d.x, d.y); c.lineTo(cc.x, cc.y); c.lineTo(b.x, b.y); c.stroke();
    // círculo de lanzamiento, cerca
    const circ = P(1.6, 0);
    c.beginPath(); c.ellipse(circ.x, circ.y, (KX * 0.12) / 1.6, (KX * 0.12) / 1.6 * 0.18, 0, 0, Math.PI * 2); c.stroke();

    // bolas: boliche, las ya jugadas y la que vuela
    const drawBall = (z, l, alt, color, hi, r0) => {
      const g0 = P(z, l, 0);
      const p = P(z, l, alt);
      const r = Math.max(1.5, (r0 * K) / z);
      // sombra en el suelo
      c.fillStyle = `rgba(20,10,5,${0.45 / (1 + alt * 6)})`;
      c.beginPath(); c.ellipse(g0.x, g0.y + r * 0.2, r * 1.1, r * 0.35, 0, 0, Math.PI * 2); c.fill();
      const bg = c.createRadialGradient(p.x - r * 0.35, p.y - r * 0.45, r * 0.1, p.x, p.y - r * 0.6, r * 1.2);
      bg.addColorStop(0, hi); bg.addColorStop(0.5, color); bg.addColorStop(1, '#1a1a22');
      c.fillStyle = bg;
      c.beginPath(); c.arc(p.x, p.y - r * 0.6, r, 0, Math.PI * 2); c.fill();
    };
    // boliche
    drawBall(JACK.z, JACK.l, 0, '#e8c040', '#fff6c0', 0.04);
    for (const bl of this.landed) drawBall(bl.z, bl.l, 0, bl.mine ? '#7fa8c8' : '#b88a7a', '#ffffff', 0.085);

    {
      // congelado (capturas / reducir movimiento): una foto fija con tres
      // bolas ya jugadas y la cuarta en el aire
      if (still && !this.landed.length) this.landed = [this._target(11), this._target(12), this._target(13)];
      const n = still ? 0 : Math.floor(t / CYCLE);
      const u = still ? THROW_T * 0.55 : t - n * CYCLE;
      const tgt = this._target(n);
      if (!still && n !== this.cycle) {
        // la bola del ciclo anterior queda en la pista
        if (this.cycle >= 0) {
          const prev = this._target(this.cycle);
          this.landed.push({ z: prev.z, l: prev.l, mine: prev.mine });
          if (this.landed.length > MAX_BALLS) this.landed = [];
        }
        this.cycle = n;
      }
      // cae un poco antes del destino y rueda hasta él
      const startZ = 1.12, startL = 0.16, landZ = tgt.z - 0.22;
      const col = tgt.mine ? '#7fa8c8' : '#b88a7a';
      const arc = (k) => 0.55 * 4 * k * (1 - k) + 0.04 * (1 - k); // media volea
      if (u < THROW_T) {
        const k = u / THROW_T;
        const z = startZ + (landZ - startZ) * k;
        const l = startL + (tgt.l - startL) * k;
        drawBall(z, l, arc(k), col, '#ffffff', 0.085);
        // estela
        c.strokeStyle = 'rgba(255,240,200,0.25)'; c.lineWidth = Math.max(1, R.dpr);
        c.beginPath();
        for (let j = 0; j <= 16; j++) {
          const kk = (k * j) / 16;
          const pp = P(startZ + (landZ - startZ) * kk, startL + (tgt.l - startL) * kk, arc(kk));
          if (j === 0) c.moveTo(pp.x, pp.y); else c.lineTo(pp.x, pp.y);
        }
        c.stroke();
      } else {
        const k = Math.min(1, (u - THROW_T) / ROLL_T);
        const ease = 1 - (1 - k) * (1 - k);
        drawBall(landZ + (tgt.z - landZ) * ease, tgt.l, 0, col, '#ffffff', 0.085);
        // polvo al caer
        const dk = (u - THROW_T) / 0.6;
        if (dk < 1) {
          const land = P(landZ, tgt.l);
          for (let i = 0; i < 14; i++) {
            const ang = -Math.PI * (0.1 + 0.8 * rand(i + n * 31));
            const dist = (R.ch * 2.2 * dk * (0.5 + rand(i * 2 + n))) / (tgt.z / 3);
            const px = land.x + Math.cos(ang) * dist * 1.6, py = land.y + Math.sin(ang) * dist * 0.6;
            c.fillStyle = `rgba(230,200,150,${(1 - dk) * 0.7})`;
            c.fillRect(px, py, Math.max(1.5, 3 / tgt.z * R.dpr), Math.max(1.5, 3 / tgt.z * R.dpr));
          }
        }
      }
    }

    // viñeta suave arriba y abajo, para que el texto encima respire
    const vg = c.createLinearGradient(0, y0, 0, y1);
    vg.addColorStop(0, 'rgba(11,14,20,0.85)'); vg.addColorStop(0.12, 'rgba(11,14,20,0)');
    vg.addColorStop(0.85, 'rgba(11,14,20,0)'); vg.addColorStop(1, 'rgba(11,14,20,0.9)');
    c.fillStyle = vg; c.fillRect(0, y0, W, h);
    c.restore();
  }
}
