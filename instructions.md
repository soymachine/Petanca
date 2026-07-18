# PETANKA — Instrucciones de desarrollo

Juego de petanca 100% ASCII para navegador. Gestión de una peña de abuelos que
recorre España compitiendo en torneos, con físicas simuladas, meteorología
dinámica y narrativa emergente. Sin dependencias, sin build: HTML + CSS + JS
vanilla.

## Cómo ejecutar

- **Sin servidor**: abrir `index.html` directamente en el navegador (todo es estático).
- **Con servidor**: `python3 -m http.server 4321 --directory .` y abrir `http://localhost:4321`.

## Estructura de archivos

| Archivo | Contenido |
|---|---|
| `index.html` | Esqueleto: un `<pre id="screen">` y los 4 scripts. |
| `style.css`  | Fuente monoespaciada (Menlo 13px/15px), ancho máx. 1200px, `cursor: none`. |
| `main.js`    | Todo el juego: motor de render, entrada, físicas, pantallas, sistemas. |
| `art.js`     | **Generado**: foto de bolas de petanca (Wikimedia Commons) convertida a ASCII de color (`PHOTO_BANNER`). |
| `faces.js`   | **Generado**: 10 retratos de abuelos (pinturas clásicas de dominio público: Rembrandt, Frans Hals, van Eyck, El Greco + una foto antigua) en 60×39 (`photo`) y 18×12 (`mini`). |
| `rivals.js`  | **Generado**: 8 retratos mini de rivales (`RIVAL_FACES`), distintos de los del jugador. |

Los archivos generados salen de `/tmp/ascii_convert.py` (ver "Filtro ASCII").

## Motor de render

- Rejilla de **140×46 celdas**; dos buffers planos (`chars[]`, `colors[]`).
- Cada frame se reconstruye el HTML agrupando tramos del mismo color en `<span>`
  (una pasada por fila, runs por color para minimizar nodos).
- Primitivas: `put`, `text`, `textCenter`, `block` (arte multilínea, espacios
  transparentes), `box` (marcos simple/doble), `drawPhotoArt` (arte fotográfico
  indexado a paleta).
- Bucle con `requestAnimationFrame`; `dt` limitado a 50 ms.
- Entrada: teclado (`keys` mantenidas + `pressed` de un frame vía `hit(k)`) y
  ratón (celda calculada desde `getBoundingClientRect`; drag con `dx/dy`,
  `clicked` si el arrastre fue < 3 celdas). El cursor se dibuja como `◤` en la
  propia rejilla.

## Filtro ASCII de imágenes (`/tmp/ascii_convert.py`)

1. Recorte manual de la zona de interés (fracciones del ancho/alto).
2. Normalización a la proporción del destino (`rows = cols × (h/w) × 0.52`,
   donde 0.52 es el aspecto de la celda Menlo 13/15).
3. Realce (saturación ×1.6, contraste ×1.25) y `LANCZOS` al tamaño en celdas.
4. Luminancia → rampa de 52 caracteres `" .`':,;i!|(l1tfjxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$"`.
5. Color por celda cuantizado a ≤48 tonos (MEDIANCUT) y aclarado (+35%, +26)
   para leerse sobre fondo oscuro.
6. Salida JS: `{cols, rows, palette, chars[], colorIdx[][]}`.

Los retratos se eligieron de Wikimedia Commons (dominio público) evitando que
los rivales repitieran caras del jugador.

## Físicas de la partida

Coordenadas del terreno: 132×22 celdas, con corrección de aspecto — las
distancias reales usan `dy×2` (`dist2d`). Dos regímenes por bola:

- **Vuelo** (parábola): `vz -= GRAV·dt` (GRAV=26), sin fricción de suelo, el
  viento empuja fuerte (`×1.4×windFactor`). Al caer: bote seco si `vz < −9`
  (restitución 0.28), si no pasa a rodar perdiendo 50% de velocidad horizontal.
- **Rodadura**: fricción base FRICTION=22 multiplicada por el terreno
  (`groundFriction`), efecto (spin) como aceleración lateral ∝ velocidad,
  viento residual (×0.15).
- Colisiones círculo-círculo con restitución 0.75, masas 1 (bolas) / 0.15
  (boliche); solo colisionan bolas con `z ≤ 1.5` (una bola alta pasa por encima).
- Render de altura: la bola crece con `z` siempre en formato redondo
  (`o` → `●` → círculo 2×2 de medias celdas → bola 4×2 con esquinas `▗▖▝▘`),
  con sombra proyectada en el suelo y elevación visual `y − min(z×0.18, …)`.

### Secuencia de lanzamiento (4 fases)

