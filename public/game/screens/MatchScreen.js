import { CW, CH, COURT_X, COURT_Y, THROW_X, GRAV } from '../physics/constants.js';
import { CLIMAS, isRainy } from '../data/climas.js';
import { ABUELO_DATA, STAT_KEYS, STAT_LABEL } from '../data/abuelos.js';
import { BIG_DIGITS } from '../data/art/staticArt.js';
import { clamp, dist2d } from '../core/utils.js';

export class MatchScreen {
  constructor(game) { this.game = game; }

  update(dt) {
    const { match, input } = this.game;
    match.tickFrame(this.game.frame);
    match.update(dt, input);
    if (match._finished) this.game.onMatchFinished();
  }

  draw() {
    const { screen, frame, faces, rivalFaces } = this.game;
    const M = this.game.match;
    screen.clear();
    const pState = M.roster.get(M.abuelo);
    screen.box(2, 0, 22, 14, M.turn === 'P' ? '#7CFC00' : '#3a3f4a', 'double');
    if (pState.signed) screen.drawAnyPortrait(pState.signed.miniPortrait || pState.signed.portrait, 4, 1);
    else screen.drawPhotoArt(faces[M.abuelo].mini, 4, 1);

    screen.text(26, 1, this.game.displayName(M.abuelo), '#4fc3f7');
    const teamSize = M.teamP.length;
    const ballCount = M.training ? (M.training === 'TIRO' ? 4 : 3) : 3 * teamSize;
    screen.text(26, 2, `${'●'.repeat(M.ballsLeftP)}${'○'.repeat(Math.max(0, ballCount - M.ballsLeftP))}`, '#4fc3f7');
    const st = pState.st;
    const stCol = st > 60 ? '#7ec850' : st > 30 ? '#ffe14d' : '#ff5c5c';
    screen.text(26, 3, `STA ${'▮'.repeat(Math.round(st / 12.5))}${'▯'.repeat(8 - Math.round(st / 12.5))}`, stCol);
    const statsLine = STAT_KEYS.map((k) => `${STAT_LABEL[k][0]}${pState.getStat(k)}`).join(' ');
    screen.text(26, 4, statsLine, '#c9a8e8');
    if (teamSize > 1) {
      const names = M.teamP.map((id) => (id === M.abuelo ? `▶${this.game.displayName(id)}◀` : this.game.displayName(id)));
      screen.text(26, 5, `equipo: ${names.join('  ')}`, '#8ab8d8');
    }

    if (M.training) {
      screen.textCenter(0, `╣ EL DESCAMPADO · ENTRENAMIENTO DE ${M.training} ╠`, '#88c8e8');
      if (M.training === 'ARRIME') screen.textCenter(4, `PUNTOS: ${M.score} / 16`, M.score >= 16 ? '#7ec850' : '#ffe680');
      else screen.textCenter(4, `DERRIBADAS: ${M.targetsHit} / 3`, M.targetsHit >= 3 ? '#7ec850' : '#ffe680');
      screen.textCenter(6, `bolas restantes: ${M.ballsLeftP}`, '#c9c2a8');
      screen.textCenter(8, `premio: +${M._trainBonus} ${M.training === 'ARRIME' ? 'PULSO' : 'BRAZO'} para ${this.game.displayName(M.abuelo)}`, '#d8b8e8');
    } else {
      screen.box(screen.cols - 24, 0, 22, 14, M.turn === 'A' ? '#ef7676' : '#3a3f4a', 'double');
      if (M.rivalMini || M.rivalPortrait) screen.drawAnyPortrait(M.rivalMini || M.rivalPortrait, screen.cols - 22, 1);
      else screen.drawPhotoArt(rivalFaces[M.rivalIdx].photo, screen.cols - 22, 1);
      const rname = `${M.rival}${teamSize > 1 ? ' Y CÍA' : ''} [NIV.${M.aiLevel}]`;
      screen.text(screen.cols - 26 - rname.length, 1, rname, '#ef7676');
      screen.text(screen.cols - 26 - 3, 2, `${'●'.repeat(M.ballsLeftA)}${'○'.repeat(Math.max(0, 3 * teamSize - M.ballsLeftA))}`, '#ef7676');

      screen.textCenter(0, `╣ LIGA DE ${M.city.name} · JORNADA ╠`, M.city.color);

      const scStr = `${M.scoreP}-${M.scoreA}`;
      const bigW = scStr.length * 5 - 1;
      let bx0 = Math.floor((screen.cols - bigW) / 2);
      let pastDash = false;
      for (const c of scStr) {
        if (c === '-') pastDash = true;
        const glyph = BIG_DIGITS[c];
        const col = c === '-' ? '#8a7f66' : pastDash ? '#ef7676' : '#4fc3f7';
        if (glyph) screen.block(bx0, 2, glyph, col);
        bx0 += 5;
      }
      screen.textCenter(8, `· mano ${M.round} · partida a ${M.target} ·`, '#c9c2a8');
      if (M.turn === 'P' && frame % 26 < 18) screen.textCenter(9, '▶▶ TIRAS TÚ ◀◀', '#7CFC00');
      else if (M.turn === 'A') screen.textCenter(9, `tira ${M.rival}...`, '#ef9f9f');
      if (M.streak >= 2 && frame % 20 < 15) screen.textCenter(10, `🔥 RACHA x${M.streak} — pulso más firme`, '#ffb347');
    }

    const cl = CLIMAS[M.weather.type];
    const wmag = M.weather.magnitude;
    const warr = windArrow(M.weather.wind.x, M.weather.wind.y);
    screen.textCenter(11, `${cl.icon} ${cl.label}   ·   viento ${warr} ${wmag.toFixed(1)}`, cl.color);
    const WAVE = '▂▃▄▅▆▅▄▃';
    const phase = frame * (0.04 + wmag * 0.11);
    let flag = '';
    for (let i = 0; i < 7; i++) {
      const amp = 0.4 + Math.min(wmag, 3) * 0.5;
      const s = Math.sin(phase - i * 0.85) * amp;
      flag += WAVE[clamp(Math.round(3.5 + s), 0, WAVE.length - 1)];
    }
    const fx0 = Math.floor(screen.cols / 2) - 4;
    if (M.weather.wind.x >= 0) { screen.put(fx0, 12, '┃', '#8a7f66'); screen.text(fx0 + 1, 12, flag, '#ffcf4d'); }
    else { screen.text(fx0, 12, flag.split('').reverse().join(''), '#ffcf4d'); screen.put(fx0 + 7, 12, '┃', '#8a7f66'); }

    this._drawCourt(M);
    this._drawGuide(M);
    this._drawBalls(M);
    this._drawWeatherFx(M);
    this._drawPanel(M);
  }

