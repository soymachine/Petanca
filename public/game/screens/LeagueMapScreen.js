import { CITIES } from '../data/cities.js';
import { FOREIGN_COUNTRIES, allForeignCityMarkers, foreignCountry, cityByName, levelBoundsFor } from '../data/countries.js';
import { seaCell } from '../core/seaFx.js';
import { TabsBar } from './TabsBar.js';
import { Geography } from '../data/geography.js';
import { hitRect, clamp } from '../core/utils.js';
import { STAT_KEYS, STAT_LABEL } from '../data/abuelos.js';
import { CrestGenerator } from '../portraits/CrestGenerator.js';

// Niveles de zoom del mapa: el índice 2 es el "normal" (extent=1, los 6
// países ocupando toda la rejilla). Alejar (extent>1) encoge el
// continente hacia el centro y el resto se recalcula como mar; acercar
// NO usa extent<1 (eso recortaba la ventana muestreada a una rejilla de
// tamaño fijo y dejaba ciudades lejos del centro, como Sevilla,
// inalcanzables al acercar del todo) — en su lugar `zoomInScale` agranda
// la propia rejilla ese factor, así que acercar es solo más resolución,
// nunca pérdida de área real (ver Geography y _geoFor). Solo el nivel más
// cercano dibuja la raya de frontera entre países (`showBorders`) — a
// niveles más alejados sería un hormigueo de puntos sin sentido.
const ZOOM_LEVELS = [
  { extent: 2.4, label: 'alejado x2' },
  { extent: 1.6, label: 'alejado' },
  { extent: 1.0, label: 'normal' },
  { extent: 1.0, zoomInScale: 1.6, label: 'acercado', showBorders: true },
];
const DEFAULT_ZOOM = 2;

// un color y un glyph por país extranjero, para distinguirlos de un
// vistazo en el mapa y en la leyenda — España se trata aparte (gris si no
// es la tuya, verde vivo si lo es, ver draw())
const COUNTRY_STYLE = {
  ES: { color: '#8a8a7a', glyph: '■' },
  FR: { color: '#6fa8dc', glyph: '▲' },
  IT: { color: '#e8433f', glyph: '◆' },
  BE: { color: '#e8c832', glyph: '●' },
  CH: { color: '#ff5c8a', glyph: '✡' },
  PT: { color: '#3fae7a', glyph: '▼' },
};

// todas las ciudades conocidas (jugables y no), con su país, para poder
// recorrerlas en un único bucle de dibujado/selección
const ALL_MARKERS = [
  ...CITIES.map((c) => ({ city: c, country: 'ES' })),
  ...allForeignCityMarkers(),
];

// Layout: el mapa ocupa todo el ancho arriba; debajo, una fila con la
// clasificación a la izquierda y los partidos de la jornada elegida a la
// derecha (con flechas para navegar jornadas anteriores/siguientes).
const MAP_BOX = { x: 3, y: 4, w: 134, h: 18 };
const MAP_VIEW = { x: MAP_BOX.x + 1, y: MAP_BOX.y + 1, w: MAP_BOX.w - 2, h: MAP_BOX.h - 2 };
const LEGEND_Y = MAP_BOX.y + MAP_BOX.h + 1;
const ROW_Y = LEGEND_Y + 2;
const STAND_BOX = { x: 3, y: ROW_Y, w: 65, h: 19 };
const RESULTS_BOX = { x: STAND_BOX.x + STAND_BOX.w + 2, y: ROW_Y, w: 134 - STAND_BOX.w - 2, h: 19 };

