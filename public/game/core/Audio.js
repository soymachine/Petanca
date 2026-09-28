import { Settings } from './Settings.js';

// Sonido sintetizado con WebAudio (docs/REDISENO.md, Fase 5): ni un solo
// archivo de audio, todo se genera al vuelo — choque metálico de bolas,
// bola cayendo en el albero, clic de interfaz, campanita de punto,
// fanfarria de victoria y lamento de derrota. El navegador no deja sonar
// nada hasta el primer gesto del jugador, así que el contexto se crea (o se
// reanuda) en el primer pointerdown/keydown. Volumen y silencio, en
// AJUSTES (core/Settings.js: sound, volume). Sin WebAudio (tests en Node),
// todo es un no-op.

let ctx = null;
let master = null;
let noiseBuf = null;

function ensure() {
  if (ctx) return ctx;
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  try {
    ctx = new AC();
    master = ctx.createGain();
    master.connect(ctx.destination);
    // ruido blanco de 1 s, reutilizado por todos los sonidos "sucios"
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch { ctx = null; }
  return ctx;
}

function ready() {
  if (!Settings.get('sound')) return null;
  const c = ensure();
  if (!c || c.state !== 'running') return null;
  master.gain.value = Math.max(0, Math.min(1, Settings.get('volume') ?? 0.5));
  return c;
}

// tono con envolvente de ataque/caída
function tone(c, { type = 'sine', f = 440, f2 = null, t = 0, dur = 0.15, vol = 0.3, attack = 0.005 }) {
  const o = c.createOscillator(), g = c.createGain();
  const t0 = c.currentTime + t;
  o.type = type; o.frequency.setValueAtTime(f, t0);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(master);
  o.start(t0); o.stop(t0 + dur + 0.02);
}

// ráfaga de ruido filtrado
function noise(c, { t = 0, dur = 0.12, vol = 0.3, type = 'lowpass', freq = 800, q = 0.8 }) {
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  const t0 = c.currentTime + t;
  s.buffer = noiseBuf;
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(f); f.connect(g); g.connect(master);
  s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.02);
}

const SOUNDS = {
  // UI
  click: (c) => tone(c, { type: 'square', f: 880, f2: 660, dur: 0.05, vol: 0.06 }),
  // bola de acero contra bola de acero: dos parciales inarmónicos muy cortos + chasquido
  clack: (c, k = 1) => {
    noise(c, { dur: 0.03, vol: 0.35 * k, type: 'highpass', freq: 3000 });
    tone(c, { type: 'sine', f: 2350, dur: 0.18, vol: 0.22 * k });
    tone(c, { type: 'sine', f: 3710, dur: 0.12, vol: 0.12 * k });
    tone(c, { type: 'triangle', f: 1180, dur: 0.1, vol: 0.1 * k });
  },
  // caída en albero: golpe sordo + crujido de grava
  thud: (c, k = 1) => {
    tone(c, { type: 'sine', f: 120, f2: 55, dur: 0.16, vol: 0.4 * k });
    noise(c, { dur: 0.22, vol: 0.22 * k, type: 'bandpass', freq: 900, q: 0.6 });
  },
  // boliche: más ligero y agudo
  tick: (c) => { tone(c, { type: 'sine', f: 520, f2: 300, dur: 0.08, vol: 0.2 }); noise(c, { dur: 0.08, vol: 0.1, type: 'bandpass', freq: 1500 }); },
  // tiro soltado en el punto dulce
  sweet: (c) => { tone(c, { type: 'triangle', f: 988, dur: 0.12, vol: 0.12 }); tone(c, { type: 'triangle', f: 1319, t: 0.06, dur: 0.18, vol: 0.12 }); },
  // punto para ti / para el rival
  point: (c) => [784, 988, 1175].forEach((f, i) => tone(c, { type: 'square', f, t: i * 0.07, dur: 0.14, vol: 0.07 })),
  pointRival: (c) => [392, 330].forEach((f, i) => tone(c, { type: 'square', f, t: i * 0.1, dur: 0.18, vol: 0.06 })),
  // fanfarria de victoria (arpegio + acorde) y lamento de derrota
  win: (c) => {
    [523, 659, 784, 1047].forEach((f, i) => tone(c, { type: 'square', f, t: i * 0.09, dur: 0.16, vol: 0.08 }));
    [523, 659, 784].forEach((f) => tone(c, { type: 'triangle', f, t: 0.4, dur: 0.7, vol: 0.09 }));
  },
  lose: (c) => [392, 349, 311, 262].forEach((f, i) => tone(c, { type: 'triangle', f, t: i * 0.16, dur: 0.3, vol: 0.1 })),
};

export const Audio = {
  // engancha el desbloqueo al primer gesto (una sola vez)
  init() {
    if (typeof window === 'undefined' || this._inited) return;
    this._inited = true;
    const unlock = () => { const c = ensure(); if (c && c.state === 'suspended') c.resume(); };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  },
  play(name, k) {
    const c = ready();
    if (!c || !SOUNDS[name]) return;
    try { SOUNDS[name](c, k); } catch { /* un sonido nunca rompe el juego */ }
  },
};
