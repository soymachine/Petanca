# PETANKA — Rediseño "Neo-ASCII" (documento vivo)

> **Si eres una sesión nueva: lee este bloque primero y continúa por el
> "SIGUIENTE PASO". Actualiza este documento (casillas + bloque de estado)
> y haz commit + push tras CADA sub-paso, no al final de la fase.**

## ESTADO ACTUAL

- **Rama de trabajo:** `claude/petanca-rules-comparison-jb587u` (reiniciada
  desde `main` en `46bc963`). `main` queda estable mientras dura el
  rediseño; se fusiona cuando el usuario lo pida.
- **Fase en curso:** Fase 6 — el partido renderizado en ASCII (petición
  nueva del usuario tras probar las Fases 0-5).
- **SIGUIENTE PASO CONCRETO:** Fase 6, paso 2 — tubería en
  `ArcadeView.draw` (ver sección "Fase 6" más abajo).
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
- [x] Detección de errores de JS: en modo escena la página apunta la
      primera excepción en `document.title` (`JSERROR: …`) y shots.mjs la
      lee con `--dump-dom` (una vez por escena) → "✘ escena" + lista y
      código de salida 1. Probado inyectando un error a propósito.
- [x] `--bench`: ms/frame por escena y tamaño, desglosado (draw, sin
      resplandor, sin resplandor ni CRT).

### Fase 1 — Motor de render Neo-ASCII
- [x] `core/CanvasRenderer.js`: pinta el buffer de `Screen` en un
      `<canvas id="screen">` a pantalla completa (`index.astro`,
      `style.css`). `Screen.render()` delega en `screen.renderer` (sin
      renderer — tests headless — no dibuja). Celdas de tamaño ENTERO
      (proporción 0.56), rejilla centrada; fuente ajustada para que su
      avance llene ~94% de la celda. Bloques `█▀▄▌▐▖…▁▇▏▕` y cajas
      `─│┌…═║╔╠╬` dibujados por código (encajan sin huecos); `░▒▓` como
      trama de puntos; emoji (pareja UTF-16 en 2 celdas) unidos.
      Rendimiento: caché de glifos (`_glyph`, clave carácter+color+brillo)
      + capa de texto persistente que solo repinta celdas cambiadas
      (`_updateTextLayer`). Medido en Chromium headless SIN GPU (peor caso)
      a 1920×1080: pantalla quieta ~1 ms/frame, hub/partido ~8 ms; el
      resplandor cuesta ~15 ms sin GPU → `_autoQuality` lo apaga solo en
      esa sesión si el render medio pasa de 14 ms.
- [x] Extensiones de `Screen` (retrocompatibles): `put(x,y,ch,fg,bg)`,
      `fill(x,y,w,h,bg)`, `glow(x,y,w,h,color|true)`,
      `layer('under'|'over', fn(ctx, renderer))` (píxeles libres por
      debajo/encima del texto; se piden cada frame). Utilidades del
      renderer para capas: `cx(celda)`, `cy(celda)` (admiten fracciones),
      `cw`, `ch`, `ox`, `oy`, `dpr`.
- [x] Pantalla completa adaptable: escala al viewport con
      `devicePixelRatio` (máx. 2.5), fondo ambiental (degradado + polvo de
      tiza en el margen), `resize`. **F11** → pantalla completa (propia,
      también en Electron/Tauri). **F8** → efectos CRT on/off.
- [x] `core/Input.js`: pointer events (ratón + táctil) sobre `window`,
      `mouse.fx/fy` fraccionarios (celdas) además de `cx/cy`,
      `mouse.downFx/downFy` y `mouse.released` (para el gesto de Fase 3),
      cursor propio dibujado en píxeles por el renderer.
- [x] `core/Fx.js` (`game.fx`, coordenadas en celdas): `burst(x,y,{n,
      color|colors,speed,life,gravity,spread,angle,size,glyph})`,
      `float(x,y,texto,color,{size,life,rise})`, `banner(texto,color,{sub,
      life,size})`, `shake(0..2)`, `flash(color,alpha,life)`. Transición
      automática al cambiar `game.state` (frente diagonal con lluvia de
      glifos que destapa la pantalla nueva sobre una copia de la anterior,
      `renderer.snapshot()`). Respeta `Settings` (reduceMotion, shake,
      transitions). Escena `?scene=fx-demo` para verlo en captura.