// El mapa de los 6 países del circuito, siempre visible entero: cada
// ciudad española es una liga jugable (asciendes/desciendes entre ellas);
// las de los 5 países extranjeros son ligas de fondo, solo consulta — de
// ahí sale la Copa de Europa.
export class LeagueMapScreen {
  constructor(game) {
    this.game = game;
    this.cursor = 0; // índice dentro de ALL_MARKERS
    this.cam = null;
    this.view = MAP_VIEW;
    this.zoom = DEFAULT_ZOOM;
    this._geoCache = new Map();
    this._hoverClub = null; // equipo bajo el ratón este frame (modo Debugger), ver draw()
    this._jornadaIdx = null; // jornada que se está consultando en el panel inferior
    this._jornadaKey = null; // marca de qué liga es this._jornadaIdx, para resetear al cambiar de liga
  }

  // Geography de cada nivel de zoom se construye una vez y se cachea; el
  // nivel "normal" reutiliza el Geography ya construido por Game (mismo
  // extent=1, para no duplicar el coste de construcción). Acercar pide una
  // rejilla `zoomInScale` veces más grande (en vez de extent<1) para que
  // el zoom sea solo más resolución y nunca recorte área real del mapa.
  _geoFor(zoom) {
    if (zoom === DEFAULT_ZOOM) return this.game.geography;
    if (!this._geoCache.has(zoom)) {
      const lvl = ZOOM_LEVELS[zoom];
      const scale = lvl.zoomInScale || 1;
      const w = Math.round(this.game.geography.width * scale);
      const h = Math.round(this.game.geography.height * scale);
      this._geoCache.set(zoom, new Geography(w, h, lvl.extent, !!lvl.showBorders));
    }
    return this._geoCache.get(zoom);
  }

  _cityPos(zoom, c) {
    return this._geoFor(zoom).toWorld(c.lon, c.lat);
  }

  _camClamp() {
    const geo = this._geoFor(this.zoom);
    this.cam.x = Math.max(-8, Math.min(this.cam.x, Math.max(-8, geo.width + 8 - this.view.w)));
    this.cam.y = Math.max(-3, Math.min(this.cam.y, Math.max(-3, geo.height + 3 - this.view.h)));
  }
  _camCenterOn(c) {
    const [wx, wy] = this._cityPos(this.zoom, c);
    this.cam = { x: Math.round(wx - this.view.w / 2), y: Math.round(wy - this.view.h / 2) };
    this._camClamp();
  }

  _setZoom(z) {
    z = Math.max(0, Math.min(ZOOM_LEVELS.length - 1, z));
    if (z === this.zoom) return;
    this.zoom = z;
    this._camCenterOn(ALL_MARKERS[this.cursor].city);
  }

  // liga (League) del marcador seleccionado, o null si es una liga
  // extranjera de la que aún no hay datos generados
  _leagueFor(marker) {
    const { player } = this.game;
    if (marker.country === player.homeCountry) return player.leagueWorld.leagueOf(marker.city.diff);
    return player.foreignLeagues.get(marker.country)?.leagueOf(marker.city.diff) || null;
  }

