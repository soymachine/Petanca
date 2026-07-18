// Piezas ASCII pequeñas para componer retratos procedurales de jugadores IA.
// Cada pieza es un bloque de líneas (formato Screen.block: espacio = transparente).
// Tamaño objetivo: ~16 columnas x 10 filas, para caber en listas de plantilla.

export const SKIN_TONES = ['#e8c9a0', '#d9a877', '#c98d5e', '#a06840', '#7a4a2e'];
export const HAIR_COLORS = ['#3a2a1a', '#6b4a2a', '#8a8a8a', '#d8d8d8', '#2a2a2a'];

export const HEADS = [
  [
    '   .-===-.   ',
    '  /       \\  ',
    ' |  o   o  | ',
    ' |    ^    | ',
    '  \\  ___  /  ',
    '   `-----`   ',
  ],
  [
    '  .-------.  ',
    ' /  o   o  \\ ',
    ' |     >   | ',
    ' \\   ---   / ',
    '  `-------`  ',
  ],
];

export const HAIR_STYLES = [
  null, // calvo
  ['  .-------.  ', ' /         \\ '],
  [' .---------. ', '/  _______  \\'],
];

export const HEADWEAR = {
  none: null,
  boina: ['   ,-~~~-,   ', '  (       )  ', "   '--,--'   "],
  gorra: ['   ______    ', '  /______\\   ', ' |________>  '],
  panuelo: ['  ,/~~~~\\,   ', ' (________)  '],
};

export const FACIAL_HAIR = {
  none: null,
  bigote: ['    ,===,    '],
  barba: ['   \\_____/   '],
  perilla: ['     (|)     '],
};

export const GLASSES = {
  none: null,
  redondas: [' (o)     (o) '],
  cuadradas: [' [_]     [_] '],
};
