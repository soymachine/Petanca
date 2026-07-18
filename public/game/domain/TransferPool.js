import { clamp } from '../core/utils.js';

// caché de globalListings(): PenyaScreen la llama en CADA frame que el
// Mercado está en pantalla (60/seg) para recorrer 8 ligas españolas + 15
// ligas extranjeras enteras — carísimo para algo que solo cambia cuando de
// verdad se ficha o se mueve el mercado semanal. Se invalida por versión,
// no por tiempo: cualquier operación que cambie quién está en venta
// (compra humana o ciclo semanal IA) incrementa `_version`, y la caché
// comprueba también que sea el mismo par leagueWorld/foreignLeagues (así
// una partida cargada, con objetos nuevos, no reutiliza datos de otra).
let _version = 0;
let _cacheWorld = null, _cacheForeign = null, _cacheVersion = -1, _cacheResult = null;

// El Mercado global: no genera candidatos de la nada — es una vista sobre
// los excedentes reales (jugadores `forSale`) de todos los clubes IA, de
// las 8 ligas españolas y de las 3 ligas de fondo de cada país extranjero
// (Francia, Italia, Bélgica, Suiza, Portugal). Fichar a uno de verdad saca
// a ese jugador de su club de origen y mueve dinero real entre clubes: el
// vendedor gana, el comprador gasta.
export class TransferPool {
  // recorre todas las ligas (española + una liga de fondo por cada país
  // extranjero) y devuelve cada jugador en venta junto al club y la liga a
  // la que pertenece
  static globalListings(leagueWorld, foreignLeagues) {
    if (_cacheWorld === leagueWorld && _cacheForeign === foreignLeagues && _cacheVersion === _version) {
      return _cacheResult;
    }
    const out = [];
    for (const [, league] of leagueWorld.leagues) {
      for (const club of league.clubs) {
        if (club.isPlayer) continue;
        for (const p of club.players) if (p.forSale) out.push({ player: p, club, league });
      }
    }
    for (const world of foreignLeagues.values()) {
      for (const [, league] of world.leagues) {
        for (const club of league.clubs) {
          for (const p of club.players) if (p.forSale) out.push({ player: p, club, league });
        }
      }
    }
    _cacheWorld = leagueWorld; _cacheForeign = foreignLeagues; _cacheVersion = _version; _cacheResult = out;
    return out;
  }

  static findListing(leagueWorld, foreignLeagues, playerId) {
    return TransferPool.globalListings(leagueWorld, foreignLeagues).find((l) => l.player.id === playerId) || null;
  }

  // el jugador humano ficha a `listing.player`: dinero real del comprador
  // al vendedor, el jugador sale de la plantilla de origen para siempre
  static buyForHuman(listing, buyerMoney) {
    const club = listing.club;
    club.money += listing.player.value;
    club.players = club.players.filter((p) => p !== listing.player);
    listing.player.forSale = false;
    _version++;
    return buyerMoney - listing.player.value;
  }

  // ciclo semanal de compraventa 100% IA entre clubes de cualquier liga
  // (española o de cualquier país extranjero): un club con 2 jugadores que
  // necesita refuerzo compra el excedente más barato que se pueda permitir
  // de un club con 3; el vendedor gana esa plaza (vuelve a 2) y el
  // comprador se queda con 3 (y, más adelante, con su propio excedente que
  // sacar al mercado).
  static simulateWeeklyMarket(leagueWorld, foreignLeagues) {
    const clubsWithLeague = [];
    for (const [, league] of leagueWorld.leagues) {
      for (const club of league.clubs) if (!club.isPlayer) clubsWithLeague.push({ club, league });
    }
    for (const world of foreignLeagues.values()) {
      for (const [, league] of world.leagues) {
        for (const club of league.clubs) clubsWithLeague.push({ club, league });
      }
    }

    const buyers = clubsWithLeague.filter(({ club }) => club.players.length === 2);
    for (const { club: buyer, league } of buyers) {
      if (Math.random() > buyMotivation(buyer, league)) continue;

      const sellers = clubsWithLeague.filter(({ club }) => club.players.length === 3 && club !== buyer);
      let best = null;
      for (const { club: seller, league: sellerLeague } of sellers) {
        const listing = seller.players.find((p) => p.forSale);
        if (!listing || listing.value > buyer.money) continue;
        if (Math.random() > sellMotivation(seller, sellerLeague)) continue;
        if (!best || listing.value < best.listing.value) best = { seller, listing };
      }
      if (!best) continue;

      buyer.money -= best.listing.value;
      best.seller.money += best.listing.value;
      best.seller.players = best.seller.players.filter((p) => p !== best.listing);
      best.listing.forSale = false;
      best.listing.clubId = buyer.id;
      buyer.players.push(best.listing);
      // el comprador llega a 3 y hereda el mismo excedente que tenía el
      // vendedor: sin esto, `forSale` solo se concedía una vez al generar
      // la liga y el mercado se iba secando trade a trade hasta llegar a
      // cero para siempre — así el ciclo de venta/compra se sostiene solo
      if (buyer.players.length === 3) {
        buyer.players[Math.floor(Math.random() * 3)].forSale = true;
      }
      _version++;
    }
  }
}

// motivación de compra: cuanto más flojo va un club en su liga, más ganas
// de reforzarse — moderado por si de verdad tiene caja para permitírselo
function buyMotivation(club, league) {
  const rank = league.standings().findIndex((c) => c.id === club.id) + 1;
  const ambition = rank / Math.max(1, league.clubs.length); // ~1 = colista, motivado
  const richEnough = clamp(club.money / 250, 0, 1);
  return clamp(0.04 + ambition * 0.22 * richEnough, 0.02, 0.3);
}

// motivación de venta: un club que anda mal de caja (o mal en la tabla,
// necesita sanear cuentas) suelta antes su excedente
function sellMotivation(club, league) {
  const rank = league.standings().findIndex((c) => c.id === club.id) + 1;
  const strugglingTable = rank / Math.max(1, league.clubs.length);
  const needsCash = clamp(1 - club.money / 200, 0, 1);
  return clamp(0.1 + needsCash * 0.3 + strugglingTable * 0.15, 0.1, 0.55);
}
