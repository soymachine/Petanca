#!/usr/bin/env node
// Capturas del juego en varias resoluciones, sin dependencias: compila la
// edición full, la sirve con tools/serve-dist.mjs y abre cada escena de
// core/DebugScenes.js (`?scene=<id>&freeze=1`) en Chromium headless con
// --screenshot. Pensado para revisar el rediseño visual (docs/REDISENO.md)
// y comparar antes/después.
//
// Uso:
//   node tools/shots.mjs [--out=DIR] [--scenes=hub,match-aim] [--sizes=1280x720,1920x1080] [--no-build] [--query=nuevo=1] [--bench]
// Por defecto: todas las escenas, 4 resoluciones, salida en
// <tmp>/petanka-shots (no se sube al repo salvo que se pida con --out).

import { spawn, execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v === undefined ? true : v];
}));

const { SCENE_IDS } = await import(pathToFileURL(join(ROOT, 'public/game/core/DebugScenes.js')).href);
const scenes = args.scenes ? String(args.scenes).split(',') : SCENE_IDS;
const sizes = (args.sizes ? String(args.sizes) : '1280x720,1920x1080,2560x1440,1024x768').split(',');
const outDir = resolve(args.out ? String(args.out) : join(tmpdir(), 'petanka-shots'));
// puerto al azar en cada ejecución: si quedara un servidor viejo colgado en
// un puerto fijo, las capturas saldrían de él (de otra edición) sin avisar
const PORT = 4400 + Math.floor(Math.random() * 1000);
const extraQuery = args.query ? `&${args.query}` : '';

function findChrome() {
  const base = '/opt/pw-browsers';
  if (existsSync(base)) {
    for (const d of readdirSync(base).filter((n) => n.startsWith('chromium-')).sort().reverse()) {
      const p = join(base, d, 'chrome-linux', 'chrome');
      if (existsSync(p)) return p;
    }
  }
  for (const p of ['/usr/bin/chromium', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']) {
    if (existsSync(p)) return p;
  }
  throw new Error('no se encontró Chromium/Chrome');
}

// --edition=demo captura la build demo (por defecto, la full)
const EDITION = args.edition === 'demo' ? 'demo' : 'full';
if (!args['no-build']) execFileSync('node', [join(ROOT, 'tools/build-editions.mjs'), EDITION], { stdio: 'ignore' });
mkdirSync(outDir, { recursive: true });

const server = spawn('node', [join(ROOT, 'tools/serve-dist.mjs'), join(ROOT, `dist/${EDITION}`), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));

const chrome = findChrome();
let done = 0;
const jsErrors = [];
try {
  if (args.bench) {
    // ms por frame (draw + render) de cada escena y tamaño — ver DebugScenes
    for (const scene of scenes) {
      const row = [];
      for (const size of sizes) {
        const [w, h] = size.split('x');
        const dom = execFileSync(chrome, [
          '--headless=new', '--no-sandbox', `--window-size=${w},${h}`, '--virtual-time-budget=4000', '--dump-dom',
          `http://127.0.0.1:${PORT}/?scene=${scene}&freeze=1&bench=1${extraQuery}`,
        ], { encoding: 'utf8', timeout: 90000, stdio: ['ignore', 'pipe', 'ignore'] });
        const m = dom.match(/<title>bench:([^<]+)<\/title>/);
        row.push(`${size}: ${m ? m[1] : '?'}`);
      }
      console.log(`${scene.padEnd(14)} ${row.join('\n               ')}`);
    }
    server.kill();
    process.exit(0);
  }
  for (const scene of scenes) {
    for (const size of sizes) {
      const [w, h] = size.split('x');
      const file = join(outDir, `${scene}__${size}.png`);
      execFileSync(chrome, [
        '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
        `--window-size=${w},${h}`, '--virtual-time-budget=2500',
        `--screenshot=${file}`,
        `http://127.0.0.1:${PORT}/?scene=${scene}&freeze=1${extraQuery}`,
      ], { stdio: 'ignore', timeout: 60000 });
      // errores de JS: en modo escena la página los deja en document.title
      // (ver core/DebugScenes.js); se comprueba una vez por escena
      if (size === sizes[0]) {
        const dom = spawnSync(chrome, [
          '--headless=new', '--no-sandbox', '--disable-gpu', `--window-size=${w},${h}`, '--virtual-time-budget=2500', '--dump-dom',
          `http://127.0.0.1:${PORT}/?scene=${scene}${extraQuery}`,
        ], { encoding: 'utf8', timeout: 60000 }).stdout || '';
        const m = dom.match(/<title>JSERROR: ([^<]*)<\/title>/);
        if (m) jsErrors.push(`${scene}: ${m[1]}`);
      }
      done++;
    }
    process.stdout.write(`${jsErrors.some((e) => e.startsWith(scene + ' ')) ? '✘' : '✔'} ${scene}\n`);
  }
} finally {
  server.kill();
}
console.log(`\n${done} capturas en ${outDir}`);
if (jsErrors.length) {
  console.log(`\n${jsErrors.length} ERRORES DE JS:`);
  for (const e of jsErrors) console.log(`  ${e}`);
  process.exitCode = 1;
}
