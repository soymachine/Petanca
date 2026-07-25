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
export const ITEM_ART = [{"id":"petaca","label":"LA PETACA DE LA SUERTE","photo":{"cols":11,"rows":7,"palette":["#b6b6b6","#d0d0b6","#b6b69c","#9c3434","#9c4e4e","#9c6868","#823434","#9c4e34","#82341a","#9c829c","#b68268","#b69c9c"],"chars":["  p  hp    "," xvXnvcxffq"," fncuujjjfp"," fxcxjjjff "," fxnxjjfff ","qljfjjffff ","01tt1fftfLw"],"colorIdx":[[0,0,0,0,0,1,2,0,0,0,0],[0,3,4,5,4,4,4,3,6,6,2],[0,6,4,4,7,7,3,6,6,6,0],[0,6,6,4,6,3,6,6,6,6,0],[0,6,3,7,3,6,6,6,6,6,0],[0,8,6,6,6,6,6,6,6,6,0],[9,8,6,6,8,6,6,6,8,10,11]]}},{"id":"panuelo","label":"EL PAÑUELO DE LA ABUELA","photo":{"cols":11,"rows":7,"palette":["#000000","#e8433f"],"chars":["    █▒█    ","   █▒░▒█   ","  █▒░▒░▒█  ","    ╲ ╱    ","     █     ","    ╲ ╱    ","   ╲       "],"colorIdx":[[0,0,0,0,1,1,1,0,0,0,0],[0,0,0,1,1,1,1,1,0,0,0],[0,0,1,1,1,1,1,1,1,0,0],[0,0,0,0,1,0,1,0,0,0,0],[0,0,0,0,0,1,0,0,0,0,0],[0,0,0,0,1,0,1,0,0,0,0],[0,0,0,1,0,0,0,0,0,0,0]]}},{"id":"reloj","label":"EL RELOJ DEL PUEBLO","photo":{"cols":11,"rows":7,"palette":["#b07060","#703000","#703010","#502010","#100d080","#c0b080","#100f090","#e0d0b0","#f0d080","#100f080","#603000","#b07030","#100e070","#f0e080","#10010080","#100e080","#100f070","#d0a060","#b07040","#e0a050","#705020","#100f060","#10010060","#10010070","#403010","#605040","#e0b050","#b08030","#b09050","#c0a030","#100f050","#100e040","#100b050","#100c050","#a08030","#c0a050","#805020","#100c040","#b08060","#602010"],"chars":["  J(l!l(J  ","l(#q&*&aW(l","J#&&*8##WwU","qjM&8|8&Mjp","J00MWM&M#bU","llhU*m*uhl1","  C(l|l(C  "],"colorIdx":[[0,0,0,1,2,3,2,2,0,0,0],[2,1,4,5,6,7,6,8,9,10,2],[11,12,9,9,13,14,15,15,16,17,18],[19,20,21,22,23,24,23,22,21,25,26],[27,28,29,30,21,30,21,30,31,32,18],[2,1,33,34,31,35,31,36,37,2,2],[0,0,38,2,2,39,2,2,38,0,0]]}},{"id":"guantes","label":"GUANTES DE CUERO","photo":{"cols":11,"rows":7,"palette":["#100100100","#b0b0b0","#606060","#909090","#908090","#505050","#e0e0e0","#c0c0c0","#808080","#404040","#707070","#504040","#d0d0d0","#d0c0c0","#504050","#303030","#403030","#706070"],"chars":["@@@@@qn@@@@","@@@@QLnx#h@","@@@@YLlj#1@","bQ@$dzjtfb@","@@qah lt|@@","@@@hh|1f|@@","@@@@*cj!h@@"],"colorIdx":[[0,0,0,0,0,1,2,0,0,0,0],[0,0,0,0,3,4,2,5,6,7,0],[0,0,0,0,8,4,9,5,6,9,0],[7,3,0,0,1,10,5,11,5,7,0],[0,0,1,12,13,0,9,14,15,0,0],[0,0,0,7,13,15,9,5,16,0,0],[0,0,0,0,12,17,5,15,12,0,0]]}},{"id":"botas","label":"LAS BOTAS DE FAENA","photo":{"cols":11,"rows":7,"palette":["#eaeaea","#d0d0d0","#686868","#4e4e4e","#9c9c9c","#b6b6b6"],"chars":["```````````","(Lqq|``````","dddpbz`````","pdddqZw1```","ddbbdwmwmmm","OpQmdbqdbpp","```````````"],"colorIdx":[[0,0,0,0,0,0,0,0,0,0,0],[1,2,3,3,1,0,0,0,0,0,0],[3,3,3,3,3,4,0,0,0,0,0],[3,3,3,3,3,2,3,5,0,0,0],[3,3,3,3,3,3,3,3,3,3,3],[2,3,2,2,3,3,3,3,3,3,3],[0,0,0,0,0,0,0,0,0,0,0]]}}];

export function itemArtFor(id) {
  const entry = ITEM_ART.find((e) => e.id === id);
  return entry ? entry.photo : null;
}

export const ITEM_ART_W = 11, ITEM_ART_H = 7;