  draw() {
    const { screen, input, player, frame } = this.game;
    const geo = this._geoFor(this.zoom);
    screen.clear();
    TabsBar.draw(this.game, 'leaguemap');
    if (!this.cam) {
      const home = cityByName(player.league.cityName) || CITIES[0];
      this._camCenterOn(home);
    }

    const inView = input.mouse.cx >= this.view.x && input.mouse.cx < this.view.x + this.view.w &&
      input.mouse.cy >= this.view.y && input.mouse.cy < this.view.y + this.view.h;
    if (input.mouse.down && inView && (input.mouse.dx || input.mouse.dy)) {
      this.cam.x -= input.mouse.dx; this.cam.y -= input.mouse.dy;
      this._camClamp();
      input.mouse.dx = 0; input.mouse.dy = 0;
    }
    if (inView && input.wheel) this._setZoom(this.zoom - input.wheel);

    screen.box(MAP_BOX.x, MAP_BOX.y, MAP_BOX.w, MAP_BOX.h, '#4a5a6a');
    screen.text(MAP_BOX.x + 1, MAP_BOX.y, ' EL CIRCUITO ', '#ffb347');
    const zoomLabel = `[${ZOOM_LEVELS[this.zoom].label}] [-]/[+]`;
    screen.text(MAP_BOX.x + MAP_BOX.w - zoomLabel.length - 1, MAP_BOX.y, zoomLabel, '#8fb0c8');

    for (let r = 0; r < this.view.h; r++) {
      for (let c = 0; c < this.view.w; c++) {
        const wx = this.cam.x + c, wy = this.cam.y + r;
        const sx = this.view.x + c, sy = this.view.y + r;
        if (geo.isLand(wx, wy)) screen.put(sx, sy, geo.char[wy][wx], geo.color[wy][wx]);
        else { const sea = seaCell(wx, wy, frame); screen.put(sx, sy, sea.ch, sea.color); }
      }
    }

    const markerScreen = [];
    for (let i = 0; i < ALL_MARKERS.length; i++) {
      const { city: c, country } = ALL_MARKERS[i];
      const isMine = country === player.homeCountry && c.diff === player.currentLeagueLevel;
      const isSel = i === this.cursor;
      const style = COUNTRY_STYLE[country];
      const col = isMine ? '#7CFC00' : style ? style.color : '#8a8a8a';
      const [cwx, cwy] = this._cityPos(this.zoom, c);
      const sx = this.view.x + cwx - this.cam.x;
      const sy = this.view.y + cwy - this.cam.y;
      markerScreen.push({ i, sx, sy });
      if (sx >= this.view.x && sx < this.view.x + this.view.w && sy >= this.view.y && sy < this.view.y + this.view.h) {
        const glyph = isSel && frame % 20 < 12 ? '◈' : isMine ? '★' : style ? style.glyph : '■';
        screen.put(sx, sy, glyph, col);
        // etiqueta recortada al recuadro del mapa, para que nunca se salga
        // de su caja aunque el marcador esté pegado al borde
        const label = `${c.name}`;
        for (let k = 0; k < label.length; k++) {
          screen.putClipped(sx + 2 + k, sy, label[k], isSel ? '#fff' : col, this.view.x, this.view.y, this.view.w, this.view.h);
        }
      }
    }

    // leyenda de países: fila libre justo bajo el mapa (a su izquierda; la
    // clasificación ocupa la misma franja de filas a la derecha)
    let lx = MAP_BOX.x;
    const homeStyle = COUNTRY_STYLE[player.homeCountry] || COUNTRY_STYLE.ES;
    screen.text(lx, LEGEND_Y, `${homeStyle.glyph} ${player.homeCountry}`, homeStyle.color); lx += 6;
    for (const code of ['ES', ...FOREIGN_COUNTRIES.map((fc) => fc.code)]) {
      if (code === player.homeCountry) continue;
      const s = COUNTRY_STYLE[code];
      screen.text(lx, LEGEND_Y, s.glyph, s.color);
      lx += 2;
    }
    const hintY = LEGEND_Y + 1;
    const hintBase = 'arrastra = mover · rueda = zoom · ';
    screen.text(MAP_BOX.x, hintY, hintBase, '#5a5347');
    const miLigaX = MAP_BOX.x + hintBase.length;
    const miLigaLabel = '[M] MI LIGA';
    const miLigaOver = hitRect(input.mouse.cx, input.mouse.cy, miLigaX, hintY, miLigaLabel.length, 1);
    screen.text(miLigaX, hintY, miLigaLabel, miLigaOver ? '#ffe680' : '#7CFC00');

    if (input.mouse.clicked && inView) {
      let best = null;
      for (const cs of markerScreen) {
        const d = Math.abs(cs.sx - input.mouse.cx) + Math.abs(cs.sy - input.mouse.cy) * 2;
        if (d < 12 && (!best || d < best.d)) best = { i: cs.i, d };
      }
      if (best) this.cursor = best.i;
    }

    this._hoverClub = null; // se rellena en _drawStandings si hay un equipo bajo el ratón
    const marker = ALL_MARKERS[this.cursor];
    const league = this._leagueFor(marker);

    // la jornada consultada se resetea a "la última jugada" (o la primera,
    // si la temporada no ha arrancado) cada vez que se cambia de liga
    const key = `${marker.country}-${marker.city.diff}`;
    if (this._jornadaKey !== key) {
      this._jornadaKey = key;
      this._jornadaIdx = league ? Math.max(0, league.matchday - 1) : 0;
    }

    if (marker.country === player.homeCountry) this._drawHomeLeague(marker.city, league);
    else this._drawForeignLeague(marker.city, marker.country, league);

    this._drawJornadaPanel(marker, league);

    screen.textCenter(45, '[↑/↓] elegir liga  [←/→] navegar jornadas  [ENTER] entrar (solo la tuya)  [ESC] volver al hub', '#c9c2a8');

    // el tooltip se pinta el último de todo el frame (después de TabsBar,
    // la tabla y el texto de ayuda) para que quede siempre por encima del
    // resto de la UI y no se lo coma ningún elemento pintado después
    if (this._hoverClub) this._drawClubTooltip(this._hoverClub, input.mouse.cx, input.mouse.cy);

    if (input.hit('ArrowUp')) { this.cursor = (this.cursor + ALL_MARKERS.length - 1) % ALL_MARKERS.length; }
    if (input.hit('ArrowDown')) { this.cursor = (this.cursor + 1) % ALL_MARKERS.length; }
    if (input.hit('ArrowUp') || input.hit('ArrowDown')) {
      const sc = ALL_MARKERS[this.cursor].city;
      const [swx, swy] = this._cityPos(this.zoom, sc);
      const vx = swx - this.cam.x, vy = swy - this.cam.y;
      if (vx < 4 || vx > this.view.w - 10 || vy < 2 || vy > this.view.h - 2) this._camCenterOn(sc);
    }
    if (league && input.hit('ArrowLeft')) this._jornadaIdx = clamp(this._jornadaIdx - 1, 0, league.fixtures.length - 1);
    if (league && input.hit('ArrowRight')) this._jornadaIdx = clamp(this._jornadaIdx + 1, 0, league.fixtures.length - 1);
    if (input.hit('m') || input.hit('M') || (miLigaOver && input.mouse.clicked)) {
      const myIdx = ALL_MARKERS.findIndex((mk) => mk.country === player.homeCountry && mk.city.diff === player.currentLeagueLevel);
      if (myIdx >= 0) { this.cursor = myIdx; this._camCenterOn(ALL_MARKERS[myIdx].city); }
    }
    if (input.hit('+') || input.hit('=')) this._setZoom(this.zoom + 1);
    if (input.hit('-') || input.hit('_')) this._setZoom(this.zoom - 1);
    if ((input.hit('Enter') || input.hit(' ')) && marker.country === player.homeCountry && marker.city.diff === player.currentLeagueLevel) this.game.state = 'hub';
    if (input.hit('Escape')) this.game.state = 'hub';
  }

