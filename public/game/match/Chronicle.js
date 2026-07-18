// Compone la crónica de un partido jugado en vivo a partir de los hechos
// reales acumulados en Match.chronicle (ver Match.js: resolveMano, el bloque
// de falta/lesión, el cambio de clima y la medición) — no inventa nada que
// no haya pasado en la partida. Se firma con uno de dos cronistas fijos:
// uno ecuánime y otro con manía, que sale más si tocaba y siempre si había
// una promesa de prensa incumplida de por medio.
const CRONISTAS = {
  eladio: 'Eladio Cifuentes, El Eco Comarcal',
  paco: 'Paco Arenas, La Voz de la Petanca',
};

// orden de relevancia: qué hecho se cuenta primero si hay varios
const PRIORITY = ['lesion', 'remontada', 'decisiva', 'clima', 'medicion', 'racha'];

function factClause(fact) {
  switch (fact.t) {
    case 'lesion':
      return `con ${fact.data.name} apretando los dientes tras resentirse en pleno partido`;
    case 'remontada':
      return `remontando un marcador que llegó a estar ${fact.data.scoreA}-${fact.data.scoreP} en contra`;
    case 'decisiva':
      return 'con una mano decisiva en el tramo final que dejó el partido sentenciado';
    case 'clima':
      return 'con un cambio de tiempo a media partida que lo puso todo cuesta arriba';
    case 'medicion':
      return 'con una mano tan ajustada que hubo que sacar la cinta de medir';
    case 'racha':
      return `encadenando una racha de ${fact.data.streak} manos seguidas`;
    default:
      return '';
  }
}

export const Chronicle = {
  // ctx: { won, scoreP, scoreA, rivalName, clubName, venueLabel, promiseBroken }
  compose(facts, ctx) {
    const picked = PRIORITY.map((t) => facts.find((f) => f.t === t)).filter(Boolean).slice(0, 3);
    const cronista = ctx.promiseBroken ? 'paco' : (Math.random() < 0.25 ? 'paco' : 'eladio');

    const scoreLabel = ctx.won ? `${ctx.scoreP}-${ctx.scoreA}` : `${ctx.scoreA}-${ctx.scoreP}`;
    let body = ctx.won
      ? `${ctx.clubName} se lleva el partido ${scoreLabel} ante ${ctx.rivalName} en ${ctx.venueLabel}`
      : `${ctx.rivalName} se lleva el partido ${scoreLabel} frente a ${ctx.clubName} en ${ctx.venueLabel}`;

    if (picked.length) body += ', ' + picked.map(factClause).join(' y ') + '.';
    else body += '.';

    if (ctx.promiseBroken) {
      body += ' Como avisó Arenas antes del partido: lo dicho en la rueda de prensa no se ha cumplido, y aquí no se olvida.';
    }

    return `CRÓNICA: ${body} — ${CRONISTAS[cronista]}.`;
  },
};
