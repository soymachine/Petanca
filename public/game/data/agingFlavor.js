// Presagios de la edad: no cambian nada mecánico — son el aviso narrativo
// de que el declive físico (ver AbueloState.ageDeclineFor) ya se nota, para
// que la eventual despedida (Calendar.rollDeath) no llegue de sopetón. Se
// dispara como mucho una vez por abuelo (ver AbueloState.agingFlavorSeen),
// y si llega a fallecer, el IN MEMORIAM lo cita como un aviso que ya venía
// de antes (ver Game.js._startWeeklyMatch).
export const AGING_FLAVOR = [
  'Se le nota a {n} más lento subiendo la cuesta del descampado. En el bar ya se preguntan cuánto más va a aguantar.',
  '{n} ha empezado a hablar de dejarlo, aunque luego se calla y sigue viniendo cada domingo.',
  'La familia de {n} anda preguntando si no sería mejor que lo dejara ya, con lo bien que lo ha hecho.',
  'A {n} le cuesta cada vez más agacharse a coger la bola. Disimula, pero se le nota.',
  'Dicen en la peña que {n} ya no es el que era, aunque nadie se atreve a decírselo a la cara.',
];
