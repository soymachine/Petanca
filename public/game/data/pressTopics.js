// Rueda de prensa antes de un partido importante (derbi, némesis o última
// jornada de temporada): varias formas de responder, con su propio efecto
// de moral y un riesgo si luego no se cumple lo prometido.
// `imageDelta`: cuánto mueve la percepción pública del mánager (ver
// Player.nudgePublicImage) — positivo hacia "fanfarrón", negativo hacia
// "comedido". Se acumula a lo largo de la carrera, no solo esta rueda de
// prensa: contestar siempre confiado/provocador te labra una fama concreta.
export const PRESS_OPTIONS = [
  { id: 'confiado', label: 'CONFIADO', line: '"Vamos a ganar, sin más."',
    moraleNow: 6, loseBonus: -10, imageDelta: 8,
    result: 'La peña sale a la pista con el pecho hinchado — pero como no se cumpla, la que se va a liar.' },
  { id: 'humilde', label: 'HUMILDE', line: '"Va a ser difícil. El rival aprieta."',
    moraleNow: 2, loseBonus: 0, imageDelta: -6,
    result: 'Nadie se juega el cuello. Ni sube mucho la moral ni hay drama si sale mal.' },
  { id: 'provocador', label: 'PROVOCADOR', line: '"Que se preparen. Ganamos seguro."',
    moraleNow: 9, loseBonus: -16, imageDelta: 14,
    result: 'Titular para la Hemeroteca asegurado. Si sale bien, épica. Si no, va a doler el doble.' },
  { id: 'ironico', label: 'IRÓNICO', line: '"Ganaremos... si se portan bien las bolas."',
    moraleNow: 5, loseBonus: -6, imageDelta: 3,
    result: 'Risas en el bar. Si se pierde, queda como una broma que ya no hace tanta gracia.' },
  { id: 'diplomatico', label: 'DIPLOMÁTICO', line: '"Que gane el mejor. Nosotros a disfrutar."',
    moraleNow: 1, loseBonus: 0, imageDelta: -10,
    result: 'Nadie se acuerda de esta rueda de prensa ni para bien ni para mal.' },
];
