import { RIVALRY_PAIRS } from './rivalries.js';

// Eventos de decisión del calendario: a diferencia de los imprevistos
// pasivos de Calendar.js (lesión, muerte, evento de moral), aquí el
// jugador elige entre 2-3 opciones con efecto inmediato — y algunas
// opciones siembran una secuela que llega semanas después citando lo
// elegido (ver `sequel`, resuelto en domain/SeasonClock + Game.js).
//
// Efectos soportados (ver Game.js applyDecisionEffects):
//   moral: { target: 'abuelo'|'all', d }
//   stamina: { target: 'abuelo'|'all', d }
//   money: número (+/-)
//   boardConfidence: número (+/-)
//   xp: { target: 'abuelo', amount }
//   item: { target: 'abuelo', itemId }   (ver data/items.js)
//
// `pick` decide qué abuelo(s) protagonizan el evento:
//   'random' | 'oldest' | 'youngest' -> ctx.abueloId
//   'benched' -> el hueco con más semanas seguidas sin jugar (ver
//                AbueloState.benchStreak) -> ctx.abueloId, ctx.benchStreak
//   'rivalry' -> un par de RIVALRY_PAIRS con ambos en plantilla ->
//                ctx.abueloId, ctx.abueloId2, ctx.pairDesc
//
// Una opción puede fijar su efecto de dos formas:
//   - estática: `effects` + `resultText`, como siempre (visibles de
//     antemano en el modal, "nada de letra pequeña")
//   - dinámica: `resolve(player, ctx) -> { effects, resultText }`, para
//     que el resultado dependa de verdad de las stats del abuelo
//     protagonista (p.ej. su temple) en vez de ser siempre el mismo
//     número — en ese caso el modal muestra `previewText` en vez de
//     intentar adivinar el efecto exacto (ver AgendaScreen._drawDecisionModal)
export const DECISION_EVENTS = [
  {
    id: 'nieto_fermin', weight: 1, pick: 'random',
    cond: (p) => p.roster.size >= 1,
    title: 'EL NIETO QUIERE VENIR',
    text: 'El nieto de {abuelo} anda todo el día pidiendo venirse a los entrenos de la peña.',
    options: [
      { label: 'QUE VENGA', effects: { moral: { target: 'abuelo', d: 6 } },
        sequel: { id: 'nieto_fermin_2', inWeeks: 3 },
        resultText: 'El chaval no falla un domingo. {abuelo} está encantado con la compañía.' },
      { label: 'MEJOR QUE NO', effects: { moral: { target: 'abuelo', d: -4 } },
        resultText: '{abuelo} no dice nada, pero se le nota que le habría gustado que sí.' },
    ],
  },
  {
    id: 'nieto_fermin_2', weight: 0, pick: 'random',
    title: 'EL NIETO YA ES UNO MÁS',
    text: 'El nieto de {abuelo} ya se sabe el nombre de todos los de la peña y no se pierde ni un entreno.',
    options: [
      { label: 'DEJARLE TIRAR ALGUNA BOLA', effects: { moral: { target: 'abuelo', d: 8 } },
        resultText: '{abuelo} lo cuenta en el bar como si hubiera ganado la Copa de Europa.' },
      { label: 'QUE MIRE Y CALLE', effects: { moral: { target: 'abuelo', d: 2 } },
        resultText: 'El chaval mira embobado. {abuelo} disimula que le hace ilusión.' },
    ],
  },
  {
    id: 'oferta_dudosa_patrocinador', weight: 1, pick: 'random',
    title: 'UNA OFERTA QUE HUELE RARO',
    text: 'Un empresario que nadie conoce de nada quiere pagar bien por poner su nombre en las camisetas.',
    options: [
      { label: 'ACEPTAR EL DINERO', effects: { money: 180 },
        sequel: { id: 'oferta_dudosa_patrocinador_2', inWeeks: 5 },
        resultText: 'Firmáis sin hacer muchas preguntas. El dinero es el dinero.' },
      { label: 'DECIR QUE NO', effects: {},
        resultText: 'Mejor no mezclarse con gente que nadie conoce de nada.' },
    ],
  },
  {
    id: 'oferta_dudosa_patrocinador_2', weight: 0,
    title: 'AQUELLO ERA DEMASIADO BUENO',
    text: 'Resulta que el empresario de las camisetas ha desaparecido del pueblo sin pagar ni una ronda de vinos más, y encima debía dinero a medio comercio local.',
    options: [
      { label: 'ASUMIRLO Y A OTRA COSA', effects: { boardConfidence: -8 },
        resultText: 'La junta pone mala cara, pero se pasa página. Ya se aprendió la lección.' },
      { label: 'DEVOLVER LO COBRADO POR SI ACASO', effects: { money: -100, boardConfidence: 5 },
        resultText: 'Devolvéis parte del dinero para dejar las cosas claras. La junta lo agradece.' },
    ],
  },
  {
    id: 'entreno_secreto_ojeador', weight: 1,
    cond: (p) => p.roster.size >= 2,
    title: 'ALGUIEN OS ANDA OJEANDO',
    text: 'Un tipo con pinta de ojeador rival lleva dos días apuntando cosas en el descampado sin decir para quién trabaja.',
    options: [
      { label: 'DEJARLE MIRAR', effects: { money: 40 },
        resultText: 'Le dais conversación y hasta invita a un café. El dinero no huele.' },
      { label: 'ECHARLE DE ALLÍ', effects: { boardConfidence: 4 },
        resultText: 'Se le plantan cara y se va sin rechistar. La junta valora la seriedad.' },
    ],
  },
  {
    id: 'dia_de_familia', weight: 1,
    title: 'DÍA DE FAMILIAS EN LA PEÑA',
    text: 'Alguien propone montar una comida de la peña con las familias de todos un domingo entre semana.',
    options: [
      { label: 'ORGANIZARLA', effects: { moral: { target: 'all', d: 5 } },
        resultText: 'Buena comida, mejor ambiente. La peña sale de allí como una piña.' },
      { label: 'MEJOR OTRO DÍA', effects: {},
        resultText: 'Se deja para más adelante. Tampoco pasa nada.' },
    ],
  },
  {
    id: 'medico_pueblo', weight: 1, pick: 'oldest',
    title: 'EL MÉDICO DEL PUEBLO OPINA',
    text: 'El médico se ha cruzado con {abuelo} y le ha dicho, medio en broma medio en serio, que debería descansar una semana entera.',
    options: [
      { label: 'HACERLE CASO', effects: { stamina: { target: 'abuelo', d: 25 }, moral: { target: 'abuelo', d: -2 } },
        resultText: '{abuelo} descansa de verdad. El cuerpo lo agradece, aunque le sabe a poco no jugar.' },
      { label: 'QUE EL MÉDICO SIGA A LO SUYO', effects: {},
        resultText: '{abuelo} sigue como siempre. Total, ¿qué sabrá un médico de petanca?' },
    ],
  },
  {
    id: 'entreno_extra_veterano', weight: 1, pick: 'oldest',
    cond: (p) => p.money >= 60,
    title: 'UN VETERANO SE OFRECE',
    text: 'Un viejo jugador de petanca de otro pueblo se ofrece a darle un par de sesiones extra a {abuelo}, por una módica cantidad.',
    options: [
      { label: 'PAGAR LAS SESIONES', effects: { money: -60, xp: { target: 'abuelo', amount: 40 } },
        sequel: { id: 'entreno_extra_veterano_2', inWeeks: 4 },
        resultText: '{abuelo} vuelve de las sesiones con trucos nuevos bajo la boina.' },
      { label: 'NO HACE FALTA', effects: {},
        resultText: 'Se lo agradecéis, pero seguís con lo de siempre.' },
    ],
  },
  {
    id: 'entreno_extra_veterano_2', weight: 0, pick: 'oldest',
    title: 'EL VETERANO VUELVE A LLAMAR',
    text: 'El veterano de las sesiones extra pregunta si {abuelo} quiere seguir entrenando con él de vez en cuando, ahora ya sin cobrar, "por el gusto de ver jugar bien a alguien".',
    options: [
      { label: 'SEGUIR APRENDIENDO', effects: { xp: { target: 'abuelo', amount: 25 }, moral: { target: 'abuelo', d: 4 } },
        resultText: 'Se hacen buenos amigos. {abuelo} juega con otra confianza desde entonces.' },
      { label: 'DEJARLO AQUÍ', effects: {},
        resultText: 'Se despiden con un apretón de manos y ya está.' },
    ],
  },
  {
    id: 'feria_local', weight: 1,
    title: 'EXHIBICIÓN EN LA FERIA',
    text: 'El ayuntamiento pide que la peña haga una exhibición de petanca en la feria del pueblo, con caseta y todo.',
    options: [
      { label: 'HACER LA EXHIBICIÓN', effects: { money: 70, moral: { target: 'all', d: 3 }, stamina: { target: 'all', d: -8 } },
        resultText: 'Sale gente hasta de los pueblos de al lado a mirar. La peña se hace notar.' },
      { label: 'PASAR DE FERIAS', effects: {},
        resultText: 'Preferís guardar fuerzas para lo que importa de verdad.' },
    ],
  },
  {
    id: 'rumor_ayuntamiento', weight: 1,
    title: 'EL AYUNTAMIENTO SE INTERESA',
    text: 'Alguien del ayuntamiento pregunta si la peña estaría dispuesta a representar al pueblo en un acto oficial, a cambio de una ayudita para el club.',
    options: [
      { label: 'REPRESENTAR AL PUEBLO', effects: { money: 90, boardConfidence: 6 },
        resultText: 'Queda bien de cara a la comarca, y la junta lo apunta a su favor.' },
      { label: 'NO METERSE EN POLÍTICAS', effects: {},
        resultText: 'Mejor no mezclar la petanca con según qué cosas.' },
    ],
  },
  {
    id: 'comparsa_vestidor', weight: 1, pick: 'random',
    cond: (p) => p.roster.size >= 3,
    title: 'ROCES EN EL VESTUARIO',
    text: 'Se nota tensión en el vestuario: alguno cree que {abuelo} se lleva demasiado protagonismo últimamente.',
    options: [
      { label: 'HABLARLO CON TODOS', effects: { moral: { target: 'all', d: 3 } },
        resultText: 'Una charla clara y se acaba el rumor. Todos respiran mejor.' },
      { label: 'DEJAR QUE SE LES PASE SOLO', effects: { moral: { target: 'abuelo', d: -3 } },
        resultText: 'La cosa se enfría sola, pero a {abuelo} le queda un poso de mal cuerpo.' },
    ],
  },
  {
    id: 'viejo_rival_reto', weight: 1,
    title: 'UN VIEJO RIVAL OS RETA',
    text: 'El capitán de otro club de la comarca anda diciendo por ahí que os tiene ganas para el próximo cruce.',
    options: [
      { label: 'RESPONDER EN EL BAR', effects: { moral: { target: 'all', d: 5 } },
        resultText: 'La peña entera se crece con la bravuconada. Ya hay ganas de que llegue el partido.' },
      { label: 'NO ENTRAR AL TROTE', effects: {},
        resultText: 'Mejor guardar las palabras para la pista.' },
    ],
  },
  {
    id: 'gripe_leve', weight: 1, pick: 'random',
    title: 'UNA GRIPE RONDA LA PEÑA',
    text: 'Anda un catarro rondando el pueblo y a {abuelo} no le ha dejado indiferente.',
    options: [
      { label: 'PAGAR LA FARMACIA Y DESCANSAR', effects: { money: -20, stamina: { target: 'abuelo', d: 20 } },
        resultText: '{abuelo} se cuida y en un par de días está como nuevo.' },
      { label: 'AGUANTAR COMO SIEMPRE', effects: { stamina: { target: 'abuelo', d: -5 } },
        resultText: '{abuelo} tira de orgullo, aunque se le nota el cuerpo cortado.' },
    ],
  },
  {
    id: 'reportero_indiscreto', weight: 1,
    title: 'UN REPORTERO PREGUNTA DE MÁS',
    text: 'Un reportero del periódico comarcal quiere saber "cómo se lleva de verdad" la plantilla, con segundas.',
    options: [
      { label: 'CONTESTAR CON NATURALIDAD', effects: { moral: { target: 'all', d: 2 } },
        resultText: 'Sale un artículo majo. La peña queda bien retratada.' },
      { label: 'NO DAR MUNICIÓN', effects: {},
        resultText: 'Respuestas cortas y a otra cosa. Nada que contar.' },
    ],
  },
  {
    // banquillo_queja: storytelling emergente ligado a un hueco real de la
    // plantilla (ver AbueloState.benchStreak, incrementado en
    // Career.finishWeeklyMatch) — no es un evento genérico de sabor, solo
    // dispara si de verdad hay alguien criando polvo en el banquillo. El
    // resultado real de cada opción depende del TEMPLE del propio abuelo
    // (ver `resolve`, no `effects` fijo): a un temple bajo la respuesta seria
    // le sienta mucho peor, y calmarlo de verdad solo cuaja si aguanta el
    // pulso emocional.
    id: 'banquillo_queja', weight: 2, pick: 'benched',
    cond: (p) => p.roster.ids.length >= 2 && p.roster.ids.some((id) => (p.roster.get(id).benchStreak || 0) >= 3),
    title: 'SE HARTA DEL BANQUILLO',
    text: '{abuelo} lleva varias jornadas seguidas sin pisar la pista y quiere hablar con vosotros, serio: quiere jugar.',
    options: [
      { label: 'CALMARLO', previewText: 'Efecto real según el temple de {abuelo}: puede quedar tranquilo del todo o solo a medias.',
        resolve: (p, ctx) => {
          const s = p.roster.get(ctx.abueloId);
          const temple = s.getStat('temple');
          const ok = Math.random() < clampChance(temple / 10, 0.15, 0.9);
          return ok
            ? { effects: { moral: { target: 'abuelo', d: 14 } },
                resultText: 'La charla surte efecto de verdad: {abuelo} se queda tranquilo, entiende que le toca esperar su turno.' }
            : { effects: { moral: { target: 'abuelo', d: 4 } },
                resultText: 'La charla ayuda algo, pero {abuelo} sigue mascullando por lo bajo. No se lo cree del todo.' };
        } },
      { label: 'RESPONDER SERIO: AQUÍ DECIDO YO', previewText: 'Efecto real según el temple de {abuelo}: se lo puede tomar bien, o muy mal.',
        resolve: (p, ctx) => {
          const s = p.roster.get(ctx.abueloId);
          const temple = s.getStat('temple');
          if (temple >= 7) {
            return { effects: { moral: { target: 'abuelo', d: -4 }, boardConfidence: 3 },
              resultText: 'No le hace gracia, pero {abuelo} se lo toma con deportividad: sabe que la decisión es vuestra. La junta valora el pulso firme.' };
          }
          return { effects: { moral: { target: 'abuelo', d: -16 } },
            resultText: '{abuelo} se lo toma fatal. Sale del vestuario dando un portazo y el pueblo entero se entera de que aquí no se valora a nadie.' };
        } },
    ],
  },
  {
    // discusion_jugadores: leverage RIVALRY_PAIRS (roces internos ya
    // existentes en Roster.applyRivalryJealousy) para una decisión real de
    // "toma partido": dar la razón a uno cuesta al otro moral, tanto más
    // cuanto menos temple tenga, y si ya se llevaban bien en pista
    // (chemistry) el roce se nota también ahí.
    id: 'discusion_jugadores', weight: 2, pick: 'rivalry',
    cond: (p) => !!presentRivalryPair(p),
    title: 'SE LÍAN A DISCUTIR EN PLENO ENTRENO',
    text: '{pairDesc} Hoy la discusión ha subido de tono en pleno entreno y los dos os piden que os pongáis de su lado.',
    options: [
      { label: 'DAR LA RAZÓN A {abuelo}', previewText: '{abuelo} sale ganando; a {abuelo2} le sienta peor cuanto menos temple tenga.',
        resolve: (p, ctx) => resolveDiscussion(p, ctx, ctx.abueloId, ctx.abueloId2) },
      { label: 'DAR LA RAZÓN A {abuelo2}', previewText: '{abuelo2} sale ganando; a {abuelo} le sienta peor cuanto menos temple tenga.',
        resolve: (p, ctx) => resolveDiscussion(p, ctx, ctx.abueloId2, ctx.abueloId) },
      { label: 'NO TOMAR PARTIDO', effects: { moral: { target: 'abuelo', d: -2 }, moral2: { target: 'abuelo2', d: -2 } },
        resultText: 'No os mojáis. Ninguno de los dos queda contento, pero tampoco se rompe nada.' },
    ],
  },
];

