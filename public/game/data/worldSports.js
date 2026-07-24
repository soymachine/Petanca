import { nationalityByCode } from './names.js';
import { countryLabel } from './countries.js';
import { mulberry32, hashStr } from '../core/utils.js';

// World of Sports: el semanario de fondo de la Hemeroteca. A diferencia de
// El Eco de la Peña (un único titular real, camuflado entre relleno), aquí
// no hay nada que esconder — 2-3 párrafos legibles por edición, mezclando
// datos REALES (las ligas de fondo se simulan de verdad cada semana, ver
// Career.js `_simulateLeagueMatchday`/`_simulateRestOfMatchday`, así que
// resultados y clasificaciones existen aunque el jugador nunca las mire)
// con rumores/situaciones inventadas para dar sabor, igual que el resto de
// sistemas de "color" del juego (rivalPersonality.js, boardPresident.js...).
// Todo determinista por número de edición: la misma página siempre
// devuelve el mismo contenido mientras el estado de fondo no cambie.

// todas las ligas de fondo que NO son la que juega el usuario ahora mismo:
// el resto de niveles de su propia pirámide + las 3 de cada país extranjero
function backgroundLeagues(player) {
  const out = [];
  for (const [level, league] of player.leagueWorld.leagues) {
    if (level === player.currentLeagueLevel) continue;
    out.push({ league, countryCode: player.homeCountry });
  }
  for (const [code, world] of player.foreignLeagues) {
    for (const [, league] of world.leagues) out.push({ league, countryCode: code });
  }
  return out;
}

function cityLabel(entry, homeCountry) {
  const tag = entry.countryCode !== homeCountry ? ` (${countryLabel(entry.countryCode)})` : '';
  return `${entry.league.cityName}${tag}`;
}

function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

// un resultado real de la última jornada jugada en una liga de fondo
// cualquiera — null si a esa liga (recién generada) todavía no le ha dado
// tiempo a jugar ni una jornada
function resultParagraph(rng, entries, homeCountry) {
  const withResults = entries.filter((e) => e.league.matchday > 0 && e.league.resultsForMatchday(e.league.matchday - 1).length);
  if (!withResults.length) return null;
  const entry = pick(rng, withResults);
  const results = entry.league.resultsForMatchday(entry.league.matchday - 1);
  const r = pick(rng, results);
  const clubA = entry.league.clubById(r.a), clubB = entry.league.clubById(r.b);
  if (!clubA || !clubB) return null;
  const [winner, loser, ws, ls] = r.scoreA >= r.scoreB ? [clubA, clubB, r.scoreA, r.scoreB] : [clubB, clubA, r.scoreB, r.scoreA];
  const verb = pick(rng, ['vence a', 'se impone a', 'derrota a', 'supera a']);
  return `RESULTADOS EN ${cityLabel(entry, homeCountry)}: ${winner.name} ${verb} ${loser.name} por ${ws}-${ls}.`;
}

// clasificación real de una liga de fondo cualquiera: quién manda arriba,
// o quién se juega el descenso abajo (alternando al azar cuál de las dos
// contar, para que no salga siempre lo mismo)
function standingsParagraph(rng, entries, homeCountry) {
  const withGames = entries.filter((e) => e.league.clubs.some((c) => c.played > 0));
  if (!withGames.length) return null;
  const entry = pick(rng, withGames);
  const standings = entry.league.standings();
  const label = cityLabel(entry, homeCountry);
  if (rng() < 0.5) {
    const leader = standings[0];
    return `En la liga de ${label}, ${leader.name} manda con contundencia arriba de la tabla con ${leader.pts} puntos.`;
  }
  const zone = standings.slice(-3);
  const bottom = zone[0];
  return `Se calienta el descenso en ${label}: ${bottom.name} pelea la permanencia con ${bottom.pts} puntos y pocas jornadas ya para enderezarlo.`;
}

// rumor/fichaje fabricado con un nombre real de la pool de nombres del país
// de esa liga — mismo estilo que el resto de "color" del mercado
function transferParagraph(rng, entries, homeCountry) {
  if (!entries.length) return null;
  const entry = pick(rng, entries);
  const club = pick(rng, entry.league.clubs);
  const nat = nationalityByCode(entry.countryCode);
  const playerName = pick(rng, nat.names);
  const label = cityLabel(entry, homeCountry);
  if (rng() < 0.5) {
    return `RUMOR DE FICHAJE: ${club.name} (${label}) estaría negociando con ${playerName}, según fuentes cercanas al club.`;
  }
  const otherClub = pick(rng, entry.league.clubs.filter((c) => c !== club)) || club;
  return `FICHAJE CONFIRMADO: ${club.name} (${label}) anuncia la incorporación de ${playerName}, procedente de ${otherClub.name}.`;
}

// situaciones sueltas de otros clubes: pura ambientación, sin ningún dato
// que el jugador pueda usar — mismo espíritu que rivalPersonality.js
const SITUATION_TEMPLATES = [
  (c) => `CRISIS EN ${c.label}: la directiva de ${c.club} estudia un cambio de capitán tras varias jornadas flojas.`,
  (c) => `${c.club}, de ${c.label}, celebra por todo lo alto su aniversario con una exhibición que llenó la plaza.`,
  (c) => `El tiempo trastoca el calendario en ${c.label}: ${c.club} pide aplazar su próximo partido por el temporal.`,
  (c) => `Sorpresa en ${c.label}: un veterano de ${c.club} anuncia que se retira al final de temporada entre aplausos.`,
  (c) => `${c.club} (${c.label}) estrena nuevo patrocinador de camiseta, con fiesta incluida en la sede del club.`,
  (c) => `Polémica arbitral en ${c.label}: ${c.club} protesta una medición muy discutida en el último partido.`,
  (c) => `Cantera en ${c.label}: ${c.club} presenta a su nueva hornada de juveniles con mucha ilusión puesta en ellos.`,
];

function situationParagraph(rng, entries, homeCountry) {
  if (!entries.length) return null;
  const entry = pick(rng, entries);
  const club = pick(rng, entry.league.clubs);
  const tpl = pick(rng, SITUATION_TEMPLATES);
  return tpl({ club: club.name, label: cityLabel(entry, homeCountry) });
}

// genera el contenido de una edición: 2-3 párrafos, deterministas por
// número de edición mientras el estado de las ligas de fondo no cambie
// (avanza cada semana jugada, ver HemerotecaScreen — se recalcula al vuelo,
// no se guarda en el save)
export function worldSportsEdition(player, editionIndex) {
  const entries = backgroundLeagues(player);
  const rng = mulberry32(hashStr(`world-sports-${editionIndex}`));
  const generators = [resultParagraph, standingsParagraph, transferParagraph, situationParagraph];
  const count = 2 + (rng() < 0.5 ? 1 : 0);
  const paragraphs = [];
  const order = generators.slice().sort(() => rng() - 0.5);
  for (const gen of order) {
    if (paragraphs.length >= count) break;
    const p = gen(rng, entries, player.homeCountry);
    if (p) paragraphs.push(p);
  }
  if (!paragraphs.length) paragraphs.push('Semana tranquila en el resto de ligas: nada reseñable que contar por ahora.');
  return paragraphs;
}
