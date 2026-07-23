import { dist2d } from '../core/utils.js';
import { CW, CH, GRAV, BALL_R, JACK_R } from './constants.js';

// Simula el vuelo, la rodadura y las colisiones de todas las bolas de una
// mano. No conoce reglas de petanca: solo física.
export class PhysicsWorld {
  step(balls, dt, court, weather, onTreeHit, trail, lastThrown, frame, onLand) {
    for (const b of balls) {
      if (!b.moving) continue;
      const z = b.z || 0;
      if (z > 0 || (b.vz || 0) > 0) this._stepFlight(b, dt, court, weather, onTreeHit, onLand);
      else this._stepRoll(b, dt, court, weather);

      const wb = court.wallBounce || 0.4;
      if (b.x < 1) { b.x = 1; b.vx = Math.abs(b.vx) * wb; }
      if (b.x > CW - 1) { b.x = CW - 1; b.vx = -Math.abs(b.vx) * wb; }
      if (b.y < 1) { b.y = 1; b.vy = Math.abs(b.vy) * wb; }
      if (b.y > CH - 1) { b.y = CH - 1; b.vy = -Math.abs(b.vy) * wb; }

      if (b === lastThrown && frame % 2 === 0 && (b.z || 0) <= 0.2) {
        trail.push({ x: b.x, y: b.y, t: 24 });
      }
    }
    let collided = false;
    for (let i = 0; i < balls.length; i++) {
      for (let j = i + 1; j < balls.length; j++) {
        if ((balls[i].z || 0) > 1.5 || (balls[j].z || 0) > 1.5) continue;
        if (this._collide(balls[i], balls[j])) collided = true;
      }
    }
    return collided;
  }

  _stepFlight(b, dt, court, weather, onTreeHit, onLand) {
    b.vz -= GRAV * dt;
    b.z += b.vz * dt;
    const wf = 1.4 * (b.windFactor === undefined ? 1 : b.windFactor) * court.localWindFactor(b.x, b.y);
    b.vx += weather.wind.x * wf * dt;
    b.vy += weather.wind.y * wf * dt * 0.5;
    // el efecto NO curva la bola mientras vuela: en el aire la trayectoria
    // es recta, la rotación solo se nota al tocar tierra y empezar a rodar
    b.x += b.vx * dt;
    b.y += b.vy * dt * 0.5;
    if (court.tree && !b.hitTree && b.z > 4 && dist2d(b.x, b.y, court.tree.x, court.tree.y) < court.tree.r * 0.8) {
      b.hitTree = true;
      b.vz = Math.min(b.vz, -2);
      b.z = Math.min(b.z, 4);
      b.vx *= 0.2; b.vy *= 0.2;
      if (onTreeHit) onTreeHit();
    }
    if (b.z <= 0) {
      b.z = 0;
      if (b.vz < -9) { b.vz = -b.vz * 0.28; b.vx *= 0.75; b.vy *= 0.75; }
      else { b.vz = 0; if (!b.landed) { b.vx *= 0.5; b.vy *= 0.5; b.landed = true; if (onLand) onLand(b); } }
    }
  }

  _stepRoll(b, dt, court, weather) {
    b.z = 0; b.vz = 0;
    const sp = Math.hypot(b.vx, b.vy);
    if (sp < 0.6) { b.vx = 0; b.vy = 0; b.moving = false; return; }
    const dec = 22 * court.friction(b.x, b.y, b) * dt;
    const ns = Math.max(0, sp - dec);
    b.vx *= ns / sp; b.vy *= ns / sp;
    if (b.spin) {
      // gira la dirección de la rodadura (conserva la velocidad, no la
      // empuja hacia un lado) para que el efecto se note como una curva
      // clara y progresiva, no como un tirón que se diluye con la fricción
      const dtheta = b.spin * 2.6 * dt;
      const c = Math.cos(dtheta), s = Math.sin(dtheta);
      const nvx = b.vx * c - b.vy * s, nvy = b.vx * s + b.vy * c;
      b.vx = nvx; b.vy = nvy;
    }
    if (court.slope) b.vy += court.slope * dt;
    if (!b.isJack && sp > 1.5) court.markWear(b.x, b.y);
    const wf = b.isJack ? 0.8 : 0.15;
    b.vx += weather.wind.x * wf * dt;
    b.vy += weather.wind.y * wf * dt * 0.5;
    b.x += b.vx * dt;
    b.y += b.vy * dt * 0.5;
  }

  _collide(a, b) {
    const ra = a.isJack ? JACK_R : BALL_R;
    const rb = b.isJack ? JACK_R : BALL_R;
    const dx = b.x - a.x, dy = (b.y - a.y) * 2;
    const d = Math.sqrt(dx * dx + dy * dy);
    const minD = ra + rb;
    if (d >= minD || d === 0) return false;
    const nx = dx / d, ny = dy / d;
    const overlap = (minD - d) / 2;
    a.x -= nx * overlap; a.y -= ny * overlap * 0.5;
    b.x += nx * overlap; b.y += ny * overlap * 0.5;
    const ma = a.isJack ? 0.15 : 1;
    const mb = b.isJack ? 0.15 : 1;
    const van = a.vx * nx + a.vy * ny;
    const vbn = b.vx * nx + b.vy * ny;
    if (van - vbn <= 0) return false;
    const e = 0.75;
    const striker = Math.hypot(a.vx, a.vy) > Math.hypot(b.vx, b.vy) ? a : b;
    const pImp = ((1 + e) * (van - vbn)) / (1 / ma + 1 / mb) * (striker.impact || 1);
    a.vx -= (pImp / ma) * nx; a.vy -= (pImp / ma) * ny;
    b.vx += (pImp / mb) * nx; b.vy += (pImp / mb) * ny;
    // "retro": el efecto hacia atrás de un buen "tirar" frena en seco la
    // bola que golpea, dejándola casi clavada donde impacta en vez de seguir
    // rodando — cuanto más comprometido el efecto (ver Match.throwBall),
    // más se frena; es puramente el efecto ya metido, no un dado aparte
    if (striker.retroPower) {
      const damp = 1 - striker.retroPower * 0.8;
      striker.vx *= damp; striker.vy *= damp;
      striker.retroHit = true;
    }
    a.moving = a.vx || a.vy ? true : a.moving;
    b.moving = true;
    a.wasHit = true; b.wasHit = true;
    return true;
  }
}