  _drawHomeLeague(c, league) {
    const { screen, player } = this.game;
    const isMine = c.diff === player.currentLeagueLevel;
    const canPromote = league.level < 8, canRelegate = league.level > levelBoundsFor(player.homeCountry).min;
    this._drawStandingsPanel(league, c.color, `⚜ ${c.name} — niv.${c.diff}/8${isMine ? '  ★ TU LIGA' : ''}`, c.feature.desc, canPromote, canRelegate);

    if (!isMine) {
      screen.text(STAND_BOX.x + 2, STAND_BOX.y + STAND_BOX.h - 2, player.currentLeagueLevel < c.diff
        ? 'Bloqueada: asciende para llegar aquí.'
        : 'Ya la dejaste atrás: desciende para volver.', '#ff8c5b');
    } else {
      screen.text(STAND_BOX.x + 2, STAND_BOX.y + STAND_BOX.h - 2, '[ENTER] volver al hub de tu liga', '#7CFC00');
    }
  }

  // liga de un país extranjero: misma tabla de clasificación, pero sin
  // ascenso/descenso ni "TU LIGA" — es solo una ventana a lo que se cuece
  // fuera, de cara a saber quién puede tocarte en la Copa de Europa
  _drawForeignLeague(c, country, league) {
    const { screen } = this.game;
    const style = COUNTRY_STYLE[country] || { color: '#8fb0c8' };
    const label = (foreignCountry(country) || {}).label || country;
    screen.box(STAND_BOX.x, STAND_BOX.y, STAND_BOX.w, STAND_BOX.h, c.color || style.color, 'double');
    if (!league) {
      screen.text(STAND_BOX.x + 2, STAND_BOX.y + 2, `⚜ ${c.name} (${label.toUpperCase()})`, style.color);
      screen.text(STAND_BOX.x + 2, STAND_BOX.y + 4, 'Aún no hay datos de esta liga.', '#8a8a7a');
      return;
    }
    this._drawStandingsPanel(league, style.color, `⚜ ${c.name} (${label.toUpperCase()}) — niv.${c.diff}`, c.feature.desc, false, false);
    if (c.diff === 8) {
      screen.text(STAND_BOX.x + 2, STAND_BOX.y + STAND_BOX.h - 3, 'Los 4 primeros entran en la', style.color);
      screen.text(STAND_BOX.x + 2, STAND_BOX.y + STAND_BOX.h - 2, 'Copa de Europa contigo.', style.color);
    } else {
      screen.text(STAND_BOX.x + 2, STAND_BOX.y + STAND_BOX.h - 2, 'Liga extranjera: solo consulta.', '#8a8a7a');
    }
  }

