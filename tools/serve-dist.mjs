#!/usr/bin/env node
// Servidor estático mínimo, sin dependencias (solo http/fs/path de Node),
// para probar en el navegador una build ya generada en dist/<edición>.
// No usamos `astro preview` porque solo sirve el outDir fijado en
// astro.config.mjs, ni `npx serve` porque tirar de un paquete nuevo por
// npm no es fiable sin red — este proyecto ya evita dependencias extra
// para todo lo que public/game necesita en tiempo de ejecución.
//
// Uso: node tools/serve-dist.mjs <directorio> <puerto>

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';

const [, , dir, portArg] = process.argv;
if (!dir || !portArg) {
  console.error('Uso: node tools/serve-dist.mjs <directorio> <puerto>');
  process.exit(1);
}
const port = Number(portArg);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

const server = createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    let filePath = join(dir, urlPath === '/' ? '/index.html' : urlPath);
    let st = await stat(filePath).catch(() => null);
    if (st && st.isDirectory()) {
      filePath = join(filePath, 'index.html');
      st = await stat(filePath).catch(() => null);
    }
    if (!st) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 - no encontrado');
      return;
    }
    const body = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
    res.end(body);
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('500 - error interno: ' + e.message);
  }
});

server.listen(port, () => {
  console.log(`✔ Sirviendo ${dir} en http://localhost:${port}`);
});
