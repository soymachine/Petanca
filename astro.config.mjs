import { defineConfig } from 'astro/config';

// Astro solo envuelve el juego (public/game) con un servidor de desarrollo
// y un build estático; el juego en sí sigue siendo JS vanilla sin bundlear.
export default defineConfig({
  server: { port: 4321 },
});
