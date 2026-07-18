// Capítulos de la campaña ("Historia de la peña"): objetivos que se
// comprueban solos contra el estado del jugador y dan un premio único.
export const CAMPAIGN_CHAPTERS = [
  { id: 'first_win', title: 'EL PRIMER TÍTULO', desc: 'Gana tu primer torneo.',
    check: (p) => p.wins >= 1, reward: { m: 100, x: 50 } },
  { id: 'refuerzos', title: 'REFUERZOS', desc: 'Ficha a 3 abuelos para la peña.',
    check: (p) => p.roster.length >= 3, reward: { m: 150, x: 80 } },
  { id: 'gira', title: 'GIRA NACIONAL', desc: 'Gana torneos en 3 ciudades distintas.',
    check: (p) => p.citiesWon.length >= 3, reward: { m: 250, x: 150 } },
  { id: 'venganza', title: 'OJO POR OJO', desc: 'Vence a tu némesis en su propia ciudad.',
    check: (p) => p.nemesisDefeats >= 1, reward: { m: 200, x: 120 } },
  { id: 'liga', title: 'CAMPEONES DE COMARCA', desc: 'Sé campeón de la liga de peñas.',
    check: (p) => p.seasonTitles >= 1, reward: { m: 400, x: 250 } },
  { id: 'relevo', title: 'RELEVO GENERACIONAL', desc: 'Retira a un abuelo y da paso a su nieto.',
    check: (p) => Object.values(p.state).some((s) => s.gen > 0), reward: { m: 150, x: 100 } },
  { id: 'tormenta', title: 'BAJO TORMENTA', desc: 'Gana un torneo jugado bajo una tormenta.',
    check: (p) => p.stormWins >= 1, reward: { m: 300, x: 200 } },
  { id: 'completa', title: 'LA PEÑA AL COMPLETO', desc: 'Ficha a los 10 abuelos del pueblo.',
    check: (p) => p.roster.length >= 10, reward: { m: 500, x: 400 } },
];
