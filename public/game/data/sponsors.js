// Patrocinador de camiseta: un trato distinto y permanente, a la vez que el
// patrocinio local por objetivos — paga una cantidad fija cada vez que se
// gana un partido de liga, sin plazo ni condición, mientras dure el trato.
// Se puede cambiar de patrocinador de camiseta cuando se quiera.
export const SHIRT_SPONSOR_POOL = [
  { id: 'ultramarinos', name: 'ULTRAMARINOS EL PILAR', perWin: 15, signBonus: 50, repRequired: 0,
    desc: 'La tienda de la esquina. Poca cosa, pero constante.' },
  { id: 'autoescuela', name: 'AUTOESCUELA RÁPIDO', perWin: 25, signBonus: 100, repRequired: 15,
    desc: 'Paga mejor si ya suena vuestro nombre por la comarca.' },
  { id: 'bodega', name: 'BODEGAS DEL TÍO CELES', perWin: 40, signBonus: 200, repRequired: 40,
    desc: 'Vino de la zona con ganas de patrocinar a un equipo con nombre.' },
  { id: 'inmobiliaria', name: 'INMOBILIARIA COSTA Y LLANO', perWin: 65, signBonus: 400, repRequired: 75,
    desc: 'Solo firman con clubes de referencia en el circuito.' },
];

// Patrocinios locales: pagan una prima si cumples el objetivo antes del plazo.
// Los de más premio piden reputación de mánager (ver Player.managerRep):
// a un club desconocido no le ponen el nombre de la marca en la camiseta.
export const SPONSOR_POOL = [
  { id: 'bar', name: 'BAR CASA PACO', desc: 'Gana 2 torneos en 6 jornadas', target: 2, metric: 'wins', window: 6, reward: 150, repRequired: 0 },
  { id: 'ferreteria', name: 'FERRETERÍA SAN ISIDRO', desc: 'Ficha a un abuelo nuevo en 4 jornadas', target: 1, metric: 'fichajes', window: 4, reward: 120, repRequired: 0 },
  { id: 'panaderia', name: 'PANADERÍA LA ESPIGA', desc: 'Suma 15 puntos de liga en 5 jornadas', target: 15, metric: 'ligaPts', window: 5, reward: 180, repRequired: 0 },
  { id: 'farmacia', name: 'FARMACIA DEL CARMEN', desc: 'Gana un partido por 6 puntos de diferencia o más en 6 jornadas', target: 1, metric: 'cleanSweeps', window: 6, reward: 200, repRequired: 0 },
  { id: 'taller', name: 'TALLER HERMANOS RUIZ', desc: 'Véngate de tu némesis en 8 jornadas', target: 1, metric: 'finalWins', window: 8, reward: 250, repRequired: 0 },
  { id: 'caja', name: 'CAJA RURAL COMARCAL', desc: 'Suma 25 puntos de liga en 6 jornadas', target: 25, metric: 'ligaPts', window: 6, reward: 400, repRequired: 40 },
  { id: 'concesionario', name: 'CONCESIONARIO EL VOLANTE', desc: 'Gana 3 torneos en 6 jornadas', target: 3, metric: 'wins', window: 6, reward: 500, repRequired: 70 },
];
