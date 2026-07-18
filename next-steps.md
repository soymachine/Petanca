# Next steps — 6 mejoras de profundidad (gameplay, manager, narrativa)

Este documento es una especificación para implementar. Cada mejora es autocontenida
e indica: contexto del sistema actual, diseño propuesto, puntos de enganche exactos
en el código, datos nuevos a persistir y criterios de aceptación. Se pueden
implementar en cualquier orden, pero el apartado "Orden recomendado" del final
explica las dependencias suaves entre ellas.

## Convenciones del proyecto (leer antes de tocar nada)

- Todo el juego vive en `public/game/` (JS vanilla, módulos ES, sin bundler).
  Astro (`src/pages/index.astro`) solo sirve la página.
- Render: rejilla ASCII de 140×46 (`core/Screen.js`). Las pantallas
  (`screens/*.js`) leen estado y pintan; NO contienen lógica de dominio.
- La lógica de partido está en `match/Match.js` (máquina de fases:
  `roundStart → aim → spin → loft → power → sim → throwDone → …`). Match no
  dibuja nada: `screens/MatchScreen.js` lee sus propiedades públicas.
- El perfil de tiro del jugador (temblor, potencia máxima, efecto…) se calcula
  en `match/ThrowProfile.js` apilando multiplicadores. Cualquier bonus/malus
  nuevo de tiro debe añadirse ahí, no en Match.
- La IA rival tira desde `match/AIPlayer.js` (balística inversa + ruido por nivel).
- El cierre de jornada de liga (dinero, moral, junta, noticias, ascensos) está
  centralizado en `model/Career.js → finishWeeklyMatch()`. Es el único sitio
  donde todas las piezas manager se tocan a la vez: efectos de fin de partido
  de liga van ahí.
- El estado persistente cuelga de `model/Player.js` (raíz del guardado,
  `toJSON`/`fromJSON` con clave `petanka_save_v4` en localStorage). CUALQUIER
  campo nuevo debe: (1) inicializarse en el constructor, (2) serializarse en
  `toJSON()`, (3) leerse con fallback en `fromJSON()` para no romper guardados
  existentes. Mismo patrón en `model/AbueloState.js` para estado por abuelo.
- El calendario día a día es `domain/SeasonClock.js`; los eventos que dispara
  se enrutan en `core/Game.js → advanceDay() / triggerEvent()` por `result.type`.
- Textos del juego: castellano, tono costumbrista de pueblo (ver
  `data/pressTopics.js`, `match/Narrator.js` como referencia de voz).
- Los comentarios del código explican el "porqué", en castellano. Mantener ese estilo.

---

## Mejora 1 — "El boliche es tuyo": elección de distancia al ganar la mano

**Capa:** gameplay (partido en vivo). **Tamaño estimado:** medio.

### Contexto actual
El boliche se coloca aleatorio cada mano: `Match._startRound()` hace
`new Ball({ x: rnd(75, 115), y: rnd(6, CH - 6) … })` (`match/Match.js:197`).
En la petanca real, el equipo que gana la mano lanza el boliche y elige la
distancia — es la mitad de la táctica del deporte y hoy no existe.

### Diseño
1. Cuando el jugador ganó la mano anterior (`this.lastWinner === 'P'`), antes de
   `roundStart` se inserta una fase nueva `placeJack`: un selector de 3 opciones
   (+ opcional banda) manejado con flechas + ENTER.
   - **CORTA**: boliche en x ∈ [70, 85]. Favorece arrimes finos (PULSO).
   - **MEDIA**: x ∈ [85, 105]. Neutra (equivale al comportamiento actual).
   - **LARGA**: x ∈ [105, 120]. Los tiros llegan con menos precisión: castiga
     el temblor multiplicándolo ~1.15 para AMBOS bandos; favorece BRAZO
     (con `maxPow` bajo ni se llega — ver `ThrowProfile.maxPow`).
   - Banda (opcional, segunda pulsación): ARRIBA / CENTRO / ABAJO fija el
     rango de `y`. Interactúa con rasgos de pista existentes (`slope` empuja
     al sur, `walls` rebota en bandas, `puddles` según dónde caigan los charcos).
2. Si la mano anterior la ganó la IA, elige ella según su arquetipo (ver
   Mejora 2; si la 2 no está implementada aún: corta si su nivel de arrime
   estimado es alto, larga si no — con `aiLevel` como proxy).
