import { SCOUT_PHOTOS } from './scoutPhotos.js';

// Retratos de los ojeadores: fotografías históricas reales de dominio
// público (Wikimedia Commons, retratos de caballeros anónimos de época),
// tratadas en sepia y convertidas a ASCII con el mismo formato "photoArt"
// (cols/rows/palette/chars/colorIdx) y el mismo tamaño que las fotos de
// los abuelos — no son procedurales.
export function generateScoutPortrait(templateId) {
  return SCOUT_PHOTOS[templateId] || SCOUT_PHOTOS.aficionado;
}