  _drawCourt(M) {
    const { screen, frame } = this.game;
    screen.box(COURT_X - 1, COURT_Y - 1, CW + 2, CH + 2, '#8a6f3f', 'double');
    const icy = M.weather.type === 'HELADA';
    for (let y = 0; y < CH; y++) {
      for (let x = 0; x < CW; x++) {
        const w = M.court.wear[y] ? M.court.wear[y][x] : 0;
        if (w > 0.9) screen.put(COURT_X + x, COURT_Y + y, w > 1.7 ? '▪' : '▫', '#6f5a30');
        else screen.put(COURT_X + x, COURT_Y + y, icy ? '▒' : '░', M.court.colorAt(x, y));
      }
    }
    if (M.court.puddles) {
      for (const pd of M.court.puddles) {
        for (let y = 0; y < CH; y++) {
          for (let x = 0; x < CW; x++) {
            if (dist2d(x, y, pd.x, pd.y) < pd.r) screen.put(COURT_X + x, COURT_Y + y, '≈', (x + y + (frame >> 4)) % 2 ? '#4a7a9a' : '#3d688a');
          }
        }
      }
    }
    if (M.court.tree) {
      const t = M.court.tree;
      for (let y = 0; y < CH; y++) {
        for (let x = 0; x < CW; x++) {
          const d = dist2d(x, y, t.x, t.y);
          if (d < t.r * 0.8 && (x * 7 + y * 13) % 3 !== 0) {
            screen.put(COURT_X + x, COURT_Y + y, ['♣', '♠', '❀'][(x + y) % 3], d < t.r * 0.4 ? '#2d6b35' : '#4a8a4a');
          }
        }
      }
      screen.put(COURT_X + t.x, COURT_Y + t.y, '█', '#6b4a2d');
    }
    if (M.court.slope && frame % 40 < 20) {
      for (let i = 0; i < 4; i++) screen.put(COURT_X + 20 + i * 30, COURT_Y + CH - 2, '▼', '#8d8248');
    }
    for (let y = 0; y < CH; y++) if (y % 2 === 0) screen.put(COURT_X + THROW_X - 4, COURT_Y + y, '¦', '#7a6a4a');

    this._replaying = M.decisive && (M.phase === 'roundEnd' || M.phase === 'matchEnd') && M.phaseT < 1.3;
    if (this._replaying) {
      const pulse = frame % 10 < 5;
      for (const t of M.trail) screen.put(COURT_X + t.x, COURT_Y + t.y, pulse ? '●' : '◉', pulse ? '#ffe14d' : '#ff8c5b');
    } else {
      for (const t of M.trail) screen.put(COURT_X + t.x, COURT_Y + t.y, '·', t.t > 12 ? '#c9b98a' : '#7a6f55');
    }

    if (M.phase === 'measuring' && M.measureBalls) this._drawMeasuring(M);
    if (this._replaying && frame % 20 < 14) screen.textCenter(COURT_Y - 2, '◆ ◆ ◆  ¡REPETICIÓN!  ◆ ◆ ◆', '#ffe14d');
  }

