// Frases de informe de ojeador: convierten una stat revelada (1-10) en un
// juicio cualitativo, para dar sabor al mercado además del número pelado.
export const SCOUT_PHRASES = {
  pulso: [
    [1, 'no da una a derechas, para qué engañarnos'],
    [3, 'anda flojo de puntería'],
    [5, 'tiene un pulso correcto, sin más'],
    [7, 'apunta con oficio, se nota que ha rodado'],
    [9, 'apunta con un pulso que da gusto ver'],
    [10, 'tiene un pulso de cirujano'],
  ],
  brazo: [
    [1, 'no mueve una bola ni empujándola'],
    [3, 'casi no tiene potencia de tiro'],
    [5, 'tira con un brazo decente'],
    [7, 'pega fuerte cuando hace falta'],
    [9, 'tiene brazo de verdad para tirar'],
    [10, 'derriba lo que toca de un golpe'],
  ],
  mana: [
    [1, 'tira la bola como si no supiera lo que es el efecto'],
    [3, 'no controla nada el efecto de la bola'],
    [5, 'se maneja con el efecto, normalito'],
    [7, 'le saca partido al efecto cuando conviene'],
    [9, 'sabe curvar la bola con oficio'],
    [10, 'es un artista del efecto'],
  ],
  temple: [
    [1, 'se descompone en cuanto aprieta el marcador'],
    [3, 'se pone muy nervioso si aprieta el marcador'],
    [5, 'tiene un temple aceptable'],
    [7, 'no se le nota el pulso ni en los puntos importantes'],
    [9, 'se queda frío como el hielo en los momentos clave'],
    [10, 'tiene nervios de acero'],
  ],
  aguante: [
    [1, 'se apaga a la primera de cambio'],
    [3, 'se cansa enseguida'],
    [5, 'aguanta lo normal'],
    [7, 'tira igual de bien en la última bola que en la primera'],
    [9, 'no se fatiga fácilmente'],
    [10, 'es una máquina de aguante'],
  ],
};

export function scoutPhraseFor(statKey, value) {
  const tiers = SCOUT_PHRASES[statKey];
  for (const [max, phrase] of tiers) if (value <= max) return phrase;
  return tiers[tiers.length - 1][1];
}