3. Primera mano de la partida: sorteo (50% cada bando elige; mostrarlo con una
   línea del narrador: "Gana el sorteo del boliche…").
4. Dentro de la banda/distancia elegida sigue habiendo azar (`rnd` dentro del
   rango): eliges terreno, no coordenada exacta.

### Puntos de enganche
- `match/Match.js`: nueva fase `placeJack` en el `switch` de `update()`;
  `_startRound()` recibe la elección (o `null` = aleatorio total, para
  entrenamientos, que NO usan esta fase). Guardar la elección en
  `this.jackChoice` para que el narrador y la Mejora 6 la puedan citar.
- `match/ThrowProfile.js`: multiplicador de `shake` si `match.jackChoice === 'larga'`.
- `match/AIPlayer.js`: sin cambios estructurales (la distancia ya la lee del
  boliche real); solo la elección de distancia cuando le toca a la IA.
- `screens/MatchScreen.js`: pintar el selector (reusar el patrón de overlay de
  `screens/BarScreen.js → _drawBuyModal`).
- `match/Narrator.js`: 2-3 líneas nuevas por elección ("Boliche corto: aquí se
  juega a arrimar, avisa …").

### Criterios de aceptación
- Tras ganar una mano, aparece el selector; tras perderla, la IA coloca y una
  línea del narrador lo cuenta.
- Entrenamientos (`training !== null`) no pasan por la fase.
- Con boliche largo, el mismo abuelo tiembla visiblemente más (comprobable en
  la guía de tiro).
- No rompe partidas guardadas (la fase es efímera, no se persiste).

---

## Mejora 2 — Arquetipos de rival con moral propia

**Capa:** gameplay + scouting. **Tamaño estimado:** medio.

### Contexto actual
La IA es un único perfil paramétrico por nivel: `AIPlayer.throwParams()`
(`match/AIPlayer.js`) decide disparar con
`Math.random() < 0.15 + lvl * 0.06` y siempre con los mismos umbrales. Los
capitanes rivales (`domain/RivalPlayer.js`) ya tienen nombre, retrato y línea
de personalidad (`data/rivalPersonality.js`), pero cero efecto en pista.

### Diseño
1. Nuevo dato `archetype` en el capitán rival (y por tanto en cada club).
   Cuatro arquetipos:

   | id | nombre | efecto en `AIPlayer` |
   |---|---|---|
   | `arrimador` | Arrimador fino | prob. de disparo ×0.4; error de arrime −15%; prefiere boliche corto |
   | `tirador` | Tirador agresivo | prob. de disparo ×2 y dispara desde d<9 (no solo d<6); error de arrime +20%; prefiere boliche largo |
   | `muro` | Muro | cuando va ganando la mano, apunta a bloquear el camino (target entre boliche y círculo de tiro); prefiere media |
   | `templado` | Veterano frío | error −20% cuando va POR DETRÁS en el marcador; sin preferencia de boliche |

2. **Moral de la IA** (`match/Match.js`, campo efímero `this.aiMorale ∈ [-1, 1]`,
   empieza en 0): +0.2 si la IA gana la mano, −0.2 si la pierde, −0.15 extra si
   la pierde de 2+ puntos; clamp. En `AIPlayer.throwParams`, `err *= 1 - aiMorale * 0.25`
  (moral alta = tira mejor). El narrador refleja los extremos
   ("El rival discute con su pareja: se les ve el nervio").
3. **Descubrimiento**: el arquetipo NO se muestra de serie. Se destapa por los
   canales existentes:
   - informe de ojeador sobre ese jugador (`domain/Scouting.js` /
     `model/ScoutStaff.js`): al revelar stats, revela también arquetipo;
   - rueda de prensa previa (`screens/PressScreen.js`): añadir a
     `pressContext` una línea de "lo que se comenta" del rival si ya es conocido;
   - tras jugar contra él una vez, queda visto para siempre (persistir en el
     club: `seenArchetype: true`).
4. Los clubes sin capitán (ligas bajas) usan `archetype` aleatorio ponderado por
   nivel de liga (en ligas altas, más `templado`/`muro`).

### Puntos de enganche
- `domain/RivalPlayer.js`: campo `archetype` (generado con el resto del
  jugador, determinista por seed si el sistema ya usa seeds). Persistencia via
  `LeagueWorld.toJSON` (verificar qué serializa de los capitanes).
- `match/AIPlayer.js`: leer `match.rivalArchetype` (que
  `WeeklyMatchContext`/`CupMatchContext` deben copiar al construir la ronda,
  igual que ya copian `rivalPortrait`).
- `match/Match.js`: `aiMorale` y sus updates en `resolveMano()`.
- `data/rivalPersonality.js`: líneas por arquetipo.
- `screens/LineupScreen.js`: si el arquetipo es conocido, mostrarlo junto al
  rival para poder alinear en consecuencia.

### Criterios de aceptación
- Dos clubes del mismo nivel con arquetipos distintos juegan visiblemente
  distinto (uno casi nunca dispara; el otro te mata bolas desde lejos).
- El arquetipo aparece en la pantalla de alineación SOLO si está descubierto.
- La moral de la IA es visible en el narrador al menos en los extremos.
- Guardados antiguos cargan: clubes sin `archetype` lo generan al vuelo.

---

## Mejora 3 — Eventos de decisión con consecuencias diferidas

**Capa:** manager + narrativa. **Tamaño estimado:** grande (por contenido, no por código).

### Contexto actual
El calendario dispara eventos pasivos: lesión, fallecimiento, evento de moral
(`model/Calendar.js → rollEvent/rollInjury/rollDeath`) y ofertas de compra
(`negotiation` en `core/Game.js:182`). El jugador se entera, pero nunca decide.
Ya existe la infraestructura de enrutado por tipo (`Game.triggerEvent`) y el
patrón de modal (`BarScreen._drawBuyModal`).

### Diseño
1. Nuevo tipo de evento `decision` en el calendario. Estructura de datos
   (nuevo archivo `data/decisionEvents.js`):

```js
{
  id: 'nieto_fermin',
  weight: 1,                    // peso relativo al sortear
  cond: (p) => p.roster.size >= 3,   // requisitos sobre Player (opcional)
  title: 'EL NIETO DE FERMÍN',
  text: 'El nieto de {abuelo} quiere venirse a los entrenos de la peña…',
  pick: 'random',               // cómo se elige {abuelo}: 'random' | 'oldest' | …
  options: [
    { label: 'QUE VENGA', effects: { moral: { target: 'abuelo', d: 6 } },
      sequel: { id: 'nieto_fermin_2', inWeeks: 3 },   // siembra evento futuro
      resultText: 'El chaval no falla un domingo. {abuelo} está encantado.' },
    { label: 'MEJOR QUE NO', effects: { moral: { target: 'abuelo', d: -4 } },
      resultText: '{abuelo} no dice nada, pero se le nota.' },
  ],
}
```

2. **Efectos soportados** (resolver en una función única `applyDecisionEffects`):
   moral (uno/todos), dinero, stamina, `boardConfidence`, item, XP, y `sequel`.
3. **Secuelas**: `sequel` agenda un evento concreto N semanas después vía
   `SeasonClock` (nueva cola `pendingDecisions: [{day, id, ctx}]` persistida en
   Player). El evento secuela puede referenciar el contexto de la decisión
   original (qué abuelo, qué se eligió). Con 2-3 cadenas de 2-3 eslabones ya
   emergen arcos de temporada.
4. **Frecuencia**: ~1 evento de decisión cada 2-3 semanas de juego (tirada en
   `SeasonClock.advanceOneDay` junto a `negotiation`, excluyendo domingos).
   Nunca dos el mismo día que otro evento.
5. **Contenido inicial**: 15-20 eventos, de los cuales 4-6 con secuela. Temas:
   vida de la peña (familias, bar, ayuntamiento), ofertas dudosas de
   patrocinadores, rivalidades locales, el tiempo. Tono costumbrista.
   No repetir un `id` ya salido hasta agotar el pool (persistir `seenDecisions`).

### Puntos de enganche
- `data/decisionEvents.js` (nuevo): pool de eventos.
- `domain/SeasonClock.js`: tirada + cola `pendingDecisions` (serializar).
- `core/Game.js`: rama `result.type === 'decision'` en
  `advanceDay/triggerEvent` → `this.decisionEvent = …` y estado de pantalla.
- `screens/AgendaScreen.js` (o overlay propio): pintar el modal de decisión.
  La Agenda ya anima el paso de días y pausa en eventos: seguir ese flujo.
- `model/Player.js`: `seenDecisions`, `pendingDecisions` en constructor +
  `toJSON` + `fromJSON` con fallback.
- `debugAdvanceOneDay` (`core/Game.js`): descartar decisiones (elegir la
  opción 0 automáticamente) para no bloquear el modo simulación.

### Criterios de aceptación
- Un evento de decisión pausa el avance de la agenda, muestra 2-3 opciones y
  aplica los efectos; la noticia del resultado queda en la Hemeroteca.
- Una secuela llega semanas después y cita lo elegido.
- El modo Debugger nunca se queda bloqueado esperando una decisión.
- Guardados antiguos cargan sin eventos pendientes y sin errores.

---

## Mejora 4 — Compenetración de parejas

**Capa:** manager con efecto en pista. **Tamaño estimado:** pequeño-medio.

### Contexto actual
Existe el roce negativo (`model/Roster.js → applyRivalryJealousy`) y el mentor
(`mentorBonusFor`). No existe química positiva. Los datos necesarios ya se
registran: `ctx.usados` (quién jugó) y `recordRoundResult(…, abuelos)` guardan
las alineaciones de cada partido.

### Diseño
1. Nuevo estado en `Player` (no en AbueloState, porque es de PAREJA):
   `chemistry: { "idA-idB": partidosJuntos }` con la clave ordenada
   (`idMenor-idMayor`). Se incrementa en `Career.finishWeeklyMatch` (y en los
   cierres de copa de `core/Game.js`) para cada par de `ctx.usados`.
2. Niveles de vínculo por umbral de partidos juntos:

   | partidos juntos | nivel | nombre | efecto |
   |---|---|---|---|
   | 0-4 | 0 | — | ninguno |
   | 5-11 | 1 | "se conocen del bar" | shake ×0.97 |
   | 12-24 | 2 | "se entienden con la mirada" | shake ×0.94 |
   | 25+ | 3 | "pareja de leyenda" | shake ×0.90 y +1 moral a ambos tras ganar |

   El efecto de shake aplica SOLO cuando ambos están alineados en el partido
   actual (`match.teamP`), como un multiplicador más en `ThrowProfile.compute`.
3. **Momento de pareja**: si tu compañero de vínculo ≥2 acaba de dejar una bola
   a <3 del boliche, tu siguiente tiro recibe shake ×0.92 adicional
   (leer la última bola propia en `match.balls`). Línea de narrador propia.
4. **Ruptura**: si un miembro se releva/fallece (`retireToGrandchild`), la
   entrada de química de sus parejas se borra (el nieto empieza de cero) y se
   emite una noticia con sabor ("La pareja de leyenda se deshace…").
5. UI: en `screens/PenyaScreen.js` (pestaña Plantilla), al seleccionar un
   abuelo, listar sus vínculos activos con nombre de nivel. En
   `screens/LineupScreen.js`, marcar con un icono cuando la alineación activa
   una pareja con vínculo.

### Puntos de enganche
- `model/Player.js`: `chemistry` (constructor/`toJSON`/`fromJSON`).
- `model/Career.js → finishWeeklyMatch`: incremento por pares + noticia al
  subir de nivel de vínculo.
- `core/Game.js → _finishCupMatch/_finishEuroCupMatch/_finishFriendlyMatch`:
  mismo incremento (extraer helper para no repetir).
- `match/ThrowProfile.js`: multiplicadores (necesita acceso a `chemistry`:
  pasarlo al construir `Match`, igual que ya se pasa `sweetBonus`).
- `model/AbueloState.js → retireToGrandchild`: no toca química directamente
  (no conoce a Player); la limpieza se hace donde se llama al relevo.

### Criterios de aceptación
- Jugar N partidos con la misma pareja sube el vínculo y sale la noticia.
- El bonus de tiro solo aplica con ambos alineados.
- El relevo/fallecimiento resetea la química de ese hueco con noticia.
- Guardados antiguos cargan con `chemistry = {}`.

---

## Mejora 5 — El Panteón y las deudas de sangre

**Capa:** narrativa emergente. **Tamaño estimado:** medio. **Mejor ratio esfuerzo/impacto.**

### Contexto actual
`AbueloState.legacy` YA persiste cada generación pasada de un hueco
(`{gen, name, age, wins, losses, bestStreak, reason}` — ver
`model/AbueloState.js:159`), pero no se muestra en ningún sitio ni tiene
efectos. El fallecimiento (`Game._startWeeklyMatch → rollDeath`) es una noticia
y ya está. `nemesis` y `campaign` (capítulos con recompensa) ya existen.

### Diseño
1. **Pantalla Panteón**: nueva pestaña dentro de `screens/HemerotecaScreen.js`
   (o sub-pestaña en Mi Peña, decidir por espacio). Lista por hueco de
   plantilla: generaciones pasadas con nombre/edad/balance/motivo
   (`retiro` vs `fallecimiento`), la generación actual al final. Los datos ya
   están en `legacy` — es mayormente UI.
2. **Herencia**: al ejecutar `retireToGrandchild`, el nieto hereda UN eco del
   abuelo saliente, elegido al azar entre:
   - una afinidad climática suavizada: si el abuelo era inmune a un clima
     (`clima[k] === 1` en `data/abuelos.js`), el nieto tiembla un 5% menos con
     ese clima (nuevo campo `inherited: {clima: 'LLUVIA'}` en AbueloState,
     leído en `ThrowProfile`);
   - o +1 (escala 0-100: +10 en `bonus`) a la mejor stat del saliente.
   Noticia: "Dicen en el pueblo que tiene el pulso de su abuelo."
3. **Deuda de sangre**: si en el momento del relevo por fallecimiento hay una
   `nemesis` activa o el último partido del abuelo fue un derbi perdido, el
   nieto arranca con `debt: {clubId, label}`. Es un mini-objetivo personal
   visible en Mi Peña ("vengar a su abuelo contra X"). Al ganar a ese club con
   el nieto alineado: +10 moral al nieto, +XP, noticia épica, `debt = null`.
   Comprobación en `Career.finishWeeklyMatch` (liga) y cierres de copa.
4. **Libro de récords del club**: sección al final del Panteón, calculada al
   vuelo (sin persistencia nueva): mayor paliza (guardar solo
   `bestMarginWin: {score, rival}` en Player al cerrar partidos), racha
   histórica (max de `career.bestStreak` incluyendo `legacy`), primer título
   (`seasonTitles`, `cupTitles`), total de generaciones, `euroUpsets`.

### Puntos de enganche
- `screens/HemerotecaScreen.js`: pestaña nueva (patrón `drawTabRow` de
  `core/utils.js`, como en BarScreen).
- `model/AbueloState.js`: campos `inherited`, `debt` (+ serialización);
  lógica de herencia dentro de `retireToGrandchild` (la elección del eco puede
  calcularse ahí porque solo depende de ABUELO_DATA y del estado saliente).
- `core/Game.js:332` (bloque de `rollDeath`): construir `debt` ahí, que es
  donde se conoce el contexto (nemesis/derbi) en el momento de la muerte.
- `match/ThrowProfile.js`: leer `inherited.clima`.
- `model/Career.js` + cierres de copa: liquidar `debt`.
- `model/Player.js`: `bestMarginWin`.

### Criterios de aceptación
- El Panteón muestra las generaciones pasadas de un guardado que ya tenga
  `legacy` poblado (retro-compatible: los datos existen desde hace versiones).
- Un relevo genera herencia + noticia; un fallecimiento con némesis activa
  genera deuda visible, liquidable, con noticia épica al cumplirse.
- El libro de récords no inventa datos: campos vacíos se muestran como "—".

---

## Mejora 6 — Crónicas de partido generadas

**Capa:** narrativa. **Tamaño estimado:** pequeño-medio.

### Contexto actual
`match/Narrator.js` comenta en vivo, pero al cerrar el partido todo queda en
una línea de resultado (`Career.finishWeeklyMatch` → `news.push`). `Match` ya
conoce los hechos interesantes pero los descarta al terminar: remontadas,
manos medidas (`measured`), cambio de clima a mitad (`weatherChange`),
lesión en pista (`injuryEvent`), tiempo muerto, rachas (`streak`), faltas de
pie, la mano decisiva.

### Diseño
1. **Recolector de hechos**: `Match` acumula `this.chronicle = []` con eventos
   etiquetados a medida que ocurren (en `resolveMano`, en el bloque de falta,
   en el cambio de clima…). Cada entrada: `{t: 'remontada'|'medicion'|'clima'|
   'lesion'|'racha'|'decisiva'|'bolicheLargo'|…, data}`. Coste: una línea de
   push en cada sitio donde el hecho ya se detecta hoy.
2. **Compositor** (nuevo `match/Chronicle.js`): función pura
   `compose(match, ctx, outcome) → string[]` que elige los 2-4 hechos más
   relevantes (orden de prioridad fijo: lesión > remontada > decisiva > clima >
   medición > racha) y los redacta con plantillas variadas. Incluye siempre
   apertura (resultado + rival + sede) y cierre (clasificación o ronda de copa).
3. **Cronista con personalidad**: 2 firmas fijas en `data/` (p. ej. "ELADIO
   CIFUENTES, El Eco Comarcal" — ecuánime; "PACO ARENAS, La Voz de la Petanca"
   — siempre os tiene manía). Cada crónica sale firmada; Arenas escribe la
   crónica ~25% de las veces con plantillas más ácidas. Si había
   `pressPromise` incumplida, Arenas la escribe SIEMPRE y la cita.
4. **Almacenamiento**: la crónica se guarda como entrada destacada del
   `NewsFeed` (nuevo flag `{kind: 'chronicle'}` o prefijo) y
   `screens/HemerotecaScreen.js` la pinta multilínea y resaltada.
5. Aplica a partidos de liga JUGADOS en vivo y a copas. Los simulados
   (Debugger / `simulateMatch`) generan una crónica mínima de una línea.

### Puntos de enganche
- `match/Match.js`: pushes a `this.chronicle` (sin lógica nueva de detección).
- `match/Chronicle.js` (nuevo): compositor puro, testeable a mano.
- `model/Career.js → finishWeeklyMatch` y `core/Game.js →
  _finishCupMatch/_finishEuroCupMatch`: llamar al compositor. OJO: el
  compositor necesita el objeto `Match`, que vive en `Game` — pasar
  `game.match` o extraer antes los hechos (`match.chronicle`) al contexto.
- `model/NewsFeed.js`: soportar entradas multilínea/destacadas (revisar su
  serialización antes de tocar el formato).
- `screens/HemerotecaScreen.js`: render destacado.

### Criterios de aceptación
- Tras un partido en vivo con hechos (p. ej. cambio de clima + remontada), la
  crónica los cita correctamente y aparece firmada en la Hemeroteca.
- Una promesa de prensa incumplida produce crónica de Arenas citándola.
- Partidos simulados no rompen nada (crónica mínima).
- Los guardados con NewsFeed antiguo cargan sin errores.

---

## Orden recomendado y dependencias

1. **Mejora 5 (Panteón)** — sin dependencias, datos ya persistidos, impacto alto.
2. **Mejora 1 (boliche)** — sin dependencias; establece `jackChoice`, que las
   mejoras 2 y 6 citan.
3. **Mejora 2 (arquetipos)** — usa la preferencia de boliche de la 1 (opcional).
4. **Mejora 4 (compenetración)** — independiente; comparte con la 2 el patrón
   de "pasar más contexto a ThrowProfile".
5. **Mejora 6 (crónicas)** — cuanto más tarde, más hechos puede citar (boliche,
   arquetipos, momentos de pareja, deudas saldadas).
6. **Mejora 3 (decisiones)** — la última por volumen de contenido; su sistema
   de secuelas puede además referenciar deudas (5) y parejas (4) en eventos.

## Reglas transversales (aplican a todas)

- Compatibilidad de guardado: todo campo nuevo con fallback en `fromJSON`.
  No subir la versión de guardado (`v`) salvo cambio de forma incompatible.
- El modo Debugger (`debugAdvanceOneDay`, `simulateMatch`) debe seguir
  avanzando temporadas sin intervención: toda pantalla/decisión nueva necesita
  su rama de auto-resolución.
- Balance: los multiplicadores de tiro propuestos son punto de partida;
  mantenerlos como constantes con nombre al principio del archivo para poder
  retocarlos jugando (patrón ya usado en `AbueloState.js`).
- Textos: castellano costumbrista, consistente con `Narrator.js` y
  `pressTopics.js`. Nada de anglicismos en la UI.
