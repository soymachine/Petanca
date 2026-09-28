#!/usr/bin/env node
// Partida simulada y DETERMINISTA (Math.random con semilla, Date.now fijo)
// para demostrar que un cambio de vista/entrada no altera el motor del
// partido (docs/REDISENO.md, Fase 3): se juega sola con ENTER automático y
// potencia ~0.55, e imprime el estado final (marcador, bolas).
//
// Uso:
//   node tools/replay-match.mjs [raíz-del-repo] [semilla]
// Comparar contra la versión anterior:
//   git worktree add /tmp/petanka-head HEAD
//   for s in 1 2 3; do
//     diff <(node tools/replay-match.mjs /tmp/petanka-head $s) <(node tools/replay-match.mjs . $s) && echo "semilla $s OK"
//   done
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(process.argv[2] || '.');
let seed = Number(process.argv[3] || 12345) | 0;
Date.now = () => 1700000000000;
Math.random = () => {
  seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const mod = (p) => import(pathToFileURL(`${root}/public/game/${p}`).href);
const { Player } = await mod('model/Player.js');
const { Match } = await mod('match/Match.js');
const { WeeklyMatchContext } = await mod('domain/WeeklyMatchContext.js');

const p = new Player();
const league = p.league;
const opp = league.clubs.find((c) => !c.isPlayer);
const M = new Match({ tournament: new WeeklyMatchContext(league, opp, p.money, null, null), roster: p.roster, team: [0] });
M.setNameProvider((id) => `a${id}`);
const throws = [];
const orig = M.throwBall.bind(M);
M.throwBall = (...a) => { throws.push(a.map((v) => (typeof v === 'number' ? +v.toFixed(5) : v))); return orig(...a); };

const DT = 1 / 60;
const inp = (press) => ({ hit: (k) => press && k === 'Enter', held: () => false });
let frame = 0;
for (let t = 0; t < 400 && !M._finished; t += DT) {
  frame++; M.tickFrame(frame);
  const ph = M.phase;
  const bar = (ph === 'power' || ph === 'jackPower') && M.power > 0.5 && M.power < 0.6 && M.powerDir > 0;
  const ok = ['roundStart', 'jackAim', 'aim', 'spin', 'loft'].includes(ph) && M.phaseT > 0.1;
  const adv = ['throwDone', 'roundEnd', 'matchEnd'].includes(ph) && M.phaseT > 1.3;
  M.update(DT, inp(bar || ok || adv));
}
console.log(JSON.stringify({ scoreP: M.scoreP, scoreA: M.scoreA, round: M.round, phase: M.phase, finished: !!M._finished }));
for (const b of M.balls) console.log(JSON.stringify([b.owner, +b.x.toFixed(4), +b.y.toFixed(4)]));
for (const th of throws) console.log(JSON.stringify(th));