- [~] Ajustes: `core/Settings.js` (`petanka-ajustes` en localStorage:
      bloom, scanlines, shake, transitions, reduceMotion; `Settings.motion(k)`
      respeta reducir movimiento). Falta una pantalla/panel de ajustes
      (de momento solo F8).

### Fase 2 — Sistema visual y código visual de mecánicas
- [x] `ui/theme.js`: `UI` (superficies/texto/acento), `TONE` (player,
      rival, jack, good, warn, bad, info, money, xp, gold), `STAT` (glifo +
      color + qué hace: Pulso ◎ cian, Brazo ➤ naranja, Maña ∿ lila, Temple
      ♥ rosa, Aguante ◆ verde), `statValueColor(v)`, `WEATHER_FX` (qué
      cambia cada clima en la pista), `SHOT` (tipos de tiro para Fase 3:
      arrimar/media/bombeo/tirar con loft y rol), y `mix/tint/desaturate`.
- [x] `ui/widgets.js`: `panel`, `button` (1 fila, hover/selected/disabled,
      devuelve true al activarse), `bigButton` (3-4 filas, pulsa), `meter`
      (octavos de celda), `segments`, `statChip`, `statBar`, `badge`,
      `tooltip` (se recoloca dentro de pantalla).
- [x] `screen.box()` rellena el interior como panel por defecto (7º arg
      `fill`, `null` = solo marco) → todas las pantallas con aspecto de
      tarjeta; el renderer solo rellena la mitad interior de las celdas de
      borde.
- [x] `TabsBar` rediseñada: franja de cabecera, icono por sección
      (⌂☰☺♜★⚑✦✉?), activa con fondo teñido + brillo + subrayado grueso,
      dinero como insignia. Mismas teclas.
- [~] Lenguaje de mecánicas en pantallas concretas (fatiga desatura
      retrato, temple = latido, pulso = temblor del retículo, chips de
      clima, afinidades): se aplica al rediseñar cada pantalla (HUD del
      partido en Fase 3; alineación, Mi Peña… en Fase 4) usando theme.js.
- [x] Escena `?scene=estilo` (`screens/StyleScreen.js`, hoja de estilo viva;
      [F] rótulo, [B] chispas, [S] sacudida).

### Fase 3 — Partido arcade
- [x] `Match.beginPower()` (arranca potencia y fija el punto dulce),
      `Match.isSweet(power)`, `Match.release(power)` (falta de pie, lesión,
      punto dulce, ruido de temblor → `throwBall`; deja
      `lastReleaseSweet`). La barra de teclado ya lanza por `release`.
      Demostrado idéntico al motor anterior con `tools/replay-match.mjs`
      (partida determinista: semilla + `Date.now` fijo — ojo, RivalPlayer/
      FreeAgent siembran con la hora) en varias semillas.
- [x] `match/view/Camera.js`: cámara estenopeica mirando a +X con
      "lens shift" (horizonte `hz`), mundo real X=x, L=(y−CH/2)·2, Z=z.
      `project/projectWorld/unproject` (píxel → punto del suelo, para
      apuntar señalando). `direct(M)` = director de planos: `aim` (de
      hombro: desplazada a la izquierda para que el arco se vea como
      parábola), `jack`, `jackfollow`, `follow` (persigue la bola en vuelo
      y al rodar), `settle`, `closeup` (a ras de suelo junto al boliche en
      medición/fin de mano). Transiciones suaves (`update`, exponencial).
- [x] `match/view/PerspectiveCourt.js`: cielo por clima + silueta de pueblo
      en 2 capas con ventanas y parallax + sol; suelo por franjas con el
      color del terreno y niebla de distancia; grava tipográfica (1100
      glifos · , . : ° • proyectados, tamaño con tope); líneas, marcas de
      distancia cada 10, círculo de tiro; desgaste, charcos (ondas),
      pendiente, árbol (copa de ♣♠❀ en 3D ordenada por profundidad);
      bolas esféricas con degradado, estrías y sombra proyectada; estela
      del arco; diana/marcas de entrenos. `PerspectiveCourt.predict(M,
      power)` = vuelo parabólico previsto (sin viento).
