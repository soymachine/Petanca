// Ajustes visuales del jugador (no forman parte de la partida guardada:
// son del equipo/navegador, no de la peña). Ver docs/REDISENO.md, Fase 1.
const KEY = 'petanka-ajustes';

const DEFAULTS = {
  bloom: true,        // resplandor suave alrededor de lo brillante
  scanlines: true,    // líneas de barrido CRT, muy tenues
  shake: true,        // sacudidas de pantalla en golpes y momentos fuertes
  transitions: true,  // barrido entre pantallas
  reduceMotion: false, // corta sacudidas, transiciones y partículas grandes
  matchView: 'arcade', // 'arcade' (perspectiva, Fase 3) | 'clasica' (cenital de siempre); F7 en partido
  sound: true,         // sonidos sintetizados (core/Audio.js)
  volume: 0.5,
};

function load() {
  try {
    const raw = globalThis.localStorage && globalThis.localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch { return { ...DEFAULTS }; }
}

export const Settings = {
  values: load(),
  get(k) { return this.values[k]; },
  set(k, v) {
    this.values[k] = v;
    try { globalThis.localStorage && globalThis.localStorage.setItem(KEY, JSON.stringify(this.values)); } catch { /* sin almacenamiento */ }
  },
  toggle(k) { this.set(k, !this.values[k]); return this.values[k]; },
  // efectos de movimiento efectivos (reduceMotion los apaga todos)
  motion(k) { return !this.values.reduceMotion && !!this.values[k]; },
};
