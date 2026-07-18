import { hashStr, mulberry32 } from '../core/utils.js';
import { SKIN_TONES, HAIR_COLORS, HEADS, HAIR_STYLES, HEADWEAR, FACIAL_HAIR, GLASSES } from './PortraitParts.js';

// Genera un retrato ASCII pequeño y determinista a partir de una semilla
// (mismo jugador -> siempre la misma cara). No cura fotos reales como los
// abuelos protagonistas: combina piezas para dar variedad a escala (decenas
// de jugadores IA por liga).
export class PortraitGenerator {
  static generate(seed) {
    const rng = mulberry32(hashStr(String(seed)));
    const pick = (arr) => arr[Math.floor(rng() * arr.length)];
    const pickKey = (obj) => { const ks = Object.keys(obj); return obj[pick(ks)]; };

    const skin = pick(SKIN_TONES);
    const hairColor = pick(HAIR_COLORS);
    const head = pick(HEADS);
    const hair = pick(HAIR_STYLES);
    const headwear = pickKey(HEADWEAR);
    const facial = pickKey(FACIAL_HAIR);
    const glasses = rng() < 0.3 ? pickKey(GLASSES) : null;

    const layers = [[skin, head]];
    if (hair && !headwear) layers.push([hairColor, hair]);
    if (headwear) layers.push([pick(['#5a4a3a', '#3a5a7a', '#7a3a3a', '#4a4a4a']), headwear]);
    if (facial) layers.push([hairColor, facial]);
    if (glasses) layers.push(['#2a2a2a', glasses]);

    return { layers };
  }
}
