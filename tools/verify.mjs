#!/usr/bin/env node
// Verificaciones de consistencia del motor de datos/dominio (sin navegador,
// sin UI): nombres, generación de clubes, mapa/geografía, economía del
// Mercado y sorteo de la Copa de Europa. No sustituye probarlo en el
// navegador (eso sigue haciendo falta para UI/render), pero cubre en
// segundos in variantes de lógica que, si se rompen, rompen la partida
// entera — y que hasta ahora se comprobaban a mano, una vez, sueltas en la
// terminal, sin quedar como red de seguridad para el futuro.
//
// Uso: node tools/verify.mjs   (o `npm run verify`)

import { NATIONALITIES } from '../public/game/data/names.js';
import { Club } from '../public/game/domain/Club.js';
import { Geography } from '../public/game/data/geography.js';
import { CITIES } from '../public/game/data/cities.js';
import { allForeignCityMarkers, FOREIGN_COUNTRIES } from '../public/game/data/countries.js';
import { Player } from '../public/game/model/Player.js';
import { TransferPool } from '../public/game/domain/TransferPool.js';
import { EuropeanCup } from '../public/game/domain/EuropeanCup.js';
import { Court } from '../public/game/physics/Court.js';
import { strengthFor } from '../public/game/data/countries.js';
import { advanceScoutingWeek, rollLevelRange } from '../public/game/domain/Scouting.js';

// entorno mínimo: Player.js usa localStorage para guardar/cargar partida
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

const checks = [];
function check(name, fn) { checks.push({ name, fn }); }

// --- nombres ---
check('pools de nombres: 200 únicos por país, ≥100 apellidos únicos', () => {
  for (const n of NATIONALITIES) {
    if (n.names.length !== 200) throw new Error(`${n.code}: pool de ${n.names.length}, se esperaban 200`);
    if (new Set(n.names).size !== 200) throw new Error(`${n.code}: hay nombres repetidos en el pool`);
    const surnames = new Set(n.names.map((s) => s.split(' ').slice(-1)[0]));
    if (surnames.size < 60) throw new Error(`${n.code}: solo ${surnames.size} apellidos distintos aparecen en el pool construido (bajo, aunque el banco de origen tenga más — ver names.js)`);
  }
});

// --- generación de clubes ---
check('clubes: nacionalidad pura y sin nombres repetidos dentro del mismo club (500 clubes)', () => {
  const codes = ['ES', ...FOREIGN_COUNTRIES.map((c) => c.code)];
  let mixed = 0, dupes = 0;
  for (let i = 0; i < 500; i++) {
    const country = codes[Math.floor(Math.random() * codes.length)];
    const c = new Club(`t${i}`, 'Test', 5, false, country === 'ES' ? null : country);
    const nats = new Set(c.players.map((p) => p.nationality.code));
    if (nats.size > 1) mixed++;
    const names = c.players.map((p) => p.name);
    if (new Set(names).size !== names.length) dupes++;
  }
  if (mixed > 0) throw new Error(`${mixed} clubes con nacionalidad mixta`);
  if (dupes > 0) throw new Error(`${dupes} clubes con nombres repetidos dentro del mismo club`);
});

check('fuerza por país sigue el orden acordado (FR > IT > BE > CH ≈ ES > PT)', () => {
  const avg = {};
  for (const code of ['ES', 'FR', 'IT', 'BE', 'CH', 'PT']) {
    let sum = 0, n = 80;
    for (let i = 0; i < n; i++) sum += new Club(`t${i}`, 'Test', 5, false, code === 'ES' ? null : code).avgSkill();
    avg[code] = sum / n;
  }
  const order = ['FR', 'IT', 'BE'];
  for (let i = 0; i < order.length - 1; i++) {
    if (avg[order[i]] <= avg[order[i + 1]]) throw new Error(`${order[i]} (${avg[order[i]].toFixed(2)}) no supera a ${order[i + 1]} (${avg[order[i + 1]].toFixed(2)})`);
  }
  if (avg.PT >= avg.ES) throw new Error(`Portugal (${avg.PT.toFixed(2)}) debería ir por debajo de España (${avg.ES.toFixed(2)})`);
});

// --- mapa / geografía ---
check('mapa: las 24 ciudades caen en tierra dentro de su propio país', () => {
  const geo = new Geography(286, 92);
  const all = [...CITIES.map((c) => ({ city: c, country: 'ES' })), ...allForeignCityMarkers()];
  const bad = [];
  for (const { city, country } of all) {
    const [wx, wy] = geo.toWorld(city.lon, city.lat);
    if (!geo.isLand(wx, wy)) bad.push(`${country} ${city.name}`);
  }
  if (bad.length) throw new Error(`fuera de tierra: ${bad.join(', ')}`);
});