// el primer par de RIVALRY_PAIRS con ambos fichados a la vez en la
// plantilla actual (o null si ninguno cuaja) — compartido entre `cond` y
// la construcción de ctx (ver Game.js._buildDecisionCtx) para que nunca
// puedan ir a destiempo el uno del otro
export function presentRivalryPair(p) {
  return RIVALRY_PAIRS.find((pair) => p.roster.has(pair.a) && p.roster.has(pair.b)) || null;
}

function clampChance(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

// resultado compartido de "dar la razón a X" (favorecido) sobre Y
// (perjudicado): moral fija arriba para el favorecido, moral hacia abajo
// para el otro escalada con SU temple — cuanto más flemático, mejor se lo
// toma — y si ya llevaban partidos juntos en pista, el roce también
// empaña un poco la compenetración ganada (ver Player.chemistry)
function resolveDiscussion(p, ctx, winnerId, loserId) {
  const loser = p.roster.get(loserId);
  const temple = loser.getStat('temple');
  const hit = -(4 + Math.round((10 - temple) * 1.4));
  return {
    effects: { moral: { target: winnerId, d: 10 }, moral2: { target: loserId, d: hit }, chemistryHit: { a: ctx.abueloId, b: ctx.abueloId2, d: 4 } },
    resultText: temple >= 7
      ? `Le sale caro, pero {abuelo${loserId === ctx.abueloId2 ? '2' : ''}} se lo toma con más deportividad de la esperada.`
      : `{abuelo${loserId === ctx.abueloId2 ? '2' : ''}} se lo toma fatal y anda de morros con todo el mundo unos días.`,
  };
}

export function decisionEventById(id) { return DECISION_EVENTS.find((e) => e.id === id); }

// sustituye {abuelo}/{abuelo2} por el nombre real de cada protagonista (o
// "la peña" si el evento no tiene uno, p.ej. los que afectan a todos por
// igual) — se usa tanto en textos como en labels de opción
export function fillDecisionText(str, ctx, nameOf) {
  let out = ctx.abueloId === undefined || ctx.abueloId === null ? str.replace(/\{abuelo\}/g, 'la peña') : str.replace(/\{abuelo\}/g, nameOf(ctx.abueloId));
  if (ctx.abueloId2 !== undefined && ctx.abueloId2 !== null) out = out.replace(/\{abuelo2\}/g, nameOf(ctx.abueloId2));
  if (ctx.pairDesc) out = out.replace(/\{pairDesc\}/g, ctx.pairDesc);
  return out;
}
