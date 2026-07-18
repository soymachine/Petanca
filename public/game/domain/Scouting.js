import { SCOUT_TEMPLATES } from '../data/scouts.js';
import { TransferPool } from './TransferPool.js';
import { clamp } from '../core/utils.js';

function templateOf(id) { return SCOUT_TEMPLATES.find((t) => t.id === id); }

// rango de nivel 0-100 que calcula un ojeador para un jugador que acaba de
// descubrir: el nivel real SIEMPRE cae dentro de la banda, pero dónde
// exactamente (cerca del extremo bajo, del alto, o en medio) es al azar —
// un ojeador flojo no sabe si el "67-85" que apunta está más cerca del 67
// o del 85; solo uno bueno acota de verdad la incertidumbre.
export function rollLevelRange(trueLevel, width) {
  const w = Math.min(100, Math.max(1, width));
  const offset = Math.random() * w; // dónde cae el nivel real dentro de la banda
  const lo = clamp(Math.round(trueLevel - offset), 0, 100 - w);
  return { lo, hi: lo + w };
}

// avanza una semana de ojeo para toda la plantilla del jugador: reparte
// descubrimientos nuevos (ojeadores en modo país) y revela stats/potencial
// reales (ojeadores en modo jugador que ya cumplieron su plazo). Se llama
// una vez por semana simulada, igual que TransferPool.simulateWeeklyMarket
// (ver Career.js) — misma cadencia, mismo sitio.
export function advanceScoutingWeek(player, currentWeek) {
  const staff = player.scoutStaff;
  const listings = TransferPool.globalListings(player.leagueWorld, player.foreignLeagues);

  for (const h of staff.hired) {
    const tpl = templateOf(h.templateId);
    if (!tpl) continue;

    if (h.mode === 'country') {
      if (h.lastDiscoveryWeek === null || currentWeek - h.lastDiscoveryWeek < tpl.weeksPerDiscovery) continue;
      const candidates = listings.filter((l) => l.player.nationality.code === h.country && !l.player.discovered);
      if (!candidates.length) continue; // nada nuevo que descubrir esta semana: se reintenta la que viene
      const pick = candidates[Math.floor(Math.random() * candidates.length)].player;
      pick.discovered = true;
      pick.levelRange = rollLevelRange(pick.level100, tpl.rangeWidth);
      h.lastDiscoveryWeek = currentWeek;
      player.news.push(`OJEO: vuestro ojeador en ${h.country} destapa a ${pick.name} — nivel estimado ${pick.levelRange.lo}-${pick.levelRange.hi}.`);
    } else if (h.mode === 'player') {
      if (h.assignedWeek === null || currentWeek - h.assignedWeek < tpl.weeksToReveal) continue;
      const listing = listings.find((l) => `t${l.player.id}` === h.assignedTo);
      if (listing) {
        listing.player.statsRevealed = true;
        player.news.push(`INFORME COMPLETO: ya conocéis todas las stats reales de ${listing.player.name}.`);
      } else {
        const fa = player.freeAgents.agents.find((a) => `f${a.id}` === h.assignedTo);
        if (fa) {
          fa.potentialRevealed = true;
          player.news.push(`INFORME COMPLETO: ya conocéis el potencial real de ${fa.name}.`);
        }
      }
      staff.unassign(h.id);
    }
  }
}

// claves válidas HOY en el Mercado (excedentes en venta + Sin Equipo), para
// soltar a los ojeadores en modo jugador cuyo objetivo ya no está — ver
// ScoutStaff.pruneAssignments
export function currentMarketSeedKeys(player) {
  const keys = new Set();
  for (const l of TransferPool.globalListings(player.leagueWorld, player.foreignLeagues)) keys.add(`t${l.player.id}`);
  for (const fa of player.freeAgents.agents) keys.add(`f${fa.id}`);
  return keys;
}
