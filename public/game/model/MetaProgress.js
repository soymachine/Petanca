// Meta-progresión ENTRE partidas: qué países y qué nivel de ciudad puede
// elegir el jugador al fundar una peña nueva. Vive en una clave de
// localStorage separada de los 3 perfiles de partida (ver Player.js) —
// nunca se borra al reiniciar una partida ni depende de qué perfil esté
// activo, porque es "lo que ha desbloqueado esta persona jugando", no el
// progreso de una partida en concreto.
import { levelBoundsFor } from '../data/countries.js';

const META_KEY = 'petanka_meta_v1';
const ALL_COUNTRIES = ['ES', 'FR', 'IT', 'BE', 'CH', 'PT'];

function defaults() {
  return {
    countriesUnlocked: ['ES'], // el resto se desbloquea al ganar la primera Copa de Europa (ver Game._finishEuroCupMatch)
    maxLevelByCountry: { ES: 1 }, // techo de nivel ya alcanzado alguna vez en cada país — determina qué ciudades se pueden elegir al fundar
  };
}

export class MetaProgress {
  static load() {
    try {
      const raw = localStorage.getItem(META_KEY);
      if (raw) {
        const json = JSON.parse(raw);
        return { ...defaults(), ...json, maxLevelByCountry: { ...defaults().maxLevelByCountry, ...(json.maxLevelByCountry || {}) } };
      }
    } catch (e) { /* meta corrupta: se parte de cero, no revienta la partida */ }
    return defaults();
  }

  static save(meta) { localStorage.setItem(META_KEY, JSON.stringify(meta)); }

  static isCountryUnlocked(code) { return MetaProgress.load().countriesUnlocked.includes(code); }

  // techo de nivel desbloqueado en un país: 0 si ese país todavía ni se ha
  // desbloqueado como tal (no debería usarse para elegir ciudad, pero es
  // un valor seguro por si acaso)
  static maxLevel(code) { return MetaProgress.load().maxLevelByCountry[code] || 0; }

  // techo real a mostrar en el selector de ciudad: si el país está
  // desbloqueado pero aún no se ha jugado ni una temporada ahí, su propio
  // suelo (1 en España, 6 en un extranjero) siempre debería poder elegirse
  // — nunca "ningún nivel" solo por no haber jugado todavía esa liga
  static maxSelectableLevel(code) {
    const recorded = MetaProgress.maxLevel(code);
    const floor = levelBoundsFor(code).min;
    return Math.max(recorded, floor);
  }

  // se llama cada vez que el jugador alcanza (por ascenso) un nivel de
  // liga nuevo en su país actual — sube el techo persistido si es récord,
  // para que una partida FUTURA pueda arrancar directamente ahí
  static recordLevelReached(code, level) {
    const meta = MetaProgress.load();
    if (!meta.maxLevelByCountry[code] || level > meta.maxLevelByCountry[code]) {
      meta.maxLevelByCountry[code] = level;
      MetaProgress.save(meta);
    }
  }

  // se llama al ganar la primera Copa de Europa: desbloquea los 5 países
  // extranjeros de golpe para futuras partidas. Devuelve true solo la
  // primera vez (para poder disparar el aviso una sola vez), false si ya
  // estaban todos desbloqueados de antes.
  static unlockAllCountries() {
    const meta = MetaProgress.load();
    let changed = false;
    for (const code of ALL_COUNTRIES) {
      if (!meta.countriesUnlocked.includes(code)) { meta.countriesUnlocked.push(code); changed = true; }
      // el suelo de cada país (1 en España, 6 en uno extranjero — nunca 1
      // a secas, esos países no tienen ciudad de nivel 1) siempre debería
      // poder elegirse en cuanto se desbloquea, aunque no se haya jugado
      // ni una temporada ahí todavía
      if (!meta.maxLevelByCountry[code]) meta.maxLevelByCountry[code] = levelBoundsFor(code).min;
    }
    if (changed) MetaProgress.save(meta);
    return changed;
  }
}
