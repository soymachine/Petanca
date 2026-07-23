// Sonidos placeholder generados por código (Web Audio API): no hay archivos
// de audio reales todavía, así que cada efecto es un tono/ruido sintético
// barato de sintetizar en tiempo real. Blindado para Node/headless (sin
// `window`/AudioContext) para no romper los tests que importan módulos del
// juego fuera del navegador.
const CtxClass = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;

let ctx = null;
function getCtx() {
  if (!CtxClass) return null;
  if (!ctx) ctx = new CtxClass();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur, { type = 'sine', gain = 0.15, freqEnd = null } = {}) {
  const ac = getCtx();
  if (!ac) return;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ac.currentTime);
  if (freqEnd !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), ac.currentTime + dur);
  g.gain.setValueAtTime(gain, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
  osc.connect(g); g.connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + dur);
}

function noiseBurst(dur, { gain = 0.12, filterFreq = 1200 } = {}) {
  const ac = getCtx();
  if (!ac) return;
  const size = Math.max(1, Math.floor(ac.sampleRate * dur));
  const buffer = ac.createBuffer(1, size, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < size; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / size);
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filt = ac.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.value = filterFreq;
  const g = ac.createGain();
  g.gain.setValueAtTime(gain, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
  src.connect(filt); filt.connect(g); g.connect(ac.destination);
  src.start();
}

export const Sfx = {
  // arranca/retoma el AudioContext: llamar desde dentro de un gesto de
  // usuario real (mousedown/keydown) para no chocar con el autoplay policy
  unlock() { getCtx(); },
  click() { tone(880, 0.05, { type: 'square', gain: 0.07 }); },
  throwSound() { tone(180, 0.22, { type: 'sawtooth', gain: 0.12, freqEnd: 90 }); },
  collide() { tone(1500, 0.07, { type: 'triangle', gain: 0.14, freqEnd: 600 }); },
  land() { noiseBurst(0.18, { gain: 0.09, filterFreq: 800 }); },
};
