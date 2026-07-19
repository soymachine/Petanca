export const CW = 132;      // ancho del terreno en celdas
export const CH = 22;       // alto del terreno en celdas
export const COURT_X = 4;   // offset de dibujo
export const COURT_Y = 15;
export const BALL_R = 0.9;
export const JACK_R = 0.55;
export const FRICTION = 22; // fricción base de rodadura
export const GRAV = 26;
export const THROW_X = 7;
export const TARGET = 13;   // partida a 13 puntos, como la petanca real

// petanca real: en tripletas cada jugador lanza 2 bolas (6 por bando); en
// individual y dobletes, 3 bolas por jugador
export function ballsPerPlayer(teamSize) { return teamSize >= 3 ? 2 : 3; }
