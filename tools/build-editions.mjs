#!/usr/bin/env node
// Genera las dos ediciones distribuibles del juego a partir del mismo
// código fuente: 'demo' (España, sin Copa de Europa) y 'full' (todo el
// contenido — la que se envuelve para Steam). No hay bundler en este
// proyecto (ver package.json), así que la diferencia entre ediciones no es
// "dead code elimination" de un empaquetador: es el propio archivo
// core/edition.js, sobrescrito justo antes de cada build y SIEMPRE
// restaurado al terminar (try/finally), pase lo que pase.
//
// Uso:
//   node tools/build-editions.mjs            (las dos, a dist/demo y dist/full)
//   node tools/build-editions.mjs demo       (solo la demo)
//   node tools/build-editions.mjs full       (solo la completa)

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, statSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const EDITION_FILE = join(ROOT, 'public/game/core/edition.js');

const EDITION_SOURCE = {
  demo: `// Edición 'demo' — generada por tools/build-editions.mjs, no editar a mano.
// España únicamente, sin Copa de Europa. Ver ese script para el original
// 'full' que se restaura automáticamente al terminar la build.
export const EDITION = 'demo';
`,
  full: `// Edición de esta build: 'full' (todo el contenido, la que se envuelve
// para Steam) o 'demo' (solo España, sin Copa de Europa ni el resto de
// países — ver tools/build-editions.mjs). En desarrollo (\`npm run dev\`)
// y en cualquier build que no pase por ese script, vale SIEMPRE 'full'.
//
// El script de build sobrescribe este archivo justo antes de generar la
// build demo y restaura este mismo valor al terminar (try/finally), así
// que el árbol de trabajo nunca se queda con 'demo' guardado por error.
// No es una constante inyectada por un bundler (este proyecto no bundlea
// public/game a propósito, ver package.json) — es lo más simple que
// funciona con ese diseño: un archivo de verdad distinto por edición, no
// un valor leído en caliente de un JSON.
export const EDITION = 'full';
`,
};

function dirSizeBytes(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    total += entry.isDirectory() ? dirSizeBytes(p) : statSync(p).size;
  }
  return total;
}

function humanSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function buildEdition(edition) {
  const outDir = join(ROOT, 'dist', edition);
  console.log(`\n→ Generando edición '${edition}' en dist/${edition}...`);
  writeFileSync(EDITION_FILE, EDITION_SOURCE[edition]);
  try {
    execFileSync('npx', ['astro', 'build', '--outDir', outDir], { cwd: ROOT, stdio: 'inherit' });
  } finally {
    // SIEMPRE se restaura la edición 'full' por defecto, tanto si la build
    // sale bien como si revienta — nunca debe quedar 'demo' en el árbol de
    // trabajo por un fallo a mitad de camino.
    writeFileSync(EDITION_FILE, EDITION_SOURCE.full);
  }
  const size = dirSizeBytes(outDir);
  console.log(`✔ dist/${edition} listo (${humanSize(size)})`);
}

const requested = process.argv[2];
const targets = requested === 'demo' || requested === 'full' ? [requested] : ['demo', 'full'];

const originalContent = readFileSync(EDITION_FILE, 'utf8');
try {
  for (const edition of targets) buildEdition(edition);
} finally {
  writeFileSync(EDITION_FILE, originalContent);
}

console.log('\nTODO LISTO.');