- [x] `match/view/ArcadeView.js` (activa con `?nuevo=1` o F7 en partido;
      `game.arcadeMatch`): HUD superior (abuelo, bolas, chips de stats,
      stamina; rival; marcador GRANDE en píxeles), vista 3D filas 4-37,
      minimapa cenital (arriba a la dcha., con anillo dorado en la bola que
      manda y la dirección de tiro), veleta, chips de clima y "qué cambia",
      narración, cubierta inferior (fichas de TIPO DE TIRO clicables +
      TAB, slider de EFECTO, barra de POTENCIA con tramo dorado del punto
      dulce, consumibles, ayuda de controles por fase).
- [x] Controles: SEÑALAR en la pista fija el ángulo (unproject), MANTENER
      pulsado empieza la potencia (la barra oscila como siempre: Temple y
      cansancio), SOLTAR lanza (= ENTER sintético → `Match.release`).
      Teclado: ↑↓ apuntar, ←→/rueda efecto, TAB tipo de tiro, ENTER
      potencia, ENTER soltar, ESC volver a apuntar. Boliche igual. Clic =
      ENTER en las pausas. `ArcadeView.input(dt)` devuelve la entrada
      (filtrada/sintética) que recibe `Match.update`: ninguna regla cambia.
      Tipos de tiro (theme `SHOT` + BLOQUEAR): fijan `loft` y `role`.
      Probado en `npm run verify` (check "partido arcade").
- [x] Juice (`ArcadeView._juice/_readPlay`): polvo al caer, chispas +
      sacudida + CÁMARA LENTA (0.3× durante 0.55 s, `timeScale`, nunca con
      reducir movimiento) en los choques, "¡PUNTO DULCE!" + destello,
      rótulos de CARREAU (tu bola queda donde estaba la rival que sacas),
      BIBERÓN (pegada al boliche) y BOLICHE MOVIDO (también los del rival),
      rótulo de mano ganada/perdida y de VICTORIA/DERROTA con confeti,
      marcador que "salta" al cambiar. Abuelo lanzador en trazo de tiza
      (boina, brazo que se carga con la potencia) en los planos de tiro.
      Pendiente opcional: repetición a cámara lenta de la mano decisiva.
- [x] Mecánica de visibilidad portada: niebla/lluvia/tormenta ocultan o
      hacen parpadear bolas lejanas y el boliche (misma regla que la vista
      clásica, `_visibility`), también en el minimapa. Lluvia, nieve,
      calima y ráfagas en 3D a partir de `Weather.particles`.
- [x] Vista arcade por defecto (`Settings.matchView = 'arcade'`); F7 en
      partido alterna con la clásica y lo recuerda. `?nuevo=0/1` lo fuerza.
      Tramo del punto dulce muy visible (blanco dorado con brillo y ▾).

### Fase 4 — Pantallas de gestión
- [x] Hub (`screens/HubScreen.js`): cabecera con el club en grande
      (píxeles) + escudo mini + fecha/temporada; fila fija de avisos
      (números rojos > junta al límite > bienvenida); CARTEL del próximo
      partido (escudos 13×13 enfrentados, "VS" grande que late, casa/fuera,
      posición del rival, insignias de Copa/Europa; clic → Agenda);
      clasificación ENTERA con zonas de ascenso/descenso (clic → Ligas);
      tarjetas LA PEÑA (forma, moral, caja → Mi Peña), LA JUNTA (objetivos
      + medidor de confianza → El Club › La Junta), ÚLTIMA NOTICIA (→
      Hemeroteca); oferta de traspaso con botones VENDER/RECHAZAR; botón
      grande AVANZAR DÍA que dice qué viene (`_nextEvent`: mañana/el jueves
      + entreno/Copa/Europa/jornada); panel Debugger con botones. Mismos
      atajos (ENTER/ESPACIO, D, E, S/X, V/C).
