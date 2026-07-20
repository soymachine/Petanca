// Consumibles de un solo uso EN PARTIDO: a diferencia de los amuletos de
// data/items.js (uno por abuelo, equipado para siempre hasta que se
// cambia), estos son existencias de club — se compran en El Bar, se
// gastan de uno en uno durante un partido de verdad (nunca en
// entrenamiento/práctica) y como mucho MAX_PER_MATCH veces por partido,
// para que sigan siendo un extra especial y no un simple botón "gana
// gratis" en cuanto se tienen unos cuantos comprados.
export const CONSUMABLES = {
  tila: { name: 'TILA DE LA JUNTA', short: 'TILA', price: 60, hotkey: '1',
    desc: 'Antes de una tirada importante: anula la presión del marcador (y la de Madrid) en esa tirada.' },
  gel: { name: 'GEL ENERGÉTICO', short: 'GEL', price: 70, hotkey: '2',
    desc: 'Recupera de golpe 25 de aguante al abuelo que tira ahora mismo.' },
  talco: { name: 'TALCO DE AGARRE', short: 'TALCO', price: 50, hotkey: '3',
    desc: 'Agarre garantizado en la próxima tirada: ignora charcos y suelo mojado.' },
  bravo: { name: 'A POR TODAS', short: 'BRAVO', price: 90, hotkey: '4',
    desc: 'Vas sin red: más temblor en la mano, pero potencia y efecto al máximo en esta tirada.' },
};
export const CONSUMABLE_IDS = Object.keys(CONSUMABLES);
export const MAX_CONSUMABLES_PER_MATCH = 2;

export function emptyConsumableStock() {
  const stock = {};
  for (const id of CONSUMABLE_IDS) stock[id] = 0;
  return stock;
}
