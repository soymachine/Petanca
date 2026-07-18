// El arquetipo PROPIO de un abuelo: a diferencia del de los rivales
// (rivalArchetypes.js, fijo de serie y determinista por nombre de club),
// este se GANA jugando — según en qué stat se ha entrenado más en serio
// (AbueloState.bonus, que solo sube entrenando con éxito, ver
// AbueloState.train()). Da una identidad emergente a la plantilla y
// alimenta crónicas/flavor, igual que el arquetipo rival alimenta al IA.
export const ABUELO_ARCHETYPES = {
  pulso: { label: 'Arrimador de la casa', desc: 'A este no le tiembla el pulso para dejarla pegada al boliche.' },
  brazo: { label: 'Brazo de la peña', desc: 'Cuando hay que desatascar una mano a lo bruto, sale él.' },
  mana: { label: 'Mago del efecto', desc: 'Rodea cualquier bola que se le ponga por delante como si nada.' },
  temple: { label: 'Roca de nervios', desc: 'Cuanto más aprieta el marcador, más firme le sale el tiro.' },
  aguante: { label: 'Incansable', desc: 'Aguanta el ritmo de la tanda entera sin que se le note el cansancio.' },
};

// hace falta al menos un entreno superado de verdad en esa stat en
// concreto (AbueloState.train suma bonusAmount*10 por acierto) antes de
// que el arquetipo "cuaje" — si no, cualquiera con un solo punto de
// ventaja en el bonus se llevaría una etiqueta que aún no se ha ganado
const MIN_BONUS_TO_QUALIFY = 20;

export function archetypeForAbuelo(abueloState) {
  let best = null, bestVal = 0;
  for (const [stat, val] of Object.entries(abueloState.bonus || {})) {
    if (val > bestVal) { bestVal = val; best = stat; }
  }
  if (!best || bestVal < MIN_BONUS_TO_QUALIFY) return null;
  return { stat: best, ...ABUELO_ARCHETYPES[best] };
}