- [x] Alineación (`screens/LineupScreen.js`): cabecera con la competición
      en grande + "TU CLUB vs RIVAL" + chips (derbi/némesis/fiestas/sede);
      cuatro paneles: VS RIVAL (cara, NIVEL en 10 segmentos, puntos),
      PISTA (pictograma con el rasgo + descripción), CLIMA (icono grande con
      brillo, efectos de WEATHER_FX, aviso de cambio, líder), FORMATO
      (plazas ●○, CAMBIAR [M], CALENTAR [W]); abuelos como tarjetas 4×3
      paginadas con chips de stats, STA en segmentos, moral, afinidad ✚/▼
      con el clima de hoy y vínculo ♥/♡; huecos "plaza libre" si la peña
      es corta; abajo bolas ◀ ▶, apuesta del bar con ACEPTAR [A], suceso
      del día y botón grande ¡A LA PISTA! [S] (dobles/tripletas). Mismas
      teclas que antes; clic en tarjeta = ENTER.
- [x] Prensa (`screens/PressScreen.js`, escena nueva `?scene=press`):
      periodista con micro y la pregunta en grande, flashes de cámara (se
      apagan con reducir movimiento), pulla del rival en derbi/némesis, y
      las 5 respuestas como cartas con MORAL / RIESGO (castigo si perdéis)
      / IMAGEN (humilde ↔ chulería) en medidores; debajo, qué pasará con
      la elegida. ←→ o 1-5, ENTER, ratón (pasar elige, clic responde).
- [x] Resultado (`screens/ResultScreen.js`): VICTORIA/DERROTA entra de
      golpe, marcador enorme que cuenta entre los dos escudos, confeti y
      destello al ganar (Fx), tarjeta por abuelo con XP llenando su barra de
      nivel y MVP, "LA CAJA DEL PARTIDO" con asientos que aparecen uno a
      uno (dinero con signo correcto: arreglado el "+-5€"), barra de
      RENOMBRE del club y botón CONTINUAR. Congelado/reducir movimiento =
      estado final directo. La escena `result` se inventa un marcador (al
      simular no se apunta).
- [x] Agenda (`screens/AgendaScreen.js`): de cuaderno de filas a TABLERO
      de dos semanas (7 casillas por semana, lunes siempre en su columna),
      número del día en grande, icono+color por tipo (◉ liga, ♛ Copa,
      ✪ Europa, ✎ entreno; leyenda en la banda de título), HOY con borde
      que respira e insignia, días pasados sellados con ✔ y marcador
      GANADO/PERDIDO; botón grande AVANZAR DÍA A DÍA (o VOLVER A HOY si se
      mira otra semana), botones AMISTOSO [F] y CUADRO DE EUROPA [E];
      tooltip unificado; modales de decisión y de entreno con opciones
      clicables (1-N / ↑↓ / ENTER siguen igual) y efecto del entreno con el
      glifo/color de su stat. Toda la lógica de avance, paginación y
      agendado se conserva. Escenas nuevas `agenda-decision`,
      `agenda-train`.
- [x] Motor: `screen.opaque()` / `panel({opaque:true})` — modales y
      tooltips tapan de verdad lo de debajo (texto, resplandor y las capas
      de píxeles pedidas antes; el renderer las recorta).
- [x] Mi Peña (`screens/PenyaScreen.js`, reskin por capas: la lógica de
      sus 4 pestañas y 6 modales no cambia): banda de título, cabeceras
      de stats con su glifo/color, valores de cada stat en su color, nivel
      y stamina en segmentos, fila del cursor con fondo; FICHA del abuelo
      seleccionado bajo la tabla (si cabe) con retrato escalado, medidores
      de las 5 stats, stamina, moral y nivel, situación (edad, nómina,
      arquetipo, clima ✚/▼, entreno, mentor, objeto) y botones ENTRENAR /
      REPARTIR PUNTOS / MENTOR / FICHA COMPLETA / RETIRAR; la ficha completa
      (detalle) con medidores de color, techo de potencial marcado ┃ en la
      barra y acciones como botones. Pista [Q] ya no pisa la pestaña
      PANTEÓN. Escenas `penya-detail`, `penya-mercado`, `penya-ojeadores`,
      `penya-panteon`.
- [x] Transversal: `drawTabRow` (core/utils.js) dibuja las pestañas de
      sección como chips con fondo en TODAS las pantallas; widget
      `titleBand()` para la cabecera de las pantallas de gestión; los
      rellenos negros de modales/tooltips heredados (`'█' #000`) pasan a
      `screen.opaque()` (Club, Europa, Bar, Ligas, Mi Peña); los
      "resaltados con espacios" (invisibles en canvas) pasan a fondos reales.
