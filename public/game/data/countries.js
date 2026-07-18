// Los países extranjeros del circuito: cada uno tiene 3 ligas de fondo
// (mismo patrón que ya tenía Francia) — el jugador nunca asciende ni
// desciende ahí, solo se simulan semana a semana (Career.js) para tener
// clasificaciones reales de cara a la Copa de Europa. `diff` usa la misma
// escala 6/7/8 en los 5 países, así que sus 3 ligas siempre representan
// "floja / media / fuerte" dentro de su propio país, igual que en España.
//
// `strength` es el multiplicador de nivel que se aplica al generar las
// stats de sus jugadores (ver Club.js): España es la referencia (1.0).
// Orden de fuerza pensado como un vistazo al prestigio real de la petanca
// en cada país: Francia (cuna del deporte) > Italia > Bélgica > Suiza ≈
// España > Portugal.
export const FOREIGN_COUNTRIES = [
  {
    code: 'FR', label: 'Francia', strength: 1.15,
    cities: [
      { name: 'TOULOUSE', lon: 1.44, lat: 43.60, diff: 6, color: '#e8433f',
        clima: { SOL: 4, LLUVIA: 2, VIENTO: 2, CALOR: 4 },
        feature: { id: 'brick', desc: 'La Ville Rose: el ladrillo suelta un polvo fino que frena las bolas.' } },
      { name: 'LYON', lon: 4.83, lat: 45.76, diff: 7, color: '#8fb0c8',
        clima: { SOL: 2, LLUVIA: 4, VIENTO: 2, CALOR: 2, NIEBLA: 4, HELADA: 2 },
        feature: { id: 'fog', desc: 'La niebla del Ródano sube del río sin avisar: aquí se tira a ciegas.' } },
      { name: 'MARSEILLE', lon: 5.37, lat: 43.30, diff: 8, color: '#e8c832',
        clima: { SOL: 6, LLUVIA: 1, VIENTO: 6, CALOR: 4 },
        feature: { id: 'mistral', desc: 'Cuna de la petanca: el mistral baja de golpe y no perdona ni un globo.' } },
    ],
  },
  {
    code: 'IT', label: 'Italia', strength: 1.10,
    cities: [
      { name: 'TORINO', lon: 7.68, lat: 45.07, diff: 6, color: '#6a8fb0',
        clima: { SOL: 3, LLUVIA: 3, VIENTO: 1, CALOR: 2, NIEBLA: 3, HELADA: 3 },
        feature: { id: 'shade', desc: 'Los soportales de piedra dan sombra constante: aquí nunca pega el sol de lleno.' } },
      { name: 'FIRENZE', lon: 11.26, lat: 43.77, diff: 7, color: '#e8c832',
        clima: { SOL: 5, LLUVIA: 2, VIENTO: 1, CALOR: 5 },
        feature: { id: 'heatstone', desc: 'El empedrado renacentista acumula calor todo el día: las bolas llegan que queman.' } },
      { name: 'ROMA', lon: 12.50, lat: 41.90, diff: 8, color: '#e8433f',
        clima: { SOL: 6, LLUVIA: 1, VIENTO: 2, CALOR: 6 },
        feature: { id: 'uneven', desc: 'Adoquines imperiales irregulares: cada tirada es una lotería de bote.' } },
    ],
  },
  {
    code: 'BE', label: 'Bélgica', strength: 1.05,
    cities: [
      { name: 'GENT', lon: 3.72, lat: 51.05, diff: 6, color: '#7ec850',
        clima: { SOL: 1, LLUVIA: 6, VIENTO: 3, CALOR: 1 },
        feature: { id: 'soft', desc: 'Los canales dejan la tierra siempre blanda: las bolas se paran en seco.' } },
      { name: 'LIÈGE', lon: 5.57, lat: 50.63, diff: 7, color: '#8a8a8a',
        clima: { SOL: 2, LLUVIA: 5, VIENTO: 2, CALOR: 2, NIEBLA: 2 },
        feature: { id: 'slope', desc: 'Las cuestas de la ciudad valona hacen rodar todo hacia el Mosa.' } },
      { name: 'BRUXELLES', lon: 4.35, lat: 50.85, diff: 8, color: '#8fb0c8',
        clima: { SOL: 2, LLUVIA: 5, VIENTO: 2, CALOR: 2, NIEBLA: 3 },
        feature: { id: 'drizzle', desc: 'Niebla y llovizna constante de la capital: aquí no hay dos tiradas iguales.' } },
    ],
  },
  {
    code: 'CH', label: 'Suiza', strength: 1.00,
    cities: [
      { name: 'BERN', lon: 7.45, lat: 46.95, diff: 6, color: '#e8433f',
        clima: { SOL: 3, LLUVIA: 2, VIENTO: 1, CALOR: 2, HELADA: 5 },
        feature: { id: 'cold', desc: 'El frío alpino entumece los dedos: la precisión cuesta el doble.' } },
      { name: 'ZÜRICH', lon: 8.54, lat: 47.37, diff: 7, color: '#8fb0c8',
        clima: { SOL: 3, LLUVIA: 3, VIENTO: 5, CALOR: 2 },
        feature: { id: 'fohn', desc: 'El föhn del lago baja sin avisar y desvía cualquier globo.' } },
      { name: 'GENÈVE', lon: 6.14, lat: 46.20, diff: 8, color: '#e8c832',
        clima: { SOL: 4, LLUVIA: 2, VIENTO: 2, CALOR: 2 },
        feature: { id: 'glare', desc: 'El lago Léman refleja el sol y deslumbra justo en la tirada de precisión.' } },
    ],
  },
  {
    code: 'PT', label: 'Portugal', strength: 0.95,
    cities: [
      { name: 'COIMBRA', lon: -8.43, lat: 40.21, diff: 6, color: '#7ec850',
        clima: { SOL: 4, LLUVIA: 2, VIENTO: 1, CALOR: 3 },
        feature: { id: 'uphill', desc: 'Las cuestas empedradas de la ciudad universitaria frenan las bolas cuesta arriba.' } },
      { name: 'PORTO', lon: -8.61, lat: 41.15, diff: 7, color: '#8a8a8a',
        clima: { SOL: 2, LLUVIA: 5, VIENTO: 2, CALOR: 2, NIEBLA: 2 },
        feature: { id: 'heavy', desc: 'La humedad atlántica deja la tierra pesada y las bolas lentas.' } },
      { name: 'LISBOA', lon: -9.14, lat: 38.72, diff: 8, color: '#f2903a',
        clima: { SOL: 5, LLUVIA: 1, VIENTO: 5, CALOR: 4 },
        feature: { id: 'atlantic', desc: 'El viento atlántico de las siete colinas sopla fuerte y cambia de golpe.' } },
    ],
  },
];