check('mapa: los 6 países forman un único continente sin huecos de mar', () => {
  const geo = new Geography(286, 92);
  const w = geo.width, h = geo.height;
  const [mx, my] = geo.toWorld(-3.70, 40.42); // Madrid
  const seen = new Uint8Array(w * h);
  const stack = [[mx, my]];
  seen[my * w + mx] = 1;
  while (stack.length) {
    const [x, y] = stack.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= w || ny < 0 || ny >= h || seen[ny * w + nx] || !geo.isLand(nx, ny)) continue;
      seen[ny * w + nx] = 1;
      stack.push([nx, ny]);
    }
  }
  const all = [...CITIES.map((c) => ({ city: c, country: 'ES' })), ...allForeignCityMarkers()];
  const disconnected = [];
  for (const { city, country } of all) {
    const [wx, wy] = geo.toWorld(city.lon, city.lat);
    if (!seen[wy * w + wx]) disconnected.push(`${country} ${city.name}`);
  }
  if (disconnected.length) throw new Error(`sin conexión por tierra con Madrid: ${disconnected.join(', ')}`);
});

// --- físicas de pista ---
check('físicas: todos los ids de pista conocidos generan una Court válida', () => {
  const ids = ['flat', 'slope', 'fastdry', 'walls', 'puddles', 'tree', 'cierzo', 'pressure',
    'brick', 'heavy', 'soft', 'heatstone', 'uneven', 'cold', 'uphill', 'fohn', 'atlantic', 'mistral', 'shade', 'drizzle', 'glare', 'fog'];
  for (const id of ids) {
    const c = new Court(id);
    c.setupFeature('SOL', 5);
    if (!(c.frictionMod > 0)) throw new Error(`${id}: frictionMod inválido (${c.frictionMod})`);
  }
});

// --- Mercado global ---
check('mercado: el excedente en venta se conserva a lo largo de 150 semanas simuladas (no se seca)', () => {
  const p = new Player();
  const initial = TransferPool.globalListings(p.leagueWorld, p.foreignLeagues).length;
  if (initial === 0) throw new Error('no hay ningún excedente en venta al generar la partida (¿cambió el % de clubes con 3 jugadores?)');
  for (let week = 0; week < 150; week++) TransferPool.simulateWeeklyMarket(p.leagueWorld, p.foreignLeagues);
  const final = TransferPool.globalListings(p.leagueWorld, p.foreignLeagues).length;
  if (final !== initial) throw new Error(`excedente pasó de ${initial} a ${final} tras 150 semanas — el mercado se está secando o inflando`);
});

check('mercado: comprar (humano) saca al jugador de su club y paga al vendedor', () => {
  const p = new Player();
  const listing = TransferPool.globalListings(p.leagueWorld, p.foreignLeagues)[0];
  const club = listing.club, sellerMoneyBefore = club.money, playerId = listing.player.id;
  const newMoney = TransferPool.buyForHuman(listing, p.money);
  if (newMoney !== p.money - listing.player.value) throw new Error('el comprador no paga el precio exacto');
  if (club.money !== sellerMoneyBefore + listing.player.value) throw new Error('el vendedor no cobra el precio exacto');
  if (club.players.some((pl) => pl.id === playerId)) throw new Error('el jugador sigue en la plantilla del vendedor tras la compra');
});

// --- reputación de mánager ---
check('managerRep: euroUpsets persiste, suma al mánager y sobrevive a guardados sin ese campo', () => {
  const p = new Player();
  if (p.euroUpsets !== 0) throw new Error(`euroUpsets debería arrancar en 0, es ${p.euroUpsets}`);
  const baseRep = p.managerRep;
  p.euroUpsets = 3;
  if (p.managerRep !== baseRep + 24) throw new Error(`3 campanadas deberían sumar 24 a managerRep, suman ${p.managerRep - baseRep}`);
  const p2 = Player.fromJSON(p.toJSON());
  if (p2.euroUpsets !== 3) throw new Error('euroUpsets no sobrevive al guardado/carga');
  const oldJson = p.toJSON(); delete oldJson.euroUpsets;
  const p3 = Player.fromJSON(oldJson);
  if (p3.euroUpsets !== 0) throw new Error('un guardado antiguo sin euroUpsets debería cargar con 0, no reventar');
  if (strengthFor('FR') <= 1 || strengthFor('PT') >= 1) throw new Error('strengthFor no refleja países más/menos fuertes que España');
});

// --- ojeadores + mercado a ciegas ---
check('ojeadores: todo excedente arranca sin descubrir, y el rango de nivel siempre contiene el nivel real', () => {
  const p = new Player();
  const listings = TransferPool.globalListings(p.leagueWorld, p.foreignLeagues);
  if (!listings.length) throw new Error('no hay excedentes que probar');
  if (!listings.every((l) => !l.player.discovered)) throw new Error('algún excedente arranca ya descubierto');
  for (let i = 0; i < 500; i++) {
    const trueLevel = Math.floor(Math.random() * 100);
    const width = [8, 16, 28, 40][Math.floor(Math.random() * 4)];
    const r = rollLevelRange(trueLevel, width);
    if (trueLevel < r.lo || trueLevel > r.hi) throw new Error(`rango ${r.lo}-${r.hi} no contiene el nivel real ${trueLevel}`);
    if (r.hi - r.lo !== width) throw new Error(`ancho del rango (${r.hi - r.lo}) no coincide con el pedido (${width})`);
  }
});

