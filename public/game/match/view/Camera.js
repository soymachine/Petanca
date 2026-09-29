// Cámara pseudo-3D del partido arcade (docs/REDISENO.md, Fase 3).
// No toca las físicas: solo mira el mundo del terreno desde detrás del
// lanzador y proyecta a píxeles.
//
// Mundo (el de physics/): x = profundidad (0..CW, el círculo de tiro en
// THROW_X), y = lateral en "unidades de celda" (0..CH) que en distancia
// real valen el doble (ver dist2d), z = altura (mismas unidades que x).
// Aquí se trabaja en unidades reales: X = x, L = (y − CH/2)·2, Z = z.
//
// Proyección de cámara estenopeica mirando hacia +X, sin cabeceo: el
// "cabeceo" se simula desplazando la línea de horizonte (lens shift), como
// los juegos de carreras pseudo-3D. d = X − camX:
//   px = centro + F·(L − camL)/d          py = horizonte + F·(camZ − Z)/d
import { CW, CH, THROW_X } from '../../physics/constants.js';

const lerp = (a, b, t) => a + (b - a) * t;

// planos de cámara: x = posición en profundidad, l = lateral, z = altura,
// hz = horizonte (fracción del alto de la vista desde arriba), zoom = F/ancho
const SHOTS = {
  // detrás del lanzador: se ve toda la pista hasta el fondo
  // (desplazada a la izquierda: vista "de hombro", así el arco de la
  // bola se ve como parábola y no como una línea que se aleja)
  aim: { x: THROW_X - 24, l: -9, z: 9.5, hz: 0.17, zoom: 1.08 },
  // lanzando el boliche: un poco más alta, para ver dónde cae
  jack: { x: THROW_X - 24, l: -6, z: 11, hz: 0.16, zoom: 1.0 },
};

export class Camera {
  constructor() {
    this.x = SHOTS.aim.x; this.l = 0; this.z = SHOTS.aim.z; this.hz = SHOTS.aim.hz; this.zoom = SHOTS.aim.zoom;
    this.target = { ...SHOTS.aim };
    this.speed = 3; // velocidad de acercamiento al plano objetivo (1/s)
    this.shot = 'aim';
    this.view = { x: 0, y: 0, w: 1, h: 1 };
    // Fase 6b: cámara fija en el plano de tiro (el director de planos de
    // abajo queda desactivado por ahora; fixed = false lo recupera)
    this.fixed = true;
  }

  // rectángulo de la vista en píxeles de dispositivo
  setView(x, y, w, h) { this.view = { x, y, w, h }; }

  get F() { return this.view.w * this.zoom; }
  get horizonY() { return this.view.y + this.view.h * this.hz; }

  // X,L,Z reales → { sx, sy, s (px por unidad a esa distancia), d } o null
  // si queda detrás de la cámara
  project(X, L, Z) {
    const d = X - this.x;
    if (d < 0.6) return null;
    const k = this.F / d;
    return { sx: this.view.x + this.view.w / 2 + (L - this.l) * k, sy: this.horizonY + (this.z - Z) * k, s: k, d };
  }

  // coordenadas del terreno (x, y en celdas de física, z) → pantalla
  projectWorld(x, y, z = 0) { return this.project(x, (y - CH / 2) * 2, z); }

  // píxel → punto del SUELO (x, y de física) bajo ese píxel, o null si el
  // píxel está por encima del horizonte
  unproject(px, py) {
    const dy = py - this.horizonY;
    if (dy <= 1) return null;
    const d = (this.F * this.z) / dy;
    const L = this.l + ((px - this.view.x - this.view.w / 2) * d) / this.F;
    return { x: this.x + d, y: L / 2 + CH / 2 };
  }

  // el "director": elige plano según lo que pasa en el partido
  direct(M) {
    if (this.fixed) { this.target = { ...SHOTS.aim }; this.speed = 2.6; this.shot = 'aim'; return; }
    const ph = M.phase;
    const lead = M.lastThrown && M.lastThrown.moving ? M.lastThrown : null;
    let t;
    if (ph === 'jackAim' || ph === 'jackPower' || ph === 'roundStart') { t = { ...SHOTS.jack }; this.speed = 2.5; this.shot = 'jack'; }
    else if (ph === 'jackSim' && M.jack) {
      // sigue al boliche mientras rueda
      t = { x: Math.max(SHOTS.jack.x, M.jack.x - 34), l: 0, z: 9, hz: 0.2, zoom: 1.05 }; this.speed = 2.2; this.shot = 'jackfollow';
    } else if (ph === 'sim' && lead) {
      // persecución: la cámara avanza detrás de la bola y baja al rodar
      const flying = (lead.z || 0) > 0.4;
      t = { x: Math.max(SHOTS.aim.x, lead.x - (flying ? 30 : 24)), l: (lead.y - CH / 2) * 2 * 0.35 - (flying ? 7 : 3), z: flying ? 8 : 5, hz: flying ? 0.2 : 0.26, zoom: 1.1 };
      this.speed = flying ? 2.4 : 2.8; this.shot = 'follow';
    } else if ((ph === 'measuring' || ph === 'roundEnd' || ph === 'matchEnd') && M.jack) {
      // a ras de suelo junto al boliche: el momento de la verdad
      t = { x: M.jack.x - 13, l: (M.jack.y - CH / 2) * 2 * 0.8, z: 2.6, hz: 0.34, zoom: 1.2 }; this.speed = 1.6; this.shot = 'closeup';
    } else if ((ph === 'throwDone') && M.jack) {
      // la bola se ha parado: se acerca un poco a la zona del boliche
      t = { x: Math.max(SHOTS.aim.x, Math.min(M.jack.x - 30, 70)), l: 0, z: 7, hz: 0.22, zoom: 1.08 }; this.speed = 1.8; this.shot = 'settle';
    } else { t = { ...SHOTS.aim }; this.speed = 2.6; this.shot = 'aim'; }
    this.target = t;
  }

  update(dt, reduceMotion = false) {
    const k = reduceMotion ? 1 : 1 - Math.exp(-this.speed * dt);
    for (const key of ['x', 'l', 'z', 'hz', 'zoom']) {
      // al llegar (casi) al plano se clava en él: así la cámara queda quieta
      // de verdad y PerspectiveCourt puede reutilizar el fondo ya pintado
      const v = lerp(this[key], this.target[key], k);
      this[key] = Math.abs(v - this.target[key]) < 1e-3 ? this.target[key] : v;
    }
  }

  // salto instantáneo al plano objetivo (al entrar al partido, capturas)
  snap() { for (const key of ['x', 'l', 'z', 'hz', 'zoom']) this[key] = this.target[key]; }
}

export { CW };