  // caja de clasificación en una sola columna: cabecera (nombre de liga +
  // pista) y debajo, un club por fila (hasta 10)
  _drawStandingsPanel(league, boxColor, title, pistaDesc, canPromote, canRelegate) {
    const { screen } = this.game;
    const b = STAND_BOX;
    screen.box(b.x, b.y, b.w, b.h, boxColor || '#8a7f66', 'double');
    screen.text(b.x + 2, b.y + 1, title, '#ffb347');
    screen.text(b.x + 2, b.y + 2, `Pista: ${pistaDesc.slice(0, b.w - 12)}`, '#c9a35d');
    if (canPromote || canRelegate) {
      let zx = b.x + 2;
      if (canPromote) { screen.text(zx, b.y + 3, '▲ ascenso', '#7ec850'); zx += 12; }
      if (canRelegate) screen.text(zx, b.y + 3, '▼ descenso', '#ff5c5c');
    }
    this._drawStandings(league.standings(), b.x + 2, b.y + 5, b.w - 4, canPromote, canRelegate);
  }

  _drawStandings(table, x, y0, w, canPromote, canRelegate) {
    const { screen, input, player } = this.game;
    const RANK_COL = ['#ffd75e', '#d8d8e0', '#c88a4a'];
    const rowRects = [];
    const nameW = Math.max(10, w - 18);
    for (let i = 0; i < table.length; i++) {
      const row = table[i];
      const ty = y0 + i;
      const isTop3 = i < 3;
      const rankCol = isTop3 ? RANK_COL[i] : '#8a8a7a';
      const zone = (i < 2 && canPromote) ? '▲' : (i >= table.length - 2 && canRelegate) ? '▼' : ' ';
      const zoneCol = zone === '▲' ? '#7ec850' : zone === '▼' ? '#ff5c5c' : '#5a5347';
      const nameCol = row.isPlayer ? '#7CFC00' : '#c9c2a8';
      screen.text(x, ty, zone, zoneCol);
      screen.text(x + 2, ty, `${(i + 1 + '').padStart(2)}º`, rankCol);
      const label = `${row.name}${row.isPlayer ? ' ★' : ''}`.slice(0, nameW).padEnd(nameW);
      screen.text(x + 6, ty, label, nameCol);
      screen.text(x + 6 + nameW + 1, ty, `${row.won} (G) / ${row.lost} (P)`, nameCol);
      rowRects.push({ club: row, x, y: ty, w });
    }

    // pasar el ratón por cualquier equipo (el nuestro incluido) enseña su
    // escudo y los nombres de su plantilla — quién juega en cada club no es
    // ningún secreto. Las stats reales, en cambio, sí son información
    // privada: de un rival solo se destapan si ya lo hemos scouteado (ver
    // _drawClubTooltip); las nuestras se ven siempre, es nuestra plantilla.
    // No se pinta aquí: se guarda y se pinta al final de draw() para que
    // quede siempre por encima del resto de la UI (ver draw()).
    const hovered = rowRects.find((r) => hitRect(input.mouse.cx, input.mouse.cy, r.x, r.y, r.w, 1));
    if (hovered) this._hoverClub = hovered.club;
  }

