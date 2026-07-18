# Next steps

Overhaul completo del sistema de entrenamiento, ya implementado:

1. **3 minijuegos nuevos** — EFECTO (maña: rodear con efecto una bola que
   bloquea la línea recta al boliche), PRESIÓN (temple: la misma diana de
   arrime, pero con un temblor artificial que crece tirada a tirada,
   simulando los nervios de un momento decisivo) y FONDO (aguante: 8
   tiradas seguidas sin descanso, el pulso se resiente con la fatiga de la
   tanda). Junto con ARRIME y TIRO ya existentes, las 5 stats tienen ahora
   su propio entreno. Fuente única de verdad en `data/trainingDrills.js`
   (motor en `match/Match.js`, shake en `match/ThrowProfile.js`, dibujado
   en `screens/MatchScreen.js`).
2. **Instalaciones por stat** — el antiguo "gimnasio" único (multiplicaba
   el premio de CUALQUIER entrenamiento) se sustituye por 5 instalaciones
   independientes (una por stat), para que el jugador elija en qué
   especializar el club en vez de solo cuánto invertir
   (`data/facilities.js`, `model/FacilityManager.js`).
3. **Arquetipo propio del abuelo** — a diferencia del arquetipo rival (fijo
   de serie), este se GANA entrenando en serio una stat concreta; aparece
   en el tooltip de Mi Peña (`data/abueloArchetypes.js`).
4. **Modo Practicar** — los mismos 5 minijuegos, pero gratis, sin coste de
   stamina y sin ocupar día de la Agenda ni dar premio de stat: solo para
   coger soltura con los controles. Revive `Player.dailyBest` (existía
   desde hace tiempo pero no lo usaba nadie) como marca personal. Se
   accede desde El Club → Descampado (`screens/ClubScreen.js`,
   `Game.startPractice`).
5. **Selector de 5 drills** en vez de 2 en todos los sitios donde se
   agenda un entreno: modal de la Agenda, y el atajo `[T]` de Mi Peña (que
   pasó de disparar ARRIME/TIRO directos a abrir un selector, porque ya no
   caben 5 opciones en teclas sueltas sin chocar con `[P]`/`[G]`/`[M]`).

Verificado con `node --check` en los 11 archivos tocados/creados,
`tools/verify.mjs` (13/13) y tests headless end-to-end: los 5 minijuegos
completos (Match.js puro), el flujo real vía `Game.startTraining`/
`startPractice` (coste de stamina, premio de stat, `dailyBest`), agendar
desde Mi Peña/Agenda y que el día programado lance el drill correcto, y
las 4 pantallas nuevas/tocadas (modal de Agenda, modal de Mi Peña,
Descampado con 11 instalaciones a 3 columnas + panel Practicar, tooltip
con arquetipo) sin colisiones ni excepciones.

Este archivo queda vacío a la espera de la próxima tanda de ideas.
