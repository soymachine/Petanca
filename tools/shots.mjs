#!/usr/bin/env node
// Capturas del juego en varias resoluciones, sin dependencias: compila la
// edición full, la sirve con tools/serve-dist.mjs y abre cada escena de
// core/DebugScenes.js (`?scene=<id>&freeze=1`) en Chromium headless con
// --screenshot. Pensado para revisar el rediseño visual (docs/REDISENO.md)
// y comparar antes/después.
//
// Uso:
//   node tools/shots.mjs [--out=DIR] [--scenes=hub,match-aim] [--sizes=1280x720,1920x1080] [--no-build]
// Por defecto: todas las escenas, 4 resoluciones, salida en
// <tmp>/petanka-shots (no se sube al repo salvo que se pida con --out).

import { spawn, execFileSync } from 'node:child_process';
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
const PORT = 4399;

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

if (!args['no-build']) execFileSync('node', [join(ROOT, 'tools/build-editions.mjs'), 'full'], { stdio: 'ignore' });
mkdirSync(outDir, { recursive: true });

const server = spawn('node', [join(ROOT, 'tools/serve-dist.mjs'), join(ROOT, 'dist/full'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));

const chrome = findChrome();
let done = 0;
try {
  for (const scene of scenes) {
    for (const size of sizes) {
      const [w, h] = size.split('x');
      const file = join(outDir, `${scene}__${size}.png`);
      execFileSync(chrome, [
        '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
        `--window-size=${w},${h}`, '--virtual-time-budget=2500',
        `--screenshot=${file}`,
        `http://127.0.0.1:${PORT}/?scene=${scene}&freeze=1`,
      ], { stdio: 'ignore', timeout: 60000 });
      done++;
    }
    process.stdout.write(`✔ ${scene}\n`);
  }
} finally {
  server.kill();
}
console.log(`\n${done} capturas en ${outDir}`);
