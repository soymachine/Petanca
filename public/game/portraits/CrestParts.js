// Piezas para escudos de club procedurales (ver CrestGenerator.js).
// Cada "forma" es una silueta fija: 'X' = celda rellena, ' ' = fuera de la
// forma. El generador combina esa silueta con un degradado de color y un
// emblema para dar variedad, igual que PortraitParts.js hace con caras.
// SHAPES (13x13, grande) y MINI_SHAPES (5x5, pequeño) van en el MISMO
// orden (mismo índice = misma silueta a las dos escalas), para que un
// mismo club se vea "igual de familia" en las dos versiones. Los dos
// tamaños son SIEMPRE cuadrados (ancho = alto): antes MINI_SHAPES era
// 9x5, un rectángulo achatado que no se parecía a un escudo de verdad;
// ahora cabe en el mismo lienzo cuadrado que el grande, solo que a menor
// resolución. Variedad a propósito más allá del escudo heráldico clásico:
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

// versión pequeña (5x5, CUADRADA — ver comentario de arriba) de las mismas
// 8 formas, mismo orden: cabecera de Mi Peña (filas 3-7, antes del texto
// de ayuda de la fila 8), la tarjeta de "próximo partido" del Hub, y los
// escudos mini del cuadro de la Copa de Europa (ver EuropeanCupScreen).
// A esta resolución algunas siluetas (círculo/hexágono/cuadrado) quedan
// forzosamente parecidas entre sí — el color y el emblema son quienes
// más distinguen un escudo de otro a este tamaño, la silueta es solo un
// apoyo, igual que en un favicon de verdad.
export const MINI_SHAPES = [
  [ // escudo
    ' XXX ',
    'XXXXX',
    'XXXXX',
    ' XXX ',
    '  X  ',
  ],
  [ // círculo
    ' XXX ',
    'XXXXX',
    'XXXXX',
    'XXXXX',
    ' XXX ',
  ],
  [ // diamante
    '  X  ',
    ' XXX ',
    'XXXXX',
    ' XXX ',
    '  X  ',
  ],
  [ // cuadrado
    'XXXXX',
    'XXXXX',
    'XXXXX',
    'XXXXX',
    'XXXXX',
  ],
  [ // banderín (con muesca de golondrina)
    'XXXXX',
    'XXXXX',
    'XXXXX',
    'XX XX',
    'X   X',
  ],
  [ // estrella (puntas asomando por las esquinas)
    'X   X',
    ' XXX ',
    'XXXXX',
    ' XXX ',
    'X   X',
  ],
  [ // hexágono
    ' XXX ',
    'XXXXX',
    'XXXXX',
    'XXXXX',
    ' XXX ',
  ],
  [ // cruz
    ' XXX ',
    ' XXX ',
    'XXXXX',
    ' XXX ',
    ' XXX ',
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