1. **Puntería** `↑/↓` (±31°) — guía de puntos que se curva con el efecto.
2. **Efecto** `←/→` — el rango depende de la Maña del abuelo y las bolas.
3. **Elevación** `↑/↓` (10°–60°) — el bombeo se refleja en la guía: los puntos
   del centro del recorrido engordan (`·`→`o`→`●`).
4. **Potencia** — barra oscilante (velocidad según Temple y fatiga), con `✕`
   parpadeante marcando el punto de caída previsto
   (`carry = v²·sin(2·loft)/GRAV`).

Reglas de petanca reales: 3 bolas por bando, tira quien pierde la mano,
puntúa cada bola más cercana que la mejor rival, mano nula posible.

### IA rival

Balística inversa: elige elevación (tensa ~0.3–0.42 rad para tirar, bombeada
0.55–0.8 para arrimar), resuelve `v = √(G·carry/sin 2θ)`, compensa el viento
proporcionalmente a su nivel y aplica ruido gaussiano `err = 0.42 − nivel×0.045`
(+15% con lluvia/vendaval). Con ~15%+6%/nivel de probabilidad tira a apartar tu
mejor bola si manda.

## Sistemas de juego

### La peña (roster)

- 10 abuelos (índice = `FACES` = `ABUELO_DATA`): stats 1–10 de **Pulso**
  (temblor), **Brazo** (potencia máx.), **Maña** (efecto máx.), **Temple**
  (presión y barra), **Aguante** (fatiga), afinidad climática (−1/0/+1) y rasgo.
- Rasgos con mecánica: PACO moral nunca negativa (i=0), MANOLO guía 58 pasos
  (i=1), ANSELMO stamina llena al empezar torneo (i=2), EL RUBIO moral doble
  (i=4), EL CHATO inmune a presión (i=5), LUCIO windFactor 0.3 (i=7), FERMÍN
  −20% temblor si ganó la 1ª mano (i=8), BLAS ±15% según ronda (i=9).
- Se empieza con PACO + **un fichaje fundacional gratis** (`freePick`); el resto
  se ficha con dinero (250–700€). Candidatos se muestran con retrato en gris.
- `getStat(i,k) = base + bonus de entrenamiento` (tope 10).

### Torneos (3 rondas a 3 puntos)

`newTournament(city)`: CUARTOS → SEMIFINAL → FINAL, rival final = jefe de la
ciudad, niveles crecientes. Antes de cada ronda, pantalla de **alineación**:
abuelo (↑/↓), juego de bolas (←/→), previsión meteorológica con probabilidad de
cambio, marcadores ✚/▼ de afinidad. Jugar cuesta `45 − aguante×2` de stamina;
la fatiga (<60) aumenta temblor y velocidad de barra. Premio por etapa
alcanzada: 15% / 35% / 60% / 100%.

### Meteorología

Pesos por ciudad (`city.clima`); puede **cambiar a mitad de partida** con aviso
narrativo una mano antes (`M.weatherChange`). Efectos:

- **LLUVIA**: cortina de `/`, fricción ×1.35, niebla (bolas con `x > 70`
  parpadean; FERMÍN inmune, MANOLO desde `x > 45`) y **gotas pegadas al
  cristal** (`M.splats`, hasta 14, ttl 160–340 frames, se desvanecen en 3
  niveles de color).
- **VENDAVAL**: viento 2.4–4.2, racha nueva en cada tiro, partículas `∙ -`
  cruzando oblicuas (densidad ∝ fuerza).
- **CALOR**: ondas `~` ascendentes, drena stamina por mano
  (`(7 − aguante×0.4)`, ×1.6 si vulnerable, 0 si inmune).
- Banderita de viento: onda sinusoidal sobre `▂▃▄▅▆`, amplitud y velocidad ∝
  magnitud, orientada según dirección.

### Pistas con personalidad (`city.feature`)

| id | Ciudad | Efecto |
|---|---|---|
| `slope` | Cuenca | `vy += 2.2·dt` al rodar (flechas ▼) |
| `flat` | Albacete | terreno sin calvas |
| `tree` | Valencia | copa `♣♠❀`: globo con `z>4` dentro del radio cae muerto |
| `cierzo` | Zaragoza | viento mínimo 1.5 siempre |
| `fastdry` | Sevilla | fricción global ×0.8 |
| `puddles` | Bilbao | charcos `≈` (fricción ×4; ×2.2 con bolas estriadas); 4 si llueve |
| `walls` | Barcelona | rebote en bandas 0.78 (vs 0.4) |
| `pressure` | Madrid | penalización de presión ×1.7 |

El terreno (`GROUND`, manto `░` con calvas oscuras que multiplican la fricción
×1.6/×2.4) se regenera por partida con `makeGround`.

### Bolas de competición (`BOLAS`)

