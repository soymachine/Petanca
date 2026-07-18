// Plantilla fija de ojeadores contratables. Cada uno se asigna a UNA cosa
// a la vez (ver model/ScoutStaff.js): o "ojea un país" (va sacando
// excedentes nuevos al Mercado, uno cada `weeksPerDiscovery` semanas) o
// "ojea a un jugador" concreto ya descubierto (tras `weeksToReveal`
// semanas revela sus 5 stats reales de golpe). Cuanto más nivel, más caro,
// más rápido en ambos y con un rango de nivel inicial más estrecho y
// fiable para lo que va descubriendo (`rangeWidth`, en puntos sobre 100).
// Los dos últimos piden cierta reputación de mánager (ver Player.managerRep):
// no cualquiera te coge el teléfono si no te conocen en el circuito.
export const SCOUT_TEMPLATES = [
  { id: 'aficionado', name: 'Ojeador aficionado', level: 1, cost: 150, repRequired: 0,
    weeksPerDiscovery: 3, weeksToReveal: 10, rangeWidth: 40,
    desc: 'Va los domingos por afición, cuaderno en mano. Tarda, y encima no afina mucho el nivel que apunta.' },
  { id: 'veterano', name: 'Ojeador veterano', level: 2, cost: 350, repRequired: 0,
    weeksPerDiscovery: 2, weeksToReveal: 6, rangeWidth: 28,
    desc: 'Conoce el percal de toda la vida: encuentra gente con más soltura y calcula mejor lo que vale.' },
  { id: 'profesional', name: 'Ojeador profesional', level: 3, cost: 700, repRequired: 30,
    weeksPerDiscovery: 1, weeksToReveal: 3, rangeWidth: 16,
    desc: 'Cronómetro, informe semanal y contactos en media Europa. Caro, pero fino.' },
  { id: 'elite', name: 'Ojeador de primer nivel', level: 4, cost: 1200, repRequired: 80,
    weeksPerDiscovery: 1, weeksToReveal: 1, rangeWidth: 8,
    desc: 'Ha ojeado en federaciones de verdad. Casi no falla al calcular el nivel, y solo trabaja para gente con nombre en el circuito.' },
];