  _drawMeasuring(M) {
    const { screen, frame } = this.game;
    const mb = M.measureBalls;
    const grow = Math.min(1, M.phaseT / 1.2);
    for (const [ball, dist, col] of [[mb.p, mb.pd, '#4fc3f7'], [mb.a, mb.ad, '#ef7676']]) {
      const steps = Math.round(dist * grow * 2);
      for (let k = 1; k <= steps; k++) {
        const t2 = k / (dist * 2);
        const lx = M.jack.x + (ball.x - M.jack.x) * t2;
        const ly = M.jack.y + (ball.y - M.jack.y) * t2;
        screen.put(COURT_X + lx, COURT_Y + ly, '·', col);
      }
    }
    if (frame % 20 < 15) screen.textCenter(COURT_Y - 2, '📏  MIDIENDO...  📏', '#ffe14d');
  }

  _drawGuide(M) {
    const { screen, frame } = this.game;
    if (!['aim', 'spin', 'loft', 'power'].includes(M.phase)) return;
    const prof = M.throwProfile();
    const guideLen = prof.guideLen;
    const rollLen = Math.round(guideLen * 0.45);
    let gx = THROW_X, gy = CH / 2;
    const jitteredAngle = M.aimAngle + (M.jitterA || 0);
    let vx = Math.cos(jitteredAngle), vy = Math.sin(jitteredAngle);
    const loftAmt = (M.loft - 0.17) / (1.05 - 0.17);
    // en el aire la trayectoria es recta (el efecto no curva mientras vuela);
    // solo al "tocar tierra" (fin de guideLen) empieza a curvarse, como rodaría
    for (let i = 0; i < guideLen + rollLen; i++) {
      gx += vx * 1.6; gy += vy * 1.6 * 0.5;
      if (i >= guideLen) {
        const px = -vy, py = vx;
        vx += px * M.spin * 0.4; vy += py * M.spin * 0.4;
        const n = Math.sqrt(vx * vx + vy * vy); vx /= n; vy /= n;
      }
      if (gx > 0 && gx < CW && gy > 0 && gy < CH && i % 2 === 0) {
        const h = i < guideLen ? Math.sin(Math.PI * (i / guideLen)) * loftAmt : 0;
        const dot = h > 0.55 ? '●' : h > 0.25 ? 'o' : '·';
        const col = i < guideLen ? (h > 0.55 ? '#8ff08f' : '#6fae6f') : '#6fa0ae';
        screen.put(COURT_X + gx, COURT_Y + gy, dot, col);
      }
    }
    screen.put(COURT_X + THROW_X - 2, COURT_Y + CH / 2 - 1, '☺', '#4fc3f7');
    screen.put(COURT_X + THROW_X - 2, COURT_Y + CH / 2, '/', '#4fc3f7');
    if (M.role === 'tirar') {
      const aBest = M.bestBall('A');
      if (aBest && frame % 16 < 11) {
        screen.put(COURT_X + aBest.b.x - 1, COURT_Y + aBest.b.y, '[', '#ff8c5b');
        screen.put(COURT_X + aBest.b.x + 1, COURT_Y + aBest.b.y, ']', '#ff8c5b');
      }
    }
    if (M.role === 'bloquear' && frame % 16 < 11) {
      for (let k = 0.3; k <= 0.85; k += 0.18) {
        const bxp = THROW_X + (M.jack.x - THROW_X) * k;
        const byp = CH / 2 + (M.jack.y - CH / 2) * k;
        screen.put(COURT_X + bxp, COURT_Y + byp, '┊', '#c8a0e8');
      }
    }
    if (M.phase === 'power') {
      const v = 14 + M.power * prof.maxPow;
      const carry = (v * v * Math.sin(2 * M.loft)) / GRAV;
      const lx = THROW_X + Math.cos(M.aimAngle) * carry;
      const ly = CH / 2 + Math.sin(M.aimAngle) * carry * 0.5;
      if (lx > 0 && lx < CW && ly > 0 && ly < CH && frame % 14 < 9) screen.put(COURT_X + lx, COURT_Y + ly, '✕', '#3d3520');
    }
  }

