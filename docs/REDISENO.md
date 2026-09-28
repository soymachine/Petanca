# PETANKA — Rediseño "Neo-ASCII" (documento vivo)

> **Si eres una sesión nueva: lee este bloque primero y continúa por el
> "SIGUIENTE PASO". Actualiza este documento (casillas + bloque de estado)
> y haz commit + push tras CADA sub-paso, no al final de la fase.**

## ESTADO ACTUAL

- **Rama de trabajo:** `claude/petanca-rules-comparison-jb587u` (reiniciada
  desde `main` en `46bc963`). `main` queda estable mientras dura el
  rediseño; se fusiona cuando el usuario lo pida.
- **Fase en curso:** Fase 1 — motor de render Neo-ASCII.
- **SIGUIENTE PASO CONCRETO:** `core/Screen.js` → `<canvas>` con la misma
  API (ver Fase 1, primera casilla).
- **Último commit relevante:** (se rellena en cada commit)

## Visión

El juego funciona pero no divierte a nivel visual: todo es una rejilla de
texto fija de 140×46 en un `<pre>` de 13 px (ancho máx. 1200 px), las 19
pantallas están colocadas a mano sobre esa rejilla, y el partido es una
vista cenital plana con 4 pasos de teclado. Objetivo: que **respire
videojuego**, que **ocupe toda la pantalla** de cada usuario, que un
**código visual explique las mecánicas**, y que el partido sea **arcade y
dinámico sin perder profundidad**.

## Decisiones tomadas con el usuario (no reabrir sin preguntar)

1. **Identidad: Neo-ASCII.** Se conserva el ADN de texto, pero renderizado
   en `<canvas>` a pantalla completa con luz, brillo, profundidad,
   partículas, transiciones y movimiento suave sub-celda.
2. **Cámara del partido: perspectiva + cenital.** Vista pseudo-3D detrás
   del lanzador (la pista se aleja hacia el horizonte) + mini-mapa cenital
   para leer distancias; cámara a ras de suelo en choques y medición.
3. **Controles: gesto + teclado.** Arrastrar hacia atrás y soltar
   (tirachinas: dirección + potencia) con ratón/táctil; el temblor del
   abuelo hace vibrar el gesto; teclado sigue siendo alternativa completa.
4. **Avisos:** (heredado) Copa de Europa ya se juega ronda a ronda — no
   tocar esa lógica en el rediseño.

## Reglas de trabajo

- Cada commit deja el juego **jugable**. Lo nuevo entra detrás de un
  interruptor (`?nuevo=1` o ajuste) hasta que sustituye a lo viejo.
- **Físicas, reglas, IA y economía NO cambian** (salvo que el usuario lo
  pida): el rediseño es de vista y entrada. `npm run verify` (19 checks)
  debe seguir en verde siempre.
- Verificación visual con el harness de capturas (Fase 0) antes de dar
  nada por hecho; las capturas "antes" están en `docs/capturas/antes/`.
- Commits con el pie de atribución que indique la sesión.

## Datos técnicos clave (para no tener que redescubrirlos)

- Entrada: `src/pages/index.astro` → `public/game/main.js` → `core/Game.js`.
  Sin bundler (ver `package.json`). Dev: `npm run dev`. Ediciones:
  `node tools/build-editions.mjs [demo|full]`, lanzadores
  `run-demo.command` / `run-full.command`, servidor `tools/serve-dist.mjs`.
- Render: `core/Screen.js` — buffers `chars[]`/`colors[]` de 140×46,
  primitivas `put/text/textCenter/block/box/drawPhotoArt/
  drawPhotoArtScaled/drawPortrait/drawAnyPortrait/putClipped/drawList`,
  `render()` genera `<span>` por tramos de color. Constantes `COLS=140,
  ROWS=46` en `core/Game.js`.
- Bucle: `Game.loop` (rAF, `dt` ≤ 50 ms) → `screens[state].update?/draw` →
  `input.drawCursor` → `screen.render()` → `input.endFrame()`.
- Entrada: `core/Input.js` — `keys/pressed` (`hit/held`), ratón en
  celdas (`mouse.cx/cy/down/clicked/dragDist/dx/dy`), `wheel`. El cursor
  `◤` se dibuja en la rejilla. Las pantallas usan `hitRect` (utils) sobre
  celdas.
- Partido: `match/Match.js` (fases `roundStart → jackPower → aim → spin →
  loft → power → sim → throwDone → measuring → roundEnd/matchEnd`,
  entrenos `trainEnd`), `throwBall(owner, angle, power, spin, loft)`,
  `throwProfile()` (`match/ThrowProfile.js`: `shake`, `guideLen`,
  `spinMax`, `barSpeed`, `maxPow`), jitter `jitterA/jitterP`, `sweetSpot/
  sweetWidth`, `trail`, `decisive`. Vista: `screens/MatchScreen.js`.
- Terreno: `physics/constants.js` — `CW=132, CH=22` celdas, `COURT_X=4,
  COURT_Y=15`, `THROW_X=7`, `GRAV=26`. Distancias reales con `dy×2`
  (`dist2d`), altura `z` en la bola.
- Tests: `npm run verify` (`tools/verify.mjs`, dominio). Chromium headless
  en `/opt/pw-browsers/chromium-*/chrome-linux/chrome`.

## Fases

### Fase 0 — Documento + harness de capturas
- [x] `docs/REDISENO.md` (este documento) + `CLAUDE.md` + enlaces desde
      `instructions.md` y `next-steps.md`.