- [x] Ligas (`screens/LeagueMapScreen.js`): clasificación con fondo por
      zona (ascenso verde, descenso rojo), tu club en azul, hover, récord
      compacto "3G 1P" (antes se salía de la caja); jornada con tu partido
      resaltado y el marcador/"vs" como chip.
- [x] Copa de Europa (`screens/EuropeanCupScreen.js`): título en píxeles,
      rondas como chips (la que se juega en verde, FINAL en oro) y el
      trofeo ♛ grande brillando sobre la final, con el campeón debajo.
- [x] El Club (`screens/ClubScreen.js`): banda de título con la caja;
      instalaciones del Descampado sin el marco que pisaba la descripción
      (fondo + barra lateral), nombres legibles; confianza de la junta con
      medidor; selección en todas sus listas con fondo teñido.
- [x] El Bar (`screens/BarScreen.js`): banda de título con el lema a la
      derecha; bolas/amuletos/consumibles con la tarjeta elegida en doble
      marco verde y fondo teñido. Escenas `club-facilities`,
      `club-sponsor`, `club-junta`, `bar-amuletos`, `bar-consumibles`.
- [x] Portada (`screens/TitleScreen.js` + `ui/TitleScene.js`): escena
      arcade animada a todo lo ancho (atardecer con sol retro a rayas,
      silueta del pueblo con campanario y ventanas encendidas, pista de
      albero en perspectiva con grava tipográfica, bola que se lanza en
      bucle con estela, sombra, polvo y rodadura hasta el boliche; foto
      fija si está congelado o con reducir movimiento). Sustituye a la
      foto ASCII. Logo con resplandor; tarjeta del club + botón grande
      EMPEZAR; PERFILES / BORRAR como botones; selectores de país, ciudad,
      dificultad y perfil como tarjetas clicables. Escena `title-menu`.
- [x] Ayuda (`screens/AyudaScreen.js`): índice de temas clicable a la
      izquierda y el tema a la derecha; dos páginas nuevas dibujadas:
      EL PARTIDO: CONTROLES (ratón/dedo, teclado, tipos de tiro con su
      glifo y color, teclas globales) y EL CÓDIGO DE COLORES (5 stats con
      glifo/color/medidor/qué hacen, climas con sus efectos, símbolos,
      colores). Escena `ayuda-codigo`.
- [x] Capítulos (`screens/CapitulosScreen.js`): títulos de sección en
      píxeles (`pixelTitle`). Hemeroteca se queda como está: ya tiene su
      propia cabecera de periódico en bloques.

### Fase 5 — Pulido
- [x] Tutorial de los controles arcade (`ArcadeView._coachUpdate` /
      `_drawCoach`): cartel "CÓMO SE JUEGA" en la vista del partido que
      avanza solo al hacer lo que pide (boliche → ① apunta → ② tipo de tiro
      → ③ carga la potencia → ④ ¡suelta!), [H] lo salta; se recuerda en el
      perfil (`Player.arcadeTutorialDone`, también lo ven una vez las
      partidas guardadas de antes). Check nuevo en `npm run verify` (21).
- [x] Audio (`core/Audio.js`): todo sintetizado con WebAudio, sin
      archivos — choque metálico de bolas, caída en el albero (y el
      boliche más ligero), punto dulce, punto para ti / para el rival,
      fanfarria de victoria y lamento de derrota en el partido arcade;
      clic en botones y pestañas de toda la interfaz. Se desbloquea con el
      primer gesto (política de los navegadores). AJUSTES: Sonido sí/no y
      Volumen 25/50/75/100 % (`Settings.sound`, `Settings.volume`). Sin
      WebAudio (Node) es un no-op.
- [x] Rendimiento: la parte estática de la escena 3D (cielo, pueblo,
      suelo, ~1100 piedras y líneas) se pinta una vez en un lienzo aparte
      cuando la cámara está quieta y se copia de golpe
      (`PerspectiveCourt._drawStatic`); la cámara se clava en su plano al
      llegar (`Camera.update`) para que "quieta" sea quieta de verdad.
      Bench headless sin GPU a 1920×1080 (sin bloom): match-aim 23.5 → 7 ms,
      match-flight 24 → 1.5 ms (congelado). El tutorial se colocó entre la
      columna del clima y el minimapa, con el texto partido en dos líneas.
