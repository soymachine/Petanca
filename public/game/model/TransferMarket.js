import { rnd } from '../core/utils.js';
import { ABUELO_DATA } from '../data/abuelos.js';
import { PENAS_LIGA } from '../data/cities.js';

// Mercado de fichajes: de vez en cuando una peña rival intenta comprarte a
// un abuelo. Puedes rechazar (se queda en la peña) o vender (dinero al bolsillo).
export class TransferMarket {
  rollOffer(roster) {
    if (roster.length <= 1 || Math.random() > 0.12) return null;
    const id = roster[Math.floor(rnd(0, roster.length))];
    const base = ABUELO_DATA[id].price || 200;
    const amount = Math.round(base * rnd(0.9, 1.5));
    const buyer = PENAS_LIGA[Math.floor(rnd(0, PENAS_LIGA.length))];
    return { id, amount, buyer };
  }
}