  _drawBalls(M) {
    const { screen, frame } = this.game;
    const rainFog = isRainy(M.weather.type) || M.weather.type === 'NIEBLA' || M.weather.type === 'TORMENTA';
    const s = M.roster.get(M.abuelo);
    const immuneFog = s.hasImmunity(isRainy(M.weather.type) || M.weather.type === 'TORMENTA' ? 'LLUVIA' : M.weather.type);
    const fogFrom = immuneFog ? 999
      : M.weather.type === 'NIEBLA' ? 32
      : M.weather.type === 'TORMENTA' ? 40
      : ABUELO_DATA[M.abuelo].clima.LLUVIA === -1 ? 45 : 70;
    const visible = (b) => {
      if (M.weather.type === 'NIEBLA' && b === M.jack && !M.jackRevealed && !immuneFog) return frame % 24 < 2;
      if (!rainFog || b.x < fogFrom || (b === M.lastThrown && b.moving)) return true;
      return frame % 8 < 3;
    };

    if (M.training === 'ARRIME') {
      for (let dy = -5; dy <= 5; dy++) {
        for (let dx = -10; dx <= 10; dx++) {
          const gx = M.jack.x + dx, gy = M.jack.y + dy;
          if (gx < 1 || gx > CW - 1 || gy < 1 || gy > CH - 1) continue;
          const d = dist2d(gx, gy, M.jack.x, M.jack.y);
          for (const rr of [3, 6, 9]) {
            if (Math.abs(d - rr) < 0.55) screen.put(COURT_X + gx, COURT_Y + gy, '·', rr === 3 ? '#e8c832' : rr === 6 ? '#b09a50' : '#847a41');
          }
        }
      }
    }
    if (M.training === 'TIRO') {
      for (const b of M.balls) if (b.owner === 'T') screen.put(COURT_X + b.ox, COURT_Y + b.oy, '+', '#6a6a5a');
    }
    if (M.training !== 'TIRO' && visible(M.jack)) screen.put(COURT_X + M.jack.x, COURT_Y + M.jack.y, '☼', '#ffe14d');
    if (M.twinJacks && M.jack2 && visible(M.jack2)) screen.put(COURT_X + M.jack2.x, COURT_Y + M.jack2.y, '☀', '#ff9c5b');

    for (const b of M.balls) {
      if (!visible(b)) continue;
      const col = b.owner === 'P' ? '#4fc3f7' : b.owner === 'T' ? '#c9c2a8' : '#ef7676';
      const z = b.z || 0;
      if (z > 0.4) {
        screen.put(COURT_X + b.x, COURT_Y + b.y, z > 5 ? '▒' : '●', '#5c5230');
        const lift = Math.min(z * 0.18, Math.max(1, b.y - 2));
        const bxx = COURT_X + b.x, byy = COURT_Y + b.y - lift;
        if (z > 9) {
          screen.put(bxx - 1, byy - 1, '▗', col); screen.put(bxx, byy - 1, '█', col);
          screen.put(bxx + 1, byy - 1, '█', col); screen.put(bxx + 2, byy - 1, '▖', col);
          screen.put(bxx - 1, byy, '▝', col); screen.put(bxx, byy, '█', col);
          screen.put(bxx + 1, byy, '█', col); screen.put(bxx + 2, byy, '▘', col);
        } else if (z > 4) {
          screen.put(bxx, byy - 1, '▄', col); screen.put(bxx + 1, byy - 1, '▄', col);
          screen.put(bxx, byy, '▀', col); screen.put(bxx + 1, byy, '▀', col);
        } else if (z > 1.5) screen.put(bxx, byy, '●', col);
        else screen.put(bxx, byy, 'o', col);
      } else {
        screen.put(COURT_X + b.x, COURT_Y + b.y, b.moving ? '◉' : '●', col);
      }
    }
    const p = M.bestBall('P'), a = M.bestBall('A');
    if (p && a && !M.anyMoving() && M.balls.length >= 2) {
      const lead = p.d < a.d ? p.b : a.b;
      if (frame % 20 < 12 && visible(lead)) screen.put(COURT_X + lead.x, COURT_Y + lead.y - 1, '▾', '#ffe680');
    }
  }

