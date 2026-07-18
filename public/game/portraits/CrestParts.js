// Piezas para escudos de club procedurales (ver CrestGenerator.js).
// Cada "forma" es una silueta fija (13x13 en SHAPES, 8x11 en MINI_SHAPES):
// 'X' = celda rellena, ' ' = fuera de la forma. El generador combina esa
// silueta con un degradado de color y un emblema para dar variedad, igual
// que PortraitParts.js hace con caras. SHAPES y MINI_SHAPES van en el
// MISMO orden (mismo índice = misma silueta a las dos escalas), para que
// un mismo club se vea "igual de familia" tanto en el escudo grande como
// en el mini. Variedad a propósito más allá del escudo heráldico clásico:
// círculo, diamante, cuadrado, banderín, estrella, hexágono y cruz.

export const SHAPES = [
  [ // escudo
    '   XXXXXXX   ',
    '  XXXXXXXXX  ',
    ' XXXXXXXXXXX ',
    'XXXXXXXXXXXXX',
    'XXXXXXXXXXXXX',
    'XXXXXXXXXXXXX',
    ' XXXXXXXXXXX ',
    ' XXXXXXXXXXX ',
    '  XXXXXXXXX  ',
    '  XXXXXXXXX  ',
    '   XXXXXXX   ',
    '    XXXXX    ',
    '      X      ',
  ],
  [ // círculo
    '     XXX     ',
    '   XXXXXXX   ',
    '  XXXXXXXXX  ',
    ' XXXXXXXXXXX ',
    'XXXXXXXXXXXXX',
    'XXXXXXXXXXXXX',
    'XXXXXXXXXXXXX',
    'XXXXXXXXXXXXX',
    'XXXXXXXXXXXXX',
    ' XXXXXXXXXXX ',
    '  XXXXXXXXX  ',
    '   XXXXXXX   ',
    '     XXX     ',
  ],
  [ // diamante
    '      X      ',
    '     XXX     ',
    '    XXXXX    ',
    '   XXXXXXX   ',
    '  XXXXXXXXX  ',
    ' XXXXXXXXXXX ',
    'XXXXXXXXXXXXX',
    ' XXXXXXXXXXX ',
    '  XXXXXXXXX  ',
    '   XXXXXXX   ',
    '    XXXXX    ',
    '     XXX     ',
    '      X      ',
  ],
  [ // cuadrado redondeado
    '  XXXXXXXXX  ',
    ' XXXXXXXXXXX ',
    'XXXXXXXXXXXXX',
    'XXXXXXXXXXXXX',
    'XXXXXXXXXXXXX',
    'XXXXXXXXXXXXX',
    'XXXXXXXXXXXXX',
    'XXXXXXXXXXXXX',
    'XXXXXXXXXXXXX',
    'XXXXXXXXXXXXX',
    'XXXXXXXXXXXXX',
    ' XXXXXXXXXXX ',
    '  XXXXXXXXX  ',
  ],
  [ // banderín (con muesca de golondrina)
    ' XXXXXXXXXXX ',
    'XXXXXXXXXXXXX',
    'XXXXXXXXXXXXX',
    'XXXXXXXXXXXXX',
    'XXXXXXXXXXXXX',
    'XXXXXXXXXXXXX',
    'XXXXXXXXXXXXX',
    'XXXXXXXXXXXXX',
    'XXXXX   XXXXX',
    'XXXX     XXXX',
    'XXX       XXX',
    'XX         XX',
    'X           X',
  ],
  [ // estrella de 4 puntas (a lo brújula)
    '      X      ',
    '     XXX     ',
    '    XXXXX    ',
    '   XXXXXXX   ',
    'X  XXXXXXX  X',
    'XX XXXXXXX XX',
    'XXXXXXXXXXXXX',
    'XX XXXXXXX XX',
    'X  XXXXXXX  X',
    '   XXXXXXX   ',
    '    XXXXX    ',
    '     XXX     ',
    '      X      ',
  ],
  [ // hexágono (lados rectos largos, a diferencia del círculo)
    '   XXXXXXX   ',
    '  XXXXXXXXX  ',
    ' XXXXXXXXXXX ',
    'XXXXXXXXXXXXX',
    'XXXXXXXXXXXXX',
    'XXXXXXXXXXXXX',
    'XXXXXXXXXXXXX',
    'XXXXXXXXXXXXX',
    'XXXXXXXXXXXXX',
    'XXXXXXXXXXXXX',
    ' XXXXXXXXXXX ',
    '  XXXXXXXXX  ',
    '   XXXXXXX   ',
  ],
  [ // cruz
    '    XXXXX    ',
    '    XXXXX    ',
    '    XXXXX    ',
    '    XXXXX    ',
    'XXXXXXXXXXXXX',
    'XXXXXXXXXXXXX',
    'XXXXXXXXXXXXX',
    'XXXXXXXXXXXXX',
    'XXXXXXXXXXXXX',
    '    XXXXX    ',
    '    XXXXX    ',
    '    XXXXX    ',
    '    XXXXX    ',
  ],
];

// versión compacta (5x9) de las mismas 8 formas, mismo orden, para sitios
// sin espacio para el escudo grande (p.ej. la cabecera de Mi Peña: la fila
// 8 ya la usa el texto de ayuda de cada sección — screen.textCenter(8,
// ...) — así que el mini no puede pasar de 5 filas o se lo comería)
export const MINI_SHAPES = [
  [ // escudo
    ' XXXXXXX ',
    'XXXXXXXXX',
    'XXXXXXXXX',
    ' XXXXXXX ',
    '    X    ',
  ],
  [ // círculo
    '  XXXXX  ',
    'XXXXXXXXX',
    'XXXXXXXXX',
    'XXXXXXXXX',
    '  XXXXX  ',
  ],
  [ // diamante
    '    X    ',
    '  XXXXX  ',
    'XXXXXXXXX',
    '  XXXXX  ',
    '    X    ',
  ],
  [ // cuadrado redondeado
    ' XXXXXXX ',
    'XXXXXXXXX',
    'XXXXXXXXX',
    'XXXXXXXXX',
    ' XXXXXXX ',
  ],
  [ // banderín
    'XXXXXXXXX',
    'XXXXXXXXX',
    'XXXX XXXX',
    'XXX   XXX',
    'XX     XX',
  ],
  [ // estrella
    '    X    ',
    '  XXXXX  ',
    'X XXXXX X',
    '  XXXXX  ',
    '    X    ',
  ],
  [ // hexágono
    '   XXX   ',
    'XXXXXXXXX',
    'XXXXXXXXX',
    'XXXXXXXXX',
    '   XXX   ',
  ],
  [ // cruz
    '    X    ',
    'XXXXXXXXX',
    'XXXXXXXXX',
    'XXXXXXXXX',
    '    X    ',
  ],
];

// colores base del escudo: saturados y distinguibles a simple vista, en la
// línea del resto de la paleta del juego (nada de tonos pastel que se
// pierdan en el fondo oscuro del tablero). Se combinan de 2 en 2 como los
// extremos de un degradado (ver CrestGenerator), así que conviene variedad
// de tono Y de luminosidad entre ellos.
export const CREST_COLORS = [
  '#b83a3a', '#3a5fb8', '#3a8a4a', '#c9a13a', '#7a3ab8', '#3a8a8a',
  '#b83a7a', '#5a4530', '#2a2a2a', '#c9c9c9', '#b8703a', '#3a3a6a',
  '#e8b83a', '#5a9fd8', '#d8664a', '#4ad89a',
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
