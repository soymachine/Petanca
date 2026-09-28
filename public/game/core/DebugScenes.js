// Escenas de depuración por URL: `?scene=<id>` arranca el juego ya
// colocado en una pantalla o en un momento concreto del partido, y
// `&freeze=1` congela ahí la simulación (el dibujo sigue: parpadeos,
// viento...). Sirve para capturar cualquier pantalla sin interacción
// (ver tools/shots.mjs) y para revisar el rediseño visual (ver
// docs/REDISENO.md). En modo escena NUNCA se guarda la partida, para no
// pisar la del usuario si abre una de estas URLs en su navegador.
import { EuropeanCup } from '../domain/EuropeanCup.js';
import { DECISION_EVENTS } from '../data/decisionEvents.js';
import { Settings } from './Settings.js';

// pantallas que solo necesitan cambiar de estado (id de escena = estado)
const PLAIN = ['title', 'ajustes', 'hub', 'agenda', 'penya', 'club', 'leaguemap', 'bar', 'capitulos', 'hemeroteca', 'ayuda', 'estilo'];

// ids de escena disponibles (tools/shots.mjs los recorre todos)
export const SCENE_IDS = [
  ...PLAIN, 'title-menu', 'season-end', 'gameover', 'ayuda-codigo', 'agenda-decision', 'agenda-train', 'penya-detail', 'penya-mercado', 'penya-ojeadores', 'penya-panteon', 'club-facilities', 'club-sponsor', 'club-junta', 'bar-amuletos', 'bar-consumibles', 'eurocup', 'lineup', 'press', 'result',
  'match-aim', 'match-power', 'match-flight', 'match-settled', 'match-measure',
  'train-arrime', 'fx-demo',
];

const DT = 1 / 60;

// entrada falsa: `press` son las teclas "pulsadas" en este frame
function scriptedInput(press = []) {
  const set = new Set(press);
  return { hit: (k) => set.has(k), held: () => false, mouse: { cx: -1, cy: -1, down: false, clicked: false } };
}

function step(game, press = []) {
  const M = game.match;
  game.frame++;
  M.tickFrame(game.frame);
  M.update(DT, scriptedInput(press));
}

function wait(game, secs) { for (let t = 0; t < secs; t += DT) step(game); }

// juega solo (siempre ENTER, potencia cuando la barra pasa por ~0.55)
// hasta que se cumpla `until` o se agote el tiempo simulado
function autoplay(game, until, maxSecs = 90) {
  const M = game.match;
  for (let t = 0; t < maxSecs; t += DT) {
    if (until(M)) return true;
    const ph = M.phase;
    const inBarWindow = (ph === 'power' || ph === 'jackPower') && M.power > 0.5 && M.power < 0.6 && M.powerDir > 0;
    const confirm = ['roundStart', 'jackAim', 'aim', 'spin', 'loft'].includes(ph) && M.phaseT > 0.1;
    const advance = ['throwDone', 'roundEnd'].includes(ph) && M.phaseT > 1.3;
    step(game, inBarWindow || confirm || advance ? ['Enter'] : []);
    if (M._finished) return until(M);
  }
  return until(M);
}

function startLeagueMatch(game) {
  game._startWeeklyMatch();
  const ids = game.player.roster.ids.slice(0, 1);
  game.startMatch(ids);
}

// Copa de Europa de muestra (en una partida nueva no existe hasta el fin
// de la temporada 1): sorteo real con las ligas de nivel 8, dos rondas
// ya resueltas para que el cuadro tenga contenido
function demoEuroCup(p) {
  const groups = [{ country: p.homeCountry, clubs: p.leagueWorld.leagueOf(8).standings().slice(0, 4) }];
  for (const [code, world] of p.foreignLeagues) groups.push({ country: code, clubs: world.leagueOf(8).standings().slice(0, 4) });
  const cup = EuropeanCup.generate(groups, null, null);
  for (let r = 0; r < 2; r++) { cup.resolveAiPairings(); if (cup.roundComplete()) cup.advanceDraw(); }
  return cup;
}

