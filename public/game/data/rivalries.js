// Roces internos: pares de abuelos que no se llevan bien. Si uno juega mucho
// más que el otro en el mismo torneo, el que se queda en el banquillo pierde
// moral extra por los celos.
export const RIVALRY_PAIRS = [
  { a: 9, b: 6, desc: 'BLAS y PEPE llevan años disputándose quién manda en la peña.' },
  { a: 3, b: 4, desc: 'RAMÓN y EL RUBIO no se soportan desde una final perdida hace tres años.' },
  { a: 1, b: 7, desc: 'MANOLO y LUCIO discuten cada semana sobre quién lee mejor el viento.' },
];

export function rivalOf(i) {
  for (const p of RIVALRY_PAIRS) {
    if (p.a === i) return p.b;
    if (p.b === i) return p.a;
  }
  return null;
}
