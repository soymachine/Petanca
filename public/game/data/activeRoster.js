import { ABUELO_DATA } from './abuelos.js';
import { FACES } from './art/faces.js';
import { abueloDataFor, facesFor } from './abuelosByCountry.js';

// España se queda con sus 10 abuelos/retratos de siempre (los arrays
// originales de abuelos.js/faces.js); se guarda una copia ANTES de que
// nada los mute, para poder volver a España tras haber jugado un país
// extranjero (p.ej. al cambiar de perfil).
const BASE_ES_ABUELOS = ABUELO_DATA.map((d) => d);
const BASE_ES_FACES = FACES.map((f) => f);

// ABUELO_DATA y FACES los importan directamente (por su índice de id) media
// docena de archivos — Roster.js, AbueloState.js, Match.js, ThrowProfile.js,
// TransferMarket.js, LineupScreen.js, MatchScreen.js, PenyaScreen.js, y
// Game.js (this.faces = FACES) — todos con `import { ABUELO_DATA } from
// '../data/abuelos.js'` a secas. En vez de convertir esa media docena de
// sitios en "quién soy y de qué país soy" (un cambio enorme y con mucho
// riesgo de dejarse alguno), se aprovecha que un array exportado con
// `const` sigue siendo el MISMO objeto en memoria para todo el que lo
// importe: aquí se vacía y se rellena in-place, así que cualquier import ya
// hecho en otro módulo ve el contenido nuevo sin tocar ni una línea allí.
export function setHomeCountry(country) {
  const abuelos = (!country || country === 'ES') ? BASE_ES_ABUELOS : abueloDataFor(country);
  const faces = (!country || country === 'ES') ? BASE_ES_FACES : facesFor(country);
  ABUELO_DATA.length = 0;
  ABUELO_DATA.push(...abuelos);
  FACES.length = 0;
  FACES.push(...faces);
}
