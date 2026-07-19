import { hashStr } from '../core/utils.js';

// Estilos de juego del capitán rival: determinista por nombre de club (mismo
// truco que rivalPersonalityFor en rivalPersonality.js), para que cada club
// tenga siempre el mismo estilo sin tener que guardar nada nuevo en el
// mundo de ligas. Ver match/AIPlayer.js para el efecto real en pista.
export const RIVAL_ARCHETYPES = [
  { id: 'arrimador', label: 'Arrimador fino',
    desc: 'Casi nunca dispara: vive del arrime milimétrico. Prefiere el boliche corto.' },
  { id: 'tirador', label: 'Tirador agresivo',
    desc: 'Dispara desde donde haga falta con tal de romper la mano. Prefiere el boliche largo.' },
  { id: 'muro', label: 'Muro',
    desc: 'Cuando manda la mano, se dedica a bloquear el camino al boliche. Juega a media distancia.' },
  { id: 'templado', label: 'Veterano frío',
    desc: 'No se pone nervioso ni yendo por detrás en el marcador.' },
];

export function archetypeFor(clubName) {
  const idx = Math.abs(hashStr(`archetype-${clubName}`)) % RIVAL_ARCHETYPES.length;
  return RIVAL_ARCHETYPES[idx];
}