  // panel inferior a todo lo ancho: partidos de la jornada consultada
  // (resultados si ya se jugó, o el emparejamiento si está por jugar),
  // navegable con [←/→] independientemente de la liga elegida arriba
  _drawJornadaPanel(marker, league) {
    const { screen } = this.game;
    const b = RESULTS_BOX;
    screen.box(b.x, b.y, b.w, b.h, '#4a5a6a', 'double');
    if (!league) {
      screen.text(b.x + 2, b.y + 1, 'Aún no hay datos de esta liga.', '#8a8a7a');
      return;
    }
    const total = league.fixtures.length;
    const idx = clamp(this._jornadaIdx ?? 0, 0, total - 1);
    const played = idx < league.matchday;
    const isCurrent = idx === Math.max(0, league.matchday - 1) && league.matchday > 0;

    const arrowCol = idx > 0 ? '#ffe680' : '#3a4a3a';
    const arrowCol2 = idx < total - 1 ? '#ffe680' : '#3a4a3a';
    screen.text(b.x + 2, b.y + 1, '◀', arrowCol);
    screen.text(b.x + b.w - 3, b.y + 1, '▶', arrowCol2);
    const title = `JORNADA ${idx + 1}/${total}${isCurrent ? ' (última)' : ''}`;
    screen.text(b.x + Math.floor((b.w - title.length) / 2), b.y + 1, title, '#ffb347');
    const subtitle = played ? 'RESULTADOS' : (idx === league.matchday ? 'POR JUGAR' : 'PRÓXIMOS PARTIDOS');
    screen.text(b.x + Math.floor((b.w - subtitle.length) / 2), b.y + 2, subtitle, played ? '#7ec850' : '#8fb0c8');

    const fixtures = league.fixturesForMatchday(idx);
    const results = played ? league.resultsForMatchday(idx) : [];
    const resultFor = (aId, bId) => results.find((r) => (r.a === aId && r.b === bId) || (r.a === bId && r.b === aId));

    const rowY0 = b.y + 4;
    const midX = b.x + Math.floor(b.w / 2); // centro de la caja (el panel ya no ocupa toda la pantalla)
    const nameW = Math.max(8, Math.floor((b.w - 16) / 2));
    fixtures.forEach(([aId, bId], i) => {
      const clubA = league.clubById(aId), clubB = league.clubById(bId);
      if (!clubA || !clubB) return;
      const ty = rowY0 + i * 2;
      const r = resultFor(aId, bId);
      const nameA = (clubA.isPlayer ? '★ ' : '') + clubA.name;
      const nameB = clubB.name + (clubB.isPlayer ? ' ★' : '');
      const colA = clubA.isPlayer ? '#7CFC00' : '#c9c2a8';
      const colB = clubB.isPlayer ? '#7CFC00' : '#c9c2a8';
      const mid = r ? `${r.a === aId ? r.scoreA : r.scoreB}-${r.a === aId ? r.scoreB : r.scoreA}` : 'vs';
      const half = Math.ceil(mid.length / 2);
      screen.text(midX - half - 2 - nameW, ty, nameA.slice(0, nameW).padStart(nameW), colA);
      screen.text(midX - half, ty, mid, r ? '#ffe680' : '#8a8a7a');
      screen.text(midX + (mid.length - half) + 2, ty, nameB.slice(0, nameW).padEnd(nameW), colB);
    });

    screen.text(b.x + 2, b.y + b.h - 2, '[←] anterior   [→] siguiente', '#8a7f66');
  }