export function foreignCountry(code) { return FOREIGN_COUNTRIES.find((c) => c.code === code) || null; }

// España es la referencia (1.0); cualquier código desconocido también cae
// a 1.0 en vez de reventar — más seguro que un país nuevo salga "normal"
// que no que la generación de stats explote
export function strengthFor(code) {
  if (!code || code === 'ES') return 1;
  const c = foreignCountry(code);
  return c ? c.strength : 1;
}

// todas las ciudades extranjeras, aplanadas y sin etiqueta de país — para
// sitios que solo necesitan la lista de ciudades en sí (Geography, sorteo
// de sede de la Copa de Europa), igual que antes hacía FRENCH_CITIES
export function allForeignCities() {
  return FOREIGN_COUNTRIES.flatMap((c) => c.cities);
}

// las mismas ciudades, pero cada una etiquetada con el país al que
// pertenece — para el mapa de ligas, que necesita saber de qué país es
// cada marcador para colorearlo y consultar su ForeignLeagueWorld
export function allForeignCityMarkers() {
  return FOREIGN_COUNTRIES.flatMap((c) => c.cities.map((city) => ({ city, country: c.code })));
}

// etiqueta lista para pegar en un texto: "" si es España (el caso normal,
// no hace falta aclararlo), " (Italia)" etc si no — usado en cualquier
// noticia/tarjeta que mencione un club rival de la Copa de Europa
export function countryTag(code) {
  if (!code || code === 'ES') return '';
  const c = foreignCountry(code);
  return c ? ` (${c.label})` : '';
}
