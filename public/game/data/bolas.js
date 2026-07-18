export const BOLAS = [
  { name: 'LAS DEL ABUELO', price: 0,
    desc: 'Las de toda la vida. Equilibradas y con mataduras.',
    mods: {} },
  { name: 'PESADAS', price: 300,
    desc: 'Acero macizo: el viento apenas las toca y apartan que da gusto, pero llegan menos.',
    mods: { wind: 0.55, impact: 1.4, pow: -5 } },
  { name: 'LISAS', price: 400,
    desc: 'Pulidas como un espejo: ruedan finas en seco, pero cogen poco efecto y patinan en mojado.',
    mods: { roll: 0.72, spin: 0.65, wetPenalty: 1.3 } },
  { name: 'ESTRIADAS', price: 500,
    desc: 'Las ranuras muerden la tierra: más efecto, agarre total en lluvia, ruedan menos.',
    mods: { roll: 1.18, spin: 1.35, grip: true } },
];