  // escudo + nombre del club, y quién juega en él, para cualquier equipo de
  // la tabla — quién forma la plantilla rival no es ningún secreto. Las
  // stats reales, en cambio, solo se destapan para nuestra propia plantilla
  // (obviamente) o para un rival que ya hayamos scouteado en el Mercado
  // (mismo `statsRevealed` que usa Game.marketEntries/PenyaScreen — si no,
  // sería enseñar gratis lo que en Ojeadores cuesta tiempo y dinero
  // averiguar). Modo Debugger solo añade la caja del club y, por jugador
  // rival sin scoutear, su valor de mercado — nunca sus stats reales.
  _drawClubTooltip(club, mx, my) {
    const { screen, player } = this.game;
    const crest = CrestGenerator.generate(club.name);
    const countryTag = club.country && club.country !== player.homeCountry ? ` (${(foreignCountry(club.country) || {}).label || club.country})` : '';

    const lines = [[`${club.name}${countryTag}`, '#ffe680']];
    if (player.debugMode && !club.isPlayer) lines.push([`Caja del club: ${club.money ?? 0}€`, '#c9c2a8']);
    lines.push(['', '#000']);

    if (club.isPlayer) {
      // nuestra propia plantilla: es la nuestra, se ve entera siempre
      const ids = player.roster.ids;
      if (!ids.length) lines.push(['(sin jugadores)', '#8a8a7a']);
      for (const id of ids) {
        const s = player.roster.get(id);
        lines.push([`${this.game.displayName(id)}  ·  ${s.age} años`, '#a8e8a8']);
        const statsTxt = STAT_KEYS.map((k) => `${STAT_LABEL[k].slice(0, 3)} ${s.getStatDisplay(k)}`).join('  ');
        lines.push([`  ${statsTxt}`, '#88c8e8']);
      }
    } else if (!club.players.length) {
      lines.push(['(sin jugadores)', '#8a8a7a']);
    } else {
      for (const p of club.players) {
        const forSaleTag = player.debugMode && p.forSale ? '  [EN VENTA]' : '';
        lines.push([`· ${p.name}${forSaleTag}  ·  ${p.age} años`, player.debugMode && p.forSale ? '#ffd75e' : '#a8e8a8']);
        if (p.statsRevealed) {
          const statsTxt = STAT_KEYS.map((k) => `${STAT_LABEL[k].slice(0, 3)} ${p.stats[k]}`).join('  ');
          lines.push([`  ${statsTxt}`, '#88c8e8']);
        } else if (player.debugMode) {
          lines.push([`  sin scoutear  ·  valor ${p.value}€`, '#5a5347']);
        }
      }
    }

    const crestW = 13, textX = crestW + 2;
    const maxLineLen = Math.max(...lines.map((l) => l[0].length));
    const tw = Math.min(82, textX + maxLineLen + 4);
    const th = Math.max(13, lines.length) + 2;
    const tx = Math.min(mx + 2, screen.cols - tw - 1);
    const ty = Math.min(my + 1, screen.rows - th - 1);
    this._fillBlack(tx, ty, tw, th);
    screen.box(tx, ty, tw, th, '#88c8e8', 'double');
    screen.drawPortrait(crest, tx + 2, ty + 1);
    lines.forEach((l, i) => screen.text(tx + 2 + textX, ty + 1 + i, l[0].slice(0, tw - 3 - textX), l[1]));
  }

  _fillBlack(x, y, w, h) {
    const { screen } = this.game;
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) screen.put(x + c, y + r, '█', '#000');
  }
}