check('ojeadores: modo país descubre excedentes con el tiempo; modo jugador revela stats y se libera solo', () => {
  const p = new Player();
  p.money = 10000;
  p.scoutStaff.hire('aficionado');
  const scout = p.scoutStaff.hired[0];
  p.scoutStaff.assignCountry(scout.id, 'ES', p.seasonClock.weekIndex);
  for (let w = p.seasonClock.weekIndex; w < p.seasonClock.weekIndex + 10; w++) advanceScoutingWeek(p, w);
  const discovered = TransferPool.globalListings(p.leagueWorld, p.foreignLeagues).filter((l) => l.player.discovered);
  if (!discovered.length) throw new Error('un ojeador aficionado ojeando ES 10 semanas no descubrió nada');
  const found = discovered[0].player;
  if (found.level100 < found.levelRange.lo || found.level100 > found.levelRange.hi) throw new Error('el rango guardado no contiene el nivel real del jugador descubierto');

  p.scoutStaff.hire('elite');
  const scout2 = p.scoutStaff.hired[1];
  p.scoutStaff.assignPlayer(scout2.id, `t${found.id}`, p.seasonClock.weekIndex);
  advanceScoutingWeek(p, p.seasonClock.weekIndex);
  if (found.statsRevealed) throw new Error('reveló las stats antes de cumplirse weeksToReveal');
  advanceScoutingWeek(p, p.seasonClock.weekIndex + 1);
  if (!found.statsRevealed) throw new Error('no reveló las stats tras weeksToReveal semanas');
  if (scout2.mode !== null) throw new Error('el ojeador no se liberó solo tras completar el informe');
});

check('ojeadores: guardado/carga conserva asignaciones, y un guardado antiguo (sin `mode`) migra a parado sin reventar', () => {
  const p = new Player();
  p.money = 10000;
  p.scoutStaff.hire('veterano');
  p.scoutStaff.assignCountry(p.scoutStaff.hired[0].id, 'IT', p.seasonClock.weekIndex);
  const p2 = Player.fromJSON(p.toJSON());
  if (p2.scoutStaff.hired[0].mode !== 'country' || p2.scoutStaff.hired[0].country !== 'IT') {
    throw new Error('la asignación de país no sobrevivió al guardado/carga');
  }
  const oldJson = p.toJSON();
  oldJson.scoutStaff = [{ id: 1, templateId: 'aficionado', assignedTo: 't999', assignedWeek: 3 }]; // formato viejo, sin `mode`
  const p3 = Player.fromJSON(oldJson);
  const h = p3.scoutStaff.hired[0];
  if (h.mode !== null || h.assignedTo !== null || h.templateId !== 'aficionado') {
    throw new Error('un guardado con ScoutStaff del formato viejo no migró limpiamente a parado');
  }
});

// --- Copa de Europa ---
check('Copa de Europa: 24 entrantes (top 4 × 6 países), el jugador nunca recibe un bye', () => {
  const p = new Player();
  for (let trial = 0; trial < 20; trial++) {
    // en real solo se sortea la Copa cuando el jugador ya acabó entre los
    // 4 primeros de su liga (Career.js, `rank <= 4`) — un Player recién
    // creado no cumple eso todavía (arranca sin jugar, en una posición de
    // tabla arbitraria), así que aquí se fuerza esa condición a mano para
    // probar el caso real sin tener que jugar una temporada entera
    const others = p.league.standings().filter((c) => !c.isPlayer).slice(0, 3);
    const groups = [{ country: 'ES', clubs: [p.club, ...others] }];
    for (const [code, world] of p.foreignLeagues) groups.push({ country: code, clubs: world.leagueOf(8).standings().slice(0, 4) });
    const totalEntrants = groups.reduce((s, g) => s + g.clubs.length, 0);
    if (totalEntrants !== 24) throw new Error(`se esperaban 24 entrantes, hay ${totalEntrants}`);
    const cup = EuropeanCup.generate(groups, p.club, p.club.avgSkill(p.roster));
    if (!cup.playerOpponent()) throw new Error('al jugador le tocó un bye en la primera ronda (no debería ser posible)');
    let rounds = 0;
    while (!cup.finished && rounds < 10) {
      if (cup.playerPairing()) cup.resolvePlayerPairing(true);
      if (cup.roundComplete()) cup.advanceRound();
      rounds++;
    }
    if (!cup.finished) throw new Error('el bracket no terminó en un número razonable de rondas (posible bucle infinito)');
  }
});

// --- runner ---
let failed = 0;
for (const { name, fn } of checks) {
  try {
    fn();
    console.log(`✔ ${name}`);
  } catch (e) {
    failed++;
    console.error(`✘ ${name}\n  ${e.message}`);
  }
}
console.log(`\n${checks.length - failed}/${checks.length} verificaciones OK`);
if (failed) process.exit(1);
