// Dificultad de la partida: se elige una vez, al empezar, y ajusta el
// dinero de salida, la frecuencia de contratiempos de calendario y lo que
// cuesta la nómina semanal. No crea sistemas nuevos, solo mueve las
// palancas que ya existen (ver Game._startWeeklyMatch y Career.js).
export const DIFFICULTIES = [
  { id: 'facil', name: 'FÁCIL', moneyMult: 1.5, eventMult: 0.7, wageMult: 0.8,
    desc: 'Empiezas con más dinero, menos contratiempos y nóminas más baratas. Para disfrutar sin agobios.' },
  { id: 'normal', name: 'NORMAL', moneyMult: 1, eventMult: 1, wageMult: 1,
    desc: 'La experiencia tal cual está pensada: ni favores ni penurias de más.' },
  { id: 'dificil', name: 'DIFÍCIL', moneyMult: 0.6, eventMult: 1.4, wageMult: 1.3,
    desc: 'Menos dinero de salida, más lesiones y contratiempos, nóminas que aprietan. Para managers curtidos.' },
];
