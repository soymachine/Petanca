// Los 5 minijuegos de entrenamiento, uno por stat — antes solo ARRIME
// (pulso) y TIRO (brazo) tenían minijuego; maña, temple y aguante solo
// subían con puntos de nivel o herencia. Fuente única de verdad para
// Match.js (motor), MatchScreen.js (dibujado) y AgendaScreen.js/
// ClubScreen.js (selector), así que un solo sitio sabe cuántas bolas
// lleva cada uno y qué hace falta para superarlo.
//
// `target`: puntos a acumular con la fórmula de arrime (10-distancia por
// bola) para el resto de drills, o derribos necesarios para TIRO
// (`hits` en vez de puntos, ver Match.js).
export const TRAINING_DRILLS = [
  { id: 'ARRIME', stat: 'pulso', label: 'ARRIME', balls: 3, target: 16,
    desc: 'ARRIME: suma 16 puntos acercándote a la diana con 3 bolas.' },
  { id: 'TIRO', stat: 'brazo', label: 'TIRO', balls: 4, target: 3, hits: true,
    desc: 'TIRO: derriba las 3 bolas viejas en 4 lanzamientos.' },
  { id: 'EFECTO', stat: 'mana', label: 'EFECTO', balls: 3, target: 16,
    desc: 'EFECTO: rodea la bola que bloquea la línea recta y suma 16 puntos con 3 bolas.' },
  { id: 'PRESION', stat: 'temple', label: 'PRESIÓN', balls: 4, target: 18,
    desc: 'PRESIÓN: suma 18 puntos con el pulso cada vez más apretado por los nervios.' },
  { id: 'FONDO', stat: 'aguante', label: 'FONDO', balls: 8, target: 40,
    desc: 'FONDO: mantén el nivel en 8 tiradas seguidas, sin descanso entre ellas.' },
];

export function drillFor(id) { return TRAINING_DRILLS.find((d) => d.id === id) || null; }
