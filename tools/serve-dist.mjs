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

// no-store en toda respuesta: sin esto, un navegador (o un Service
// Worker de otra prueba anterior en ese mismo origen localhost:<puerto>)
// puede quedarse con una respuesta vieja cacheada y no volver a pedirla
// nunca más, aunque el servidor real ya sirva otra cosa distinta
const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate', Pragma: 'no-cache' };

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
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', ...NO_CACHE });
      res.end('404 - no encontrado');
      return;
    }
    const body = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream', ...NO_CACHE });
    res.end(body);
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8', ...NO_CACHE });
    res.end('500 - error interno: ' + e.message);
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n✘ El puerto ${port} ya está en uso por otro proceso.`);
    console.error(`  Cierra lo que esté escuchando en ese puerto (por ejemplo, otra pestaña con "npm run dev") e inténtalo de nuevo.`);
  } else {
    console.error(`\n✘ Error de servidor: ${err.message}`);
  }
  process.exit(1);
});

// escucha solo en localhost (no en todas las interfaces): sin esto, si
// hay OTRO proceso (p.ej. un astro dev/preview olvidado en otra pestaña)
// enlazado específicamente a "localhost:<puerto>", el sistema operativo
// prioriza esa dirección más específica sobre la genérica de este
// servidor, y las peticiones del navegador acaban en el proceso ajeno
server.listen(port, '127.0.0.1', () => {
  console.log(`✔ Sirviendo ${dir} en http://localhost:${port}`);
});
