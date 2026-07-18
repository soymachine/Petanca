// Iconos de los amuletos: ASCII generado a partir de una foto real, con el
// MISMO pipeline (foto → cuadrícula de caracteres + paleta de color) y la
// misma herramienta que los retratos de jugadores — ver
// tools/portrait-generator.html, pool "Amuletos". Cada amuleto tiene un id
// fijo (petaca/panuelo/reloj/guantes/botas) y una única entrada: subir una
// foto nueva para un id SUSTITUYE su icono actual en vez de añadir uno más
// (a diferencia de los pools de retratos, que sí acumulan entradas).
//
// De fábrica trae una silueta de ejemplo (la que antes se generaba por
// fórmula, ahora convertida a este mismo formato) — sustitúyela por una
// foto real cuando quieras desde la herramienta.
export const ITEM_ART = [{"id": "petaca", "label": "LA PETACA DE LA SUERTE", "photo": {"cols": 11, "rows": 7, "palette": ["#000000", "#c9a35d"], "chars": ["     █     ", "    █▓█    ", "  █▓▓▓▓▓█  ", "  █▓▓▓▓▓█  ", "  █▓▓▓▓▓█  ", "  █▓▓▓▓▓█  ", "  ███████  "], "colorIdx": [[0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0], [0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0], [0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0], [0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0], [0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0], [0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0], [0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0]]}}, {"id": "panuelo", "label": "EL PAÑUELO DE LA ABUELA", "photo": {"cols": 11, "rows": 7, "palette": ["#000000", "#e8433f"], "chars": ["    █▒█    ", "   █▒░▒█   ", "  █▒░▒░▒█  ", "    ╲ ╱    ", "     █     ", "    ╲ ╱    ", "   ╲       "], "colorIdx": [[0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0], [0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0], [0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0], [0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0], [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0], [0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0], [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0]]}}, {"id": "reloj", "label": "EL RELOJ DEL PUEBLO", "photo": {"cols": 11, "rows": 7, "palette": ["#000000", "#8fb0c8"], "chars": ["           ", "     █     ", "   █ ●──   ", "   █   █   ", "     █     ", "           ", "    ▔▔▔    "], "colorIdx": [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0], [0, 0, 0, 1, 0, 1, 1, 1, 0, 0, 0], [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0]]}}, {"id": "guantes", "label": "GUANTES DE CUERO", "photo": {"cols": 11, "rows": 7, "palette": ["#000000", "#8a6a3a"], "chars": ["           ", "   ▄ ▄     ", " ▄ █ █ ▄   ", " █ █ █ █ ▄ ", " █ █ █ █ █ ", "█▓▓▓▓▓▓▓▓▓█", "███████████"], "colorIdx": [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0], [0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 0], [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0], [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0], [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]]}}, {"id": "botas", "label": "LAS BOTAS DE FAENA", "photo": {"cols": 11, "rows": 7, "palette": ["#000000", "#6b5636"], "chars": ["    ███    ", "    █▓█    ", "    █▓█    ", "   █▓▓▓█   ", "  █▓▓▓▓▓█  ", " █▓▓▓▓▓▓▓█ ", " █████████ "], "colorIdx": [[0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0], [0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0], [0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0], [0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0], [0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0], [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0], [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0]]}}];

export function itemArtFor(id) {
  const entry = ITEM_ART.find((e) => e.id === id);
  return entry ? entry.photo : null;
}

export const ITEM_ART_W = 11, ITEM_ART_H = 7;
