# Next steps

Las 6 mejoras de profundidad de la ronda anterior, el rebalanceo del sistema
de niveles y el fine-tuning granular de 5 dinámicas más ya están
implementados:

**Ronda de profundidad (gameplay/manager/narrativa):**
1. **El boliche es tuyo** — quien gana la mano elige distancia (corta/media/larga) y banda antes de la siguiente (`match/Match.js` fase `placeJack`, `match/Narrator.js`).
2. **Arquetipos de rival** — capitanes con estilo fijo (arrimador/tirador/muro/veterano frío) y moral de IA que sube y baja con el marcador (`data/rivalArchetypes.js`, `match/AIPlayer.js`, `domain/Club.seenArchetype`).
3. **Eventos de decisión** — el calendario ofrece 2-3 opciones con efecto inmediato y, en algunos casos, una secuela semanas después (`data/decisionEvents.js`, `core/Game.js`, modal en `screens/AgendaScreen.js`).
4. **Compenetración de parejas** — jugar junto suma vínculo con nombre y bonus de tiro; se rompe al relevo/fallecimiento (`domain/Chemistry.js`, visible en Mi Peña y Alineación).
5. **El Panteón** — pestaña nueva en Mi Peña con las generaciones pasadas de cada hueco, herencia climática/de stat al relevo, deudas de sangre saldables y libro de récords del club.
6. **Crónicas de partido** — al cerrar un partido en vivo, se compone una crónica de 2-4 hechos reales (remontada, lesión, medición, clima, racha) firmada por uno de dos cronistas (`match/Chronicle.js`).

**Sistema de niveles y modales (`model/AbueloState.js`, `screens/PenyaScreen.js`,
`screens/ResultScreen.js`, `screens/AgendaScreen.js`, `screens/BarScreen.js`):**
curva de XP cuadrática (cuesta más y cada vez más), puntos por nivel −15%,
tooltip granular con XP exacto, XP por partido en el resumen, y fix del ESC
para que cerrar una modal ya no te saque a Inicio de rebote.

**Fine-tuning granular de 5 dinámicas más:**
1. **Moral** — rendimientos decrecientes cerca de los topes, deriva semanal hacia el neutro, y efecto en el tiro por zonas ("crisis anímica" / "estado de gracia") en vez de una recta (`model/AbueloState.js`, `match/ThrowProfile.js`).
2. **Fatiga** — recuperación semanal sensible a la edad y al aguante, y "pared del cansancio" (el temblor se dispara más rápido por debajo de 30 STA) en vez de una penalización lineal (`model/AbueloState.js`, `match/ThrowProfile.js`).
3. **Economía** — curva de edad continua en el valor de mercado (sustituye un escalón que además era código muerto en la práctica) y cuota de socio ligada al ocupante real del hueco, no al precio fundacional fijo (`domain/RivalPlayer.js`, `model/Roster.js`).
4. **Junta directiva** — la confianza cambia según el margen y si el rival era mejor o peor sobre el papel (antes ±3/-5 fijos), y el objetivo de temporada crece de forma continua con las temporadas jugadas en vez de estancarse en "2º" para siempre a partir de la quinta (`model/Career.js`, `data/boardObjectives.js`, nuevo contador `Player.seasonsPlayed`).
5. **Declive por edad** — las stats físicas empiezan a resentirse de forma gradual a partir de los 78 años, `deathChance` acelera cuadráticamente en vez de linealmente, y las probabilidades de lesión (pasiva y en pleno partido) ahora son funciones continuas de edad/stamina en vez de escalones fijos (`model/AbueloState.js`, `model/Calendar.js`, `match/Match.js`).

Este archivo queda vacío a la espera de la próxima tanda de ideas.
