# Next steps

Las 6 mejoras de profundidad de la ronda anterior ya están implementadas:

1. **El boliche es tuyo** — quien gana la mano elige distancia (corta/media/larga) y banda antes de la siguiente (`match/Match.js` fase `placeJack`, `match/Narrator.js`).
2. **Arquetipos de rival** — capitanes con estilo fijo (arrimador/tirador/muro/veterano frío) y moral de IA que sube y baja con el marcador (`data/rivalArchetypes.js`, `match/AIPlayer.js`, `domain/Club.seenArchetype`).
3. **Eventos de decisión** — el calendario ofrece 2-3 opciones con efecto inmediato y, en algunos casos, una secuela semanas después (`data/decisionEvents.js`, `core/Game.js`, modal en `screens/AgendaScreen.js`).
4. **Compenetración de parejas** — jugar junto suma vínculo con nombre y bonus de tiro; se rompe al relevo/fallecimiento (`domain/Chemistry.js`, visible en Mi Peña y Alineación).
5. **El Panteón** — pestaña nueva en Mi Peña con las generaciones pasadas de cada hueco, herencia climática/de stat al relevo, deudas de sangre saldables y libro de récords del club.
6. **Crónicas de partido** — al cerrar un partido en vivo, se compone una crónica de 2-4 hechos reales (remontada, lesión, medición, clima, racha) firmada por uno de dos cronistas (`match/Chronicle.js`).

Este archivo queda vacío a la espera de la próxima tanda de ideas.