Mods aplicados a las bolas del jugador al lanzar: `wind` (factor de viento),
`impact` (impulso transmitido al golpear — lo aplica la bola más rápida del
choque), `pow` (± alcance), `roll` (factor de fricción), `spin` (factor de
efecto máx.), `grip` (ignora penalización de mojado), `wetPenalty`.
Se compran en EL BAR y se eligen por torneo en la alineación.

### Apuestas del bar

Generadas en `newTournament` si `stake ≥ 20€` (25% del dinero, tope 150):
tipo `win` (×2, ×3 si hay némesis en esa ciudad) o `clean` (×4 si encajas ≤3
puntos en todo el torneo — se rastrea `T.pointsAgainst`). Se aceptan con `[A]`
en la alineación de cuartos; el stake se cobra al aceptar y se liquida en
`endTournament`.

### Entrenamientos (desde MI PEÑA, cuesta 30 STA)

- `[A]` **ARRIME**: diana de 3 anillos (radios 3/6/9), 3 bolas, puntúa
  `max(0, 10 − dist)`; ≥16 puntos → **+1 Pulso** permanente.
- `[T]` **TIRO**: 3 bolas viejas (owner `'T'`, gris); derribada = desplazada
  >3 unidades de su origen (`+` marca la posición original); 3/3 en 4 tiros →
  **+1 Brazo**.
- Reutilizan el motor del match con `M.training`; si el stat ya está a 10, el
  premio se convierte en +3 moral.

### Liga de temporada

8 jornadas (cada torneo jugado = 1). Puntos: campeón 10, finalista 6, semis 3,
cuartos 1. Cuatro peñas rivales suman 2–7 aleatorios por jornada.
Clasificación en EL BAR. Al cerrar: 1º 500€+300 XP, 2º 250€+150 XP, resto
100€+50 XP, y se reinicia con `num+1`.

### Narrativa emergente

- **Comentarista** (`narrate`): línea contextual bajo el panel tras cada mano,
  golpe entre bolas (`M.lastCollision`), mano nula, árbol, cambios de clima.
- **Némesis**: quien te elimina queda en `player.nemesis`; ganar el torneo de
  esa ciudad da +50% XP y lo limpia. Se anuncia en mapa y alineación.
- **Moral** (−20..+20): ±8 por torneo ganado/jugado, −4 a los suplentes,
  afecta al temblor (`×(1 − mo×0.004)`).
- **Eventos de viaje** (30% al volver): gazpacho traicionero, siesta en el bus,
  entrevista en la radio, boina perdida → `mapEvent` en el mapa.

## Pantallas y navegación

`title → map ⇄ penya ⇄ bar` (pestañas `[1]/[2]/[3]`, TAB cicla, ESC al título)
`map → lineup → match → (lineup…) → result → map`
`penya → match (entrenamiento) → penya`

- **Mapa**: mundo = `SPAIN_MAP` escalado ×3 h / ×2 v, cámara con **click &
  drag**, centrada en Cuenca por defecto, click sobre ciudad para
  seleccionarla, recentrado automático al navegar con flechas. Ciudades
  bloqueadas por nivel de renombre.
- **Match HUD**: retratos mini jugador/rival (el marco del turno se ilumina),
  marcador gigante (fuente 4×5 `BIG_DIGITS`, azul/rojo), mano y meta, clima con
  banderita animada, stamina en vivo.

## Guardado

`localStorage` clave `petanka_save_v2`; migración automática desde
`petanka_save_v1` (dinero/XP/nivel/cara → roster). `ensureDefaults` añade los
campos nuevos (bolas, liga, bonus) a partidas viejas. `[B]` en el título borra
todo.

## Convenciones y trucos del código

- Todo color es un hex por celda; la paleta es libre (se pidió abundancia de
  color pese al arte ASCII).
- El aspecto de celda ~1:2 obliga a: `dy×2` en distancias, `y += vy·dt·0.5` en
  integración, y radios/elipses corregidos en todos los cálculos (blobs,
  charcos, árbol, diana).
- `Escape` tras lanzar: el `break` inmediato tras `throwBall` evita procesar
  teclas en el mismo frame.
- Las partículas/gotas usan coordenadas del terreno y se dibujan las últimas
  (por encima de bolas) para tapar de verdad.
- `pressed`/`mouse.clicked` se limpian al final de cada frame del bucle.

## Ideas pendientes (descartadas o futuras)

- Tiros especiales tipo *carreau* (descartado por el usuario).
- Lesiones/permadeath ligero (descartado de momento).
- Scroll en la lista de alineación si la peña supera ~7 abuelos (hoy se
  truncan visualmente).
- La IA no conoce las calvas ni los charcos: es deliberado (falla como un
  humano), pero podría escalarse con el nivel.