export function applySceneFromUrl(game) {
  if (typeof location === 'undefined') return;
  const params = new URLSearchParams(location.search);
  const id = params.get('scene');
  if (!id) return;
  game.sceneMode = id;
  game.player.save = () => {};
  // errores de JS visibles para tools/shots.mjs (lee document.title con
  // --dump-dom): la primera excepción sin capturar queda ahí apuntada
  const report = (msg) => { if (!document.title.startsWith('JSERROR')) document.title = `JSERROR: ${msg}`; };
  window.addEventListener('error', (e) => report(`${e.message} @ ${(e.filename || '').split('/').pop()}:${e.lineno}`));
  window.addEventListener('unhandledrejection', (e) => report(String(e.reason)));

  if (PLAIN.includes(id)) {
    game.state = id;
  } else if (id === 'title-menu') {
    // portada de una partida ya empezada (sin selectores de partida nueva)
    game.player.difficultyChosen = true;
    game.state = 'title';
  } else if (id === 'season-end') {
    game.seasonEndInfo = { rank: 1, cityName: game.player.league.cityName, promoted: true, relegated: false, awards: [{ stat: 'pulso', id: game.player.roster.ids[0] }, { stat: 'temple', id: game.player.roster.ids[0] }] };
    game.state = 'seasonEnd';
  } else if (id === 'gameover') {
    game.player.negativeWeeksStreak = 6;
    game.state = 'gameover';
  } else if (id === 'ayuda-codigo') {
    game.screens.ayuda.page = 1;
    game.state = 'ayuda';
  } else if (id === 'agenda-decision') {
    game.decisionEvent = { event: DECISION_EVENTS[0], ctx: { abueloId: game.player.roster.ids[0] } };
    game.state = 'agenda';
  } else if (id === 'agenda-train') {
    const clock = game.player.seasonClock;
    game.screens.agenda.schedule = { day: clock.day + 1, step: 'drill', abueloId: game.player.roster.ids[0], cursor: 0 };
    game.state = 'agenda';
  } else if (id.startsWith('penya-')) {
    const pen = game.screens.penya;
    game.player.systemsRevealed.mercado = true;
    game.player.systemsRevealed.ojeadores = true;
    if (id === 'penya-detail') pen.detailAbuelo = game.player.roster.ids[0];
    else pen.section = id.slice(6);
    game.state = 'penya';
  } else if (id.startsWith('club-') || id.startsWith('bar-')) {
    const [scr, section] = id.split('-');
    game.player.systemsRevealed.patrocinios = true;
    game.player.systemsRevealed.junta = true;
    game.screens[scr].section = section;
    game.state = scr;
  } else if (id === 'eurocup') {
    if (!game.player.euroCup) game.player.euroCup = demoEuroCup(game.player);
    game.state = 'eurocup';
  } else if (id === 'lineup') {
    game._startWeeklyMatch();
    game.state = 'lineup';
  } else if (id === 'press') {
    // rueda de prensa de derbi (con la pulla del capitán rival)
    game._startWeeklyMatch();
    game.pressContext = { opponent: game.weeklyMatch.opponentClub, isDerby: true, isNemesis: false, isFinal: false, isCup: false };
    game.state = 'press';
  } else if (id === 'result') {
    game._startWeeklyMatch();
    game.simulateMatch();
    // simular no apunta marcador ni quién jugó (lo hace Match al jugarse):
    // se inventa uno coherente para que la pantalla salga completa
    const ctx = game.weeklyMatch, o = game.outcome;
    if (ctx && o && !ctx.results.length) ctx.recordRoundResult(o.won, o.won ? 13 : 9, o.won ? 8 : 13, game.player.roster.ids.slice(0, 1));
  } else if (id.startsWith('match-')) {
    startLeagueMatch(game);
    const M = game.match;
    if (id === 'match-aim') autoplay(game, (m) => m.phase === 'aim');
    else if (id === 'match-power') {
      autoplay(game, (m) => m.phase === 'aim');
      step(game, ['Enter']); step(game, ['Enter']); step(game, ['Enter']);
      wait(game, 0.45);
    } else if (id === 'match-flight') {
      autoplay(game, (m) => m.phase === 'aim');
      autoplay(game, (m) => m.phase === 'sim' && m.lastThrown && m.lastThrown.owner === 'P' && (m.lastThrown.z || 0) > 2);
    } else if (id === 'match-settled') {
      autoplay(game, (m) => m.balls.length >= 3 && m.phase === 'aim');
    } else if (id === 'match-measure') {
      autoplay(game, (m) => m.phase === 'measuring' && m.phaseT > 0.9);
    }
    if (!M) game.state = 'hub';
  } else if (id === 'fx-demo') {
    // efectos de core/Fx.js disparados justo antes de la captura (el
    // harness captura a los ~2.5 s de tiempo virtual)
    game.state = 'hub';
    setTimeout(() => {
      game.fx.burst(40, 20, { n: 40, colors: ['#ffe14d', '#ff8c5b', '#fff3c4'], speed: 16 });
      game.fx.burst(100, 30, { n: 30, color: '#4fc3f7', speed: 10, glyph: '·' });
      game.fx.float(70, 34, '+150€', '#7ec850', { size: 2 });
      game.fx.banner('¡CARREAU!', '#ffe14d', { sub: 'la bola rival sale disparada y la tuya se queda en su sitio', life: 3 });
      game.fx.shake(1);
    }, 2150);
  } else if (id === 'train-arrime') {
    game.startPractice(game.player.roster.ids[0], 'ARRIME');
    autoplay(game, (m) => m.phase === 'aim');
  }

  if (params.get('freeze')) game.frozen = true;

  // &bench=1: mide cuánto tarda un frame completo (draw de la pantalla +
  // render del canvas) y lo deja en document.title — tools/shots.mjs
  // --bench lo lee con --dump-dom
  if (params.get('bench') && game.renderer) {
    const scr = game.screens[game.state];
    const N = 40;
    const time = (fn) => { for (let i = 0; i < 3; i++) fn(); const t0 = performance.now(); for (let i = 0; i < N; i++) { game.frame++; fn(); } return (performance.now() - t0) / N; };
    const drawMs = time(() => scr.draw());
    const full = time(() => { scr.draw(); game.screen.render(); });
    const saved = { ...Settings.values };
    Settings.values.bloom = false;
    const noBloom = time(() => { scr.draw(); game.screen.render(); });
    Settings.values.scanlines = false;
    const bare = time(() => { scr.draw(); game.screen.render(); });
    Settings.values = saved;
    document.title = `bench:${full.toFixed(1)} (draw ${drawMs.toFixed(1)} · sin bloom ${noBloom.toFixed(1)} · sin bloom ni CRT ${bare.toFixed(1)})`;
  }
}