- [x] Hook por URL: `core/DebugScenes.js` (`applySceneFromUrl`, llamado al
      final del constructor de `Game`). `?scene=<id>` arranca en un estado
      preparado; `&freeze=1` pone `game.frozen` (el loop deja de llamar a
      `update` del partido, el dibujo sigue). En modo escena nunca se
      guarda (`player.save` = no-op). Ids en `SCENE_IDS`: title, hub,
      agenda, penya, club, leaguemap, bar, capitulos, hemeroteca, ayuda,
      eurocup (cuadro de muestra), lineup, result, match-aim, match-power,
      match-flight, match-settled, match-measure, train-arrime. Los de
      partido se alcanzan con `autoplay()` (ENTER automático + potencia
      ~0.55) sobre `Match.update` con una entrada falsa.
- [x] `tools/shots.mjs`: `node tools/shots.mjs [--out=DIR] [--scenes=a,b]
      [--sizes=WxH,...] [--no-build]` → build full, `serve-dist` en el
      puerto 4399, Chromium headless `--screenshot` (virtual-time-budget
      2.5 s). Salida por defecto `<tmp>/petanka-shots`; ~4 s por escena.
      Para revisar: `Read` de las PNG.
- [x] Capturas "antes" en `docs/capturas/antes/` (19 escenas × 1920×1080 y
      1280×720).

### Fase 1 — Motor de render Neo-ASCII
- [ ] `core/Screen.js` → `<canvas>` con la MISMA API (las 19 pantallas
      funcionan sin tocarlas). Fuente monoespaciada medida en runtime.
- [ ] Extensiones retrocompatibles: fondo por celda (`put(...,bg)`,
      `fill(x,y,w,h,bg)`), `glow`, capa de píxeles libre `screen.fx`.
- [ ] Pantalla completa adaptable: escalar la rejilla al viewport con
      `devicePixelRatio`, fondo ambiental animado en el margen, `F` →
      fullscreen, `resize`.
- [ ] `core/Input.js`: pointer events (ratón + táctil), celda + píxel,
      cursor en capa FX.
- [ ] `core/Fx.js`: partículas, sacudida, destellos, texto flotante,
      transiciones entre pantallas, bloom/scanlines opcionales.
- [ ] Ajustes (efectos, reducir movimiento) en localStorage.

### Fase 2 — Sistema visual y código visual de mecánicas
- [ ] `ui/theme.js`: tokens semánticos; color + glifo fijo por stat
      (Pulso, Brazo, Maña, Temple, Aguante), clima y tipo de tiro.
- [ ] `ui/widgets.js`: Panel, Botón, Pestañas, Medidor, Tarjeta, Insignia,
      Tooltip. `TabsBar` → navegación de videojuego.
- [ ] Lenguaje de mecánicas (fatiga desatura retrato, temple = latido,
      pulso = temblor del retículo, chips de clima, afinidades).
- [ ] Escena `?scene=estilo` (hoja de estilo viva).

### Fase 3 — Partido arcade
- [ ] Extraer `Match.release(power)` (falta de pie, sweet spot, ruido) —
      mismo resultado por teclado y gesto; test headless.
- [ ] `match/view/Camera.js` (proyección pseudo-3D, planos por fase).
- [ ] `match/view/PerspectiveCourt.js` (perspectiva tipográfica, bolas
      sombreadas, polvo, estela, pistas con personalidad, clima).
- [ ] Mini-mapa cenital (reutiliza `_drawCourt/_drawBalls` de MatchScreen).
- [ ] Gesto tirachinas + selector de tipo de tiro (ARRIMAR / MEDIA VOLEA /
      BOMBEO / TIRO) + efecto; retículo con jitter; sweet spot visible.
- [ ] Juice: carreau, biberón, boliche fuera, remontada, cámara lenta,
      repetición, marcador animado.
- [ ] Nueva vista por defecto (clásica disponible en Ajustes).

### Fase 4 — Pantallas de gestión
- [ ] Hub · [ ] Alineación + Prensa · [ ] Resultado · [ ] Agenda ·
      [ ] Mi Peña · [ ] Ligas / Copa de Europa · [ ] El Club · [ ] El Bar ·
      [ ] Capítulos / Hemeroteca / Ayuda / Portada

### Fase 5 — Pulido
- [ ] Tutorial del primer partido con controles nuevos · [ ] Audio ·
      [ ] Rendimiento · [ ] Accesibilidad · [ ] Builds demo/full revisadas

## Registro de commits

| Fecha | Commit | Qué |
|---|---|---|
| 2026-09-28 | b72c332 | Fase 0: documento vivo + CLAUDE.md |
| 2026-09-28 | (este) | Fase 0: escenas `?scene=`, `tools/shots.mjs`, capturas "antes" |

## Problemas conocidos / notas

- **Diagnóstico de las capturas "antes":** a 1920×1080 el juego ocupa ~55%
  del ancho con texto de 13 px y márgenes negros enormes; a 1280×720 se
  corta por abajo (46 filas × 15 px no caben). En el partido la bola es un
  solo carácter y el vuelo apenas se percibe; la pista es un tapiz de ░
  sin profundidad.
- `match-measure` casi nunca alcanza la fase `measuring` (es rara: solo
  con bolas casi empatadas); de momento la escena acaba donde acabe el
  autoplay. Si hace falta, forzar un empate colocando bolas a mano.
- Detalle heredado visto en `result`: "+-5€" cuando el premio es negativo
  (cosmético, ResultScreen) — arreglar en Fase 4.
