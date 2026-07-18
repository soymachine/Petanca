// Fiestas locales: de vez en cuando la jornada de liga coincide con las
// fiestas del pueblo — ambiente de feria, más público en la pista y mejor
// premio si se gana, además de una alegría de moral para toda la peña
// simplemente por el subidón de jugar en fiestas.
export const FESTIVAL_NAMES = [
  'LAS FIESTAS DEL PATRÓN', 'LA FERIA DE SAN ISIDRO', 'LA VERBENA DE LA VIRGEN',
  'LAS FIESTAS DE LA VENDIMIA', 'LA ROMERÍA DEL PUEBLO', 'LAS FIESTAS DE VERANO',
];

export function rollFestival() {
  if (Math.random() > 0.07) return null;
  return FESTIVAL_NAMES[Math.floor(Math.random() * FESTIVAL_NAMES.length)];
}
