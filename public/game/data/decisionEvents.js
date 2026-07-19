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
// `pick` decide qué abuelo protagoniza el evento (queda en ctx.abueloId,
// usado por {abuelo} en los textos): 'random' | 'oldest' | 'youngest'.
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
];

export function decisionEventById(id) { return DECISION_EVENTS.find((e) => e.id === id); }

// sustituye {abuelo} por el nombre real del hueco protagonista (o "la peña"
// si el evento no tiene uno, p.ej. los que afectan a todos por igual)
export function fillDecisionText(str, ctx, nameOf) {
  if (ctx.abueloId === undefined || ctx.abueloId === null) return str.replace(/\{abuelo\}/g, 'la peña');
  return str.replace(/\{abuelo\}/g, nameOf(ctx.abueloId));
}