- [x] Accesibilidad: textos tenues con más contraste sobre el fondo
      (`UI.textFaint` 2.6:1 → 4.2:1, `UI.textDim` 5.2:1 → 6.4:1); todo lo
      nuevo se usa también solo con teclado; "reducir movimiento" corta
      sacudidas, transiciones, destellos, flashes de la prensa, la
      animación de la Portada y las del Resultado.
- [x] Builds demo/full revisadas: `tools/shots.mjs --edition=demo` captura
      la build demo (36 escenas sin errores de JS; la Portada dice "en la
      versión completa"). `shots.mjs` usa ahora un puerto al azar: un
      servidor viejo colgado en el puerto fijo hacía que se capturase otra
      edición sin avisar.
- [x] Pantalla de AJUSTES (`screens/AjustesScreen.js`, estado `ajustes`,
      escena `?scene=ajustes`): vista del partido ARCADE/CLÁSICA,
      resplandor, líneas CRT, sacudidas, transiciones, reducir movimiento,
      contador de FPS y pantalla completa, con interruptores clicables,
      ↑↓/ENTER/←→ y botón PROBAR EFECTOS [T]. Se abre con F9 desde
      cualquier pantalla menos en partido (F9 otra vez o ESC vuelve a donde
      se estaba), con botones en la Portada y en Ayuda. F3/F7/F8/F9/F11 ya
      no llegan al navegador (preventDefault).
- [x] Fin de temporada y Game Over (`SeasonEndScreen`, `GameOverScreen`):
      títulos en píxeles, veredicto grande (campeones / ascenso /
      descenso), premios de la peña como tarjetas con el glifo y color de
      su stat, confeti al celebrar, balance en panel y botón grande.
      Escenas `season-end` y `gameover`.

### Fase 6 — El partido en ASCII
Tubería: `Match` → `Camera` → `PerspectiveCourt` pinta SOLO el fondo en un
lienzo lógico pequeño (≈3×6 px por celda ASCII) → `AsciiRaster` lo
convierte a un buffer de caracteres (glifo + color de glifo + fondo) →
encima capas vectoriales (líneas, círculo, marcas, retícula, guía), sprites
ASCII analíticos (bolas, boliche, sombras, estela, chispas) y clima ASCII →
se pinta en la capa 'under' solo en celdas cambiadas. La cámara sigue en
coordenadas de pantalla (apuntar con el ratón no cambia).
- [x] 1. Núcleo `match/view/AsciiRaster.js` (puro, probado en verify):
      `convert()` elige por celda (bloque SX×SY=3×6 del lienzo lógico) la
      densidad por luminancia con Bayer 4×4 sobre la rampa ` .·:;=+*#%@`
      y, si hay contraste, el glifo cuya máscara mejor correlaciona con el
      bloque (todos los de `GLYPHS`, penalizando alejarse de la densidad);
      glifo = tono de la celda aclarado y cuantizado a 216 colores, fondo =
      tono ×0.3. Primitivas: `lineGlyph` (pendiente visual + sub-celda
      ¯ - _), `drawLine`, `drawText`, `drawBall` (disco sombreado con
      contorno ( ) / \ ¯ _, brillo °, estrías =), `shadeEllipse`.
      `AsciiOut.js` (navegador): mide las máscaras con la fuente real,
      fondos en un lienzo de 1 px por celda escalado sin suavizado, glifos
      cacheados y solo en celdas cambiadas; densidad 2× (1.5×/1× si la
      letra bajara de 7 px). Check nuevo en verify (22).
- [ ] 2. Tubería en `ArcadeView.draw` (fondo → ASCII), fuera `_drawThrower`
      y la 3D visible.
- [ ] 3. Vectores ASCII: líneas de cal, círculo, marcas, retícula, guía.
- [ ] 4. Sprites ASCII: bolas/boliche sombreados, sombras, altura, estela,
      chispas.
- [ ] 5. Clima, minimapa y viento en ASCII.
- [ ] 6. Rendimiento (caché con cámara quieta, densidad adaptativa),
      etiquetas F7/AJUSTES/Ayuda, verify + bench + demo.

## Registro de commits

| Fecha | Commit | Qué |
|---|---|---|
| 2026-09-28 | b72c332 | Fase 0: documento vivo + CLAUDE.md |
| 2026-09-28 | a89ddba | Fase 0: escenas `?scene=`, `tools/shots.mjs`, capturas "antes" |
| 2026-09-28 | 642c8a1 | Fase 1: renderer canvas a pantalla completa, Input pointer, Settings, harness con errores JS y bench |
| 2026-09-28 | 194a2b1 | Fase 1: core/Fx.js + transiciones entre pantallas |
| 2026-09-28 | 4336869 | Fase 2: theme.js, widgets.js, hoja de estilo |
| 2026-09-28 | 0613c06 | Fase 2: box() con relleno de panel |
| 2026-09-28 | 0cbfee0 | Fase 2: nueva barra de navegación |
| 2026-09-28 | 08fb1d5 | Fase 3: Match.release/beginPower + tools/replay-match.mjs |
| 2026-09-28 | dc23f9f | Fase 3: vista arcade en perspectiva + controles de gesto (tras ?nuevo=1 / F7) |
| 2026-09-28 | 17dd160 | Fase 3: juice, visibilidad por clima, clima 3D, arcade por defecto |
| 2026-09-28 | 724e5c1 | Fase 4: Inicio rediseñado |
| 2026-09-28 | 0e182a2 | Fase 4: Alineación + Prensa rediseñadas, escena `press` |
| 2026-09-28 | 631b121 | Fase 4: Resultado rediseñado |
| 2026-09-28 | 356a906 | Fase 4: Agenda como tablero + paneles opacos |
| 2026-09-28 | 098cffd | Fase 4: Mi Peña reskin + pestañas/títulos/modales transversales |
| 2026-09-28 | 9c69e85 | Fase 4: Ligas y Copa de Europa |
| 2026-09-28 | e2fda22 | Fase 4: El Club y El Bar |
| 2026-09-28 | 8414e29 | Fase 4: Portada animada, Ayuda con código visual, Capítulos |
| 2026-09-28 | cf0fe9f | Fase 5: pantalla de Ajustes (F9) |
| 2026-09-28 | 8d60317 | Fase 5: tutorial de controles del partido arcade |
| 2026-09-28 | 9063187 | Fase 5: audio sintetizado |
| 2026-09-28 | f1b7134 | Fase 5: fondo 3D cacheado con la cámara quieta |
| 2026-09-28 | 569e2c6 | Fase 5: contraste, build demo revisada, shots con puerto al azar |
| 2026-09-28 | (este) | Fase 5: fin de temporada y Game Over |

## Problemas conocidos / notas

- **Diagnóstico de las capturas "antes":** a 1920×1080 el juego ocupa ~55%
  del ancho con texto de 13 px y márgenes negros enormes; a 1280×720 se
  corta por abajo (46 filas × 15 px no caben). En el partido la bola es un
  solo carácter y el vuelo apenas se percibe; la pista es un tapiz de ░
  sin profundidad.
- `match-measure` casi nunca alcanza la fase `measuring` (es rara: solo
  con bolas casi empatadas); de momento la escena acaba donde acabe el
  autoplay. Si hace falta, forzar un empate colocando bolas a mano.
- El scratchpad de sesiones anteriores se pierde al recrearse el
  contenedor: los tests útiles deben vivir en `tools/` (verify, shots).
- Headless Chromium va SIN GPU: las cifras de `--bench` son el peor caso;
  en un navegador normal el canvas va acelerado. La escena 3D con la
  cámara quieta ya va cacheada (~1.5-7 ms); en movimiento sigue costando
  ~20 ms sin GPU — si hiciera falta, menos piedras lejanas.
- Las escenas `match-*` se capturan ya con la vista arcade (por defecto);
  `tools/shots.mjs --query=nuevo=0` para la clásica.
- (Resuelto) Detalle heredado visto en `result`: "+-5€" cuando el premio es negativo
  (cosmético, ResultScreen) — arreglar en Fase 4.
