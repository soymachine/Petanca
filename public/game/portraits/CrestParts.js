// Piezas para escudos de club procedurales (ver CrestGenerator.js).
// Cada "forma" es una silueta fija (9x9 en SHAPES, 5x7 en MINI_SHAPES):
// 'X' = celda rellena, ' ' = fuera de la forma. El generador combina esa
// silueta con colores y un emblema para dar variedad, igual que
// PortraitParts.js hace con caras. Varias formas (no solo el escudo
// heráldico clásico) para que no todos los clubes lean igual de "medieval".

export const SHAPES = [
  [ // escudo
    '  XXXXX  ',
    ' XXXXXXX ',
    'XXXXXXXXX',
    'XXXXXXXXX',
    ' XXXXXXX ',
    ' XXXXXXX ',
    '  XXXXX  ',
    '   XXX   ',
    '    X    ',
  ],
  [ // círculo
    '  XXXXX  ',
    ' XXXXXXX ',
    'XXXXXXXXX',
    'XXXXXXXXX',
    'XXXXXXXXX',
    'XXXXXXXXX',
    'XXXXXXXXX',
    ' XXXXXXX ',
    '  XXXXX  ',
  ],
  [ // diamante
    '    X    ',
    '   XXX   ',
    '  XXXXX  ',
    ' XXXXXXX ',
    'XXXXXXXXX',
    ' XXXXXXX ',
    '  XXXXX  ',
    '   XXX   ',
    '    X    ',
  ],
  [ // cuadrado redondeado
    ' XXXXXXX ',
    'XXXXXXXXX',
    'XXXXXXXXX',
    'XXXXXXXXX',
    'XXXXXXXXX',
    'XXXXXXXXX',
    'XXXXXXXXX',
    'XXXXXXXXX',
    ' XXXXXXX ',
  ],
  [ // banderín (banda con muesca de golondrina)
    ' XXXXXXX ',
    'XXXXXXXXX',
    'XXXXXXXXX',
    'XXXXXXXXX',
    'XXXXXXXXX',
    'XXXXXXXXX',
    'XXX   XXX',
    'XX     XX',
    'X       X',
  ],
];

// versión compacta (5x7) de las mismas 5 formas, para sitios sin espacio
// para el escudo grande (p.ej. la cabecera de Mi Peña)
export const MINI_SHAPES = [
  [' XXXXX ', 'XXXXXXX', 'XXXXXXX', ' XXXXX ', '  XXX  '], // escudo
  [' XXXXX ', 'XXXXXXX', 'XXXXXXX', 'XXXXXXX', ' XXXXX '], // círculo
  ['   X   ', '  XXX  ', ' XXXXX ', '  XXX  ', '   X   '], // diamante
  ['XXXXXXX', 'XXXXXXX', 'XXXXXXX', 'XXXXXXX', 'XXXXXXX'], // cuadrado
  ['XXXXXXX', 'XXXXXXX', 'XXXXXXX', 'XX   XX', 'X     X'], // banderín
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
