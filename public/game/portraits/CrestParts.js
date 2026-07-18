// Piezas para escudos de club procedurales (ver CrestGenerator.js).
// El escudo es una silueta fija (SHIELD_MASK, 9x9): 'X' = celda rellena,
// ' ' = fuera del escudo. El generador combina esa silueta con colores y
// un emblema para dar variedad, igual que PortraitParts.js hace con caras.

export const SHIELD_MASK = [
  '  XXXXX  ',
  ' XXXXXXX ',
  'XXXXXXXXX',
  'XXXXXXXXX',
  ' XXXXXXX ',
  ' XXXXXXX ',
  '  XXXXX  ',
  '   XXX   ',
  '    X    ',
];

// colores base del escudo: saturados y distinguibles a simple vista, en la
// línea del resto de la paleta del juego (nada de tonos pastel que se
// pierdan en el fondo oscuro del tablero)
export const CREST_COLORS = [
  '#b83a3a', '#3a5fb8', '#3a8a4a', '#c9a13a', '#7a3ab8', '#3a8a8a',
  '#b83a7a', '#5a4530', '#2a2a2a', '#c9c9c9', '#b8703a', '#3a3a6a',
];

// el emblema siempre en metal (oro/plata) o esmalte neutro (blanco/negro),
// como en heráldica de verdad — así contrasta con cualquier color base
export const CREST_EMBLEM_COLORS = ['#ffe14d', '#fff6dc', '#1a1a1a', '#c9c9c9'];

// una bola de petanca como emblema es la referencia obvia del club, pero
// se deja como una opción más entre otras de corte heráldico clásico para
// que no todos los escudos acaben pareciéndose
export const CREST_EMBLEMS = [
  ['★'],
  ['●'],
  ['♦'],
  ['▲'],
  ['○'],
  [' + ', '+++', ' + '],
  [' █ ', '███', '█ █'],
  ['~~~', ' ~ '],
];