  _drawWeatherFx(M) {
    const { screen } = this.game;
    for (const pt of M.weather.particles) {
      if (isRainy(M.weather.type)) screen.put(COURT_X + pt.x, COURT_Y + pt.y, '/', pt.s > 1 ? '#7fc4e8' : '#5590b0');
      else if (M.weather.type === 'CALOR') screen.put(COURT_X + pt.x, COURT_Y + pt.y, '~', '#e8cf7a');
      else if (M.weather.type === 'NIEBLA') screen.put(COURT_X + pt.x, COURT_Y + pt.y, pt.s > 1 ? '▒' : '░', '#9aa4a4');
      else if (M.weather.type === 'HELADA') screen.put(COURT_X + pt.x, COURT_Y + pt.y, '❋', '#dff0fa');
      else screen.put(COURT_X + pt.x, COURT_Y + pt.y, pt.s > 1 ? '-' : '∙', '#cfc9a0');
    }
    for (const s of M.weather.splats) {
      const fresh = s.ttl > 90;
      const col = fresh ? '#8fd0ea' : s.ttl > 40 ? '#5e93ad' : '#3d5f72';
      screen.put(COURT_X + s.x, COURT_Y + s.y, fresh ? '◉' : '●', col);
      if (s.big) {
        screen.put(COURT_X + s.x - 1, COURT_Y + s.y, '∘', col);
        screen.put(COURT_X + s.x + 1, COURT_Y + s.y, '∘', col);
        screen.put(COURT_X + s.x, COURT_Y + s.y - 1, fresh ? '∘' : '·', col);
      }
    }
  }

  _drawPanel(M) {
    const { screen, frame, faces } = this.game;
    const py = COURT_Y + CH + 2;
    screen.box(2, py, screen.cols - 4, screen.rows - py - 1, '#8a7f66');
    if (M.phase === 'placeJack') {
      const jp = M.jackPlace;
      if (jp.step === 'distance') {
        screen.text(5, py + 1, 'EL BOLICHE ES TUYO — [↑/↓] elegir distancia   [ENTER] confirmar', '#ffe680');
        const labels = [['CORTA', 'favorece el arrime'], ['MEDIA', 'terreno neutral'], ['LARGA', 'favorece el brazo']];
        labels.forEach((l, i) => {
          const sel = i === jp.distCursor;
          screen.text(6 + i * 30, py + 2, `${sel ? '▶' : ' '} ${l[0]} — ${l[1]}`, sel ? '#ffe14d' : '#c9c2a8');
        });
      } else {
        screen.text(5, py + 1, 'EL BOLICHE ES TUYO — [↑/↓] elegir banda   [ENTER] confirmar   [ESC] volver', '#ffe680');
        const labels = ['ARRIBA', 'CENTRO', 'ABAJO'];
        labels.forEach((l, i) => {
          const sel = i === jp.bandCursor;
          screen.text(6 + i * 20, py + 2, `${sel ? '▶' : ' '} ${l}`, sel ? '#ffe14d' : '#c9c2a8');
        });
      }
    } else if (M.phase === 'aim') {
      screen.text(5, py + 1, 'PUNTERÍA  [↑/↓] ajustar ángulo   [R] cambiar rol   [ENTER] confirmar', '#e8e0c8');
      const deg = (-M.aimAngle * 57.3).toFixed(1);
      const roleTxt = M.role === 'tirar' ? 'TIRAR (más fuerza, más riesgo)'
        : M.role === 'bloquear' ? 'BLOQUEAR (corto y preciso, estorba al rival)'
        : 'APUNTAR (más fino, menos alcance)';
      const roleCol = M.role === 'tirar' ? '#ff8c5b' : M.role === 'bloquear' ? '#c8a0e8' : '#88e088';
      screen.text(5, py + 2, `ángulo: ${deg}°     rol: ${roleTxt}`, roleCol);
    } else if (M.phase === 'spin') {
      screen.text(5, py + 1, 'EFECTO    [←/→] curvar la bola   [ENTER] confirmar   [ESC] volver', '#e8e0c8');
      let bar = '';
      for (let i = 0; i < 41; i++) bar += i === 20 + Math.round(M.spin * 20) ? '◆' : i === 20 ? '┼' : '─';
      screen.text(5, py + 2, 'IZQ ' + bar + ' DER', '#d8a4e8');
    } else if (M.phase === 'loft') {
      screen.text(5, py + 1, 'ELEVACIÓN [↑/↓] altura del lanzamiento   [ENTER] confirmar   [ESC] volver', '#e8e0c8');
      const deg = M.loft * 57.3;
      const steps = '▁▂▃▄▅▆▇█';
      const idx = clamp(Math.round(((M.loft - 0.17) / (1.05 - 0.17)) * 7), 0, 7);
      let bar = '';
      for (let i = 0; i <= 7; i++) bar += i === idx ? steps[i] : i < idx ? steps[i] : '·';
      screen.text(5, py + 2, `rasa ${bar} bombeada   ${deg.toFixed(0)}°  ${deg < 20 ? '(tiro tenso, para tirar bolas)' : deg > 45 ? '(globo, cae muerta)' : '(media altura)'}`, '#9fd8e8');
    } else if (M.phase === 'power') {
      const inSweet = M.sweetSpot !== null && Math.abs(M.power - M.sweetSpot) < M.sweetWidth;
      screen.text(5, py + 1, `POTENCIA  [ENTER/ESPACIO] ¡lanzar!   [ESC] volver${M.sweetSpot !== null ? '   ◆ busca el punto dulce dorado' : ''}`, inSweet ? '#ffe14d' : '#e8e0c8');
      const w = 60;
      const fill = Math.round(M.power * w);
      let bar = '';
      for (let i = 0; i < w; i++) {
        if (M.sweetSpot !== null && Math.abs(i / w - M.sweetSpot) < M.sweetWidth) bar += '◆';
        else bar += i < fill ? '█' : '░';
      }
      const pcol = inSweet ? '#ffe14d' : M.power < 0.4 ? '#7ec850' : M.power < 0.75 ? '#ffe14d' : '#ff5c5c';
      screen.text(5, py + 2, '[', '#e8e0c8');
      screen.text(6, py + 2, bar, pcol);
      screen.text(6 + w, py + 2, `] ${(M.power * 100).toFixed(0)}%${inSweet ? '  ¡DENTRO!' : ''}`, inSweet ? '#ffe14d' : '#e8e0c8');
    } else if (M.phase === 'throwDone') {
      if (!M.training && !M.lastWasFault && M.lastThrown && M.lastThrown.owner === 'P' && M.tournament && M.tournament.timeouts > 0 && !M.timeoutUsedThisThrow) {
        screen.text(5, py + 1, `¿Mal tiro? [X] pedir TIEMPO MUERTO y repetirlo (te queda ${M.tournament.timeouts})`, frame % 20 < 14 ? '#ffcf4d' : '#a08050');
      }
    } else if (M.phase === 'measuring') {
      const mb = M.measureBalls;
      screen.text(5, py + 1, `El juez saca la cinta: azul ${mb.pd.toFixed(2)}  vs  rojo ${mb.ad.toFixed(2)} — diferencia de ${Math.abs(mb.pd - mb.ad).toFixed(2)}`, '#ffe14d');
    } else if (M.phase === 'sim') {
      screen.text(5, py + 1, 'La bola vuela...', '#c9b98a');
    } else if (M.phase === 'aiTurn') {
      screen.text(5, py + 1, `${M.rival} escupe en la bola, mira al cielo y se concentra...`, '#ef9f9f');
    } else if (M.phase === 'roundStart') {
      screen.text(5, py + 1, M.twinJacks
        ? `MANO ${M.round} — ¡DOBLE BOLICHE! El primer tiro decide cuál cuenta. [ENTER] empezar`
        : `MANO ${M.round} — el boliche está colocado. [ENTER] para empezar`, '#ffe680');
    } else if (M.phase === 'roundEnd') {
      const who = M.lastWinner === 'P' ? '¡PUNTO PARA TI!' : M.lastWinner === 'A' ? `Punto para ${M.rival}` : 'Mano nula';
      screen.text(5, py + 1, `${who}  +${M.lastPoints} punto(s)   [ENTER] siguiente mano`, M.lastWinner === 'P' ? '#7CFC00' : '#ef7676');
    } else if (M.phase === 'matchEnd') {
      const won = M.scoreP >= M.target;
      screen.text(5, py + 1, won
        ? `¡VICTORIA DE LA JORNADA ANTE ${M.rival}!`
        : `Derrota de la jornada... ${M.rival} sonríe con su boina.`,
        won ? '#7CFC00' : '#ff5c5c');
      screen.text(85, py + 1, '[ENTER] continuar', '#c9c2a8');
    } else if (M.phase === 'trainEnd') {
      const statName = M.training === 'ARRIME' ? 'PULSO' : 'BRAZO';
      screen.text(5, py + 1, M.success
        ? `¡ENTRENAMIENTO SUPERADO! +${M._trainBonus} ${statName} para ${this.game.displayName(M.abuelo)}.`
        : 'No ha podido ser. Mañana más, que el cuerpo ya no es el que era.',
        M.success ? '#7CFC00' : '#ff8c5b');
      screen.text(85, py + 1, '[ENTER] volver a la peña', '#c9c2a8');
    }
    if (M.narr) screen.text(5, py + 3, '» ' + M.narr, '#b8a878');
  }
}

function windArrow(x, y) {
  const a = Math.atan2(y, x);
  const dirs = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'];
  return dirs[Math.round(((a + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8];
}
