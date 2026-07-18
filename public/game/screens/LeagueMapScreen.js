import { CITIES } from '../data/cities.js';
import { FOREIGN_COUNTRIES, allForeignCityMarkers, foreignCountry } from '../data/countries.js';
import { seaCell } from '../core/seaFx.js';
import { TabsBar } from './TabsBar.js';
import { Geography } from '../data/geography.js';
import { hitRect } from '../core/utils.js';
import { STAT_KEYS, STAT_LABEL } from '../data/abuelos.js';

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
  FR: { color: '#6fa8dc', glyph: '▲' },
  IT: { color: '#e8433f', glyph: '◆' },
  BE: { color: '#e8c832', glyph: '●' },
  CH: { color: '#ff5c8a', glyph: '✚' },
  PT: { color: '#3fae7a', glyph: '▼' },
};

// todas las ciudades conocidas (jugables y no), con su país, para poder
// recorrerlas en un único bucle de dibujado/selección
const ALL_MARKERS = [
  ...CITIES.map((c) => ({ city: c, country: 'ES' })),
  ...allForeignCityMarkers(),
];

// El mapa de los 6 países del circuito, siempre visible entero: cada
// ciudad española es una liga jugable (asciendes/desciendes entre ellas);
// las de los 5 países extranjeros son ligas de fondo, solo consulta — de
// ahí sale la Copa de Europa.
export class LeagueMapScreen {
  constructor(game) {
    this.game = game;
    this.cursor = 0; // índice dentro de ALL_MARKERS
    this.cam = null;
    this.view = { x: 3, y: 4, w: game.screen.cols - 6, h: 27 };
    this.zoom = DEFAULT_ZOOM;
    this._geoCache = new Map();
    this._hoverClub = null; // equipo bajo el ratón este frame (modo Debugger), ver draw()
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

  draw() {
    const { screen, input, player, frame } = this.game;
    const geo = this._geoFor(this.zoom);
    screen.clear();
    TabsBar.draw(this.game, 'leaguemap');
    if (!this.cam) {
      const home = CITIES.find((c) => c.diff === player.currentLeagueLevel) || CITIES[0];
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

    screen.box(this.view.x - 1, this.view.y - 1, this.view.w + 2, this.view.h + 2, '#4a5a6a');
    screen.text(this.view.x + 2, this.view.y - 1, '╡ EL CIRCUITO EUROPEO — arrastra para explorar · rueda = zoom ╞', '#ffb347');
    const zoomLabel = `[${ZOOM_LEVELS[this.zoom].label}]  [-] alejar  [+] acercar`;
    screen.text(this.view.x + this.view.w - zoomLabel.length - 1, this.view.y - 1, zoomLabel, '#8fb0c8');

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
      const isMine = country === 'ES' && c.diff === player.currentLeagueLevel;
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
        const label = `${c.name} (${country === 'ES' ? 'niv.' + c.diff : country})`;
        for (let k = 0; k < label.length; k++) screen.put(sx + 2 + k, sy, label[k], isSel ? '#fff' : col);
      }
    }

    // leyenda de países: fila libre justo bajo el mapa, antes de la caja
    // de la clasificación — necesaria ahora que hay 6 colores distintos
    let lx = this.view.x;
    const legendY = this.view.y + this.view.h;
    screen.text(lx, legendY, '■ España', '#8a8a7a'); lx += 10;
    for (const fc of FOREIGN_COUNTRIES) {
      const s = COUNTRY_STYLE[fc.code];
      const label = `${s.glyph} ${fc.label}`;
      screen.text(lx, legendY, label, s.color);
      lx += label.length + 2;
    }

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
    if (marker.country === 'ES') this._drawSpanishLeague(marker.city);
    else this._drawForeignLeague(marker.city, marker.country);

    screen.textCenter(46 - 1, '[↑/↓] elegir liga    [ENTER] entrar (solo la tuya)    [ESC] volver al hub', '#c9c2a8');

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
      if (vx < 4 || vx > this.view.w - 16 || vy < 2 || vy > this.view.h - 2) this._camCenterOn(sc);
    }
    if (input.hit('+') || input.hit('=')) this._setZoom(this.zoom + 1);
    if (input.hit('-') || input.hit('_')) this._setZoom(this.zoom - 1);
    if ((input.hit('Enter') || input.hit(' ')) && marker.country === 'ES' && marker.city.diff === player.currentLeagueLevel) this.game.state = 'hub';
    if (input.hit('Escape')) this.game.state = 'hub';
  }

  _drawSpanishLeague(c) {
    const { screen, player } = this.game;
    const isMine = c.diff === player.currentLeagueLevel;
    const league = player.leagueWorld.leagueOf(c.diff);
    screen.box(4, 33, 132, 12, c.color || '#8a7f66', 'double');
    screen.text(7, 34, `⚜ LIGA DE ${c.name} — nivel ${c.diff}/8${isMine ? '  ★ TU LIGA' : ''} ⚜`, isMine ? '#7CFC00' : '#ffb347');
    screen.text(7, 35, `Pista: ${c.feature.desc.slice(0, 70)}`, '#c9a35d');

    const table = league.standings();
    const canPromote = league.level < 8, canRelegate = league.level > 1;
    this._drawStandings(table, 37, canPromote, canRelegate);

    screen.text(84, 37, canPromote ? '▲ verde: zona de ascenso' : '', '#7ec850');
    screen.text(84, 38, canRelegate ? '▼ rojo:  zona de descenso' : '', '#ff5c5c');

    if (!isMine) {
      screen.text(84, 40, player.currentLeagueLevel < c.diff
        ? 'Bloqueada: asciende para llegar aquí.'
        : 'Ya la dejaste atrás: desciende para volver.', '#ff8c5b');
    } else {
      screen.text(84, 40, '[ENTER] volver al hub de tu liga', '#7CFC00');
    }
  }

  // liga de un país extranjero: misma tabla de clasificación, pero sin
  // ascenso/descenso ni "TU LIGA" — es solo una ventana a lo que se cuece
  // fuera, de cara a saber quién puede tocarte en la Copa de Europa
  _drawForeignLeague(c, country) {
    const { screen, player } = this.game;
    const style = COUNTRY_STYLE[country] || { color: '#8fb0c8' };
    const label = (foreignCountry(country) || {}).label || country;
    const league = player.foreignLeagues.get(country)?.leagueOf(c.diff);
    screen.box(4, 33, 132, 12, c.color || style.color, 'double');
    screen.text(7, 34, `⚜ LIGA DE ${c.name} (${label.toUpperCase()}) — nivel ${c.diff} ⚜`, style.color);
    screen.text(7, 35, `Pista: ${c.feature.desc.slice(0, 70)}`, '#c9a35d');
    if (!league) { screen.text(7, 37, 'Aún no hay datos de esta liga.', '#8a8a7a'); return; }

    const table = league.standings();
    this._drawStandings(table, 37, false, false);

    if (c.diff === 8) {
      screen.text(84, 37, 'Los 4 primeros de aquí entran', style.color);
      screen.text(84, 38, 'en la Copa de Europa contigo.', style.color);
    }
    screen.text(84, 40, 'Liga extranjera: solo consulta, no se juega.', '#8a8a7a');
  }

  _drawStandings(table, y0, canPromote, canRelegate) {
    const { screen, input, player } = this.game;
    const RANK_COL = ['#ffd75e', '#d8d8e0', '#c88a4a'];
    const rowRects = [];
    const drawEntry = (row, i, tx, ty) => {
      const isTop3 = i < 3;
      const rankCol = isTop3 ? RANK_COL[i] : '#8a8a7a';
      const zone = (i < 2 && canPromote) ? '▲' : (i >= table.length - 2 && canRelegate) ? '▼' : ' ';
      const zoneCol = zone === '▲' ? '#7ec850' : zone === '▼' ? '#ff5c5c' : '#5a5347';
      const nameCol = row.isPlayer ? '#7CFC00' : '#c9c2a8';
      screen.text(tx, ty, `${zone}`, zoneCol);
      screen.text(tx + 2, ty, `${(i + 1 + '').padStart(2)}º`, rankCol);
      const label = `${row.name}${row.isPlayer ? ' ★' : ''}`.slice(0, 24).padEnd(26);
      screen.text(tx + 5, ty, label, nameCol);
      screen.text(tx + 31, ty, `${row.pts} pts`, nameCol);
      if (!row.isPlayer) rowRects.push({ club: row, x: tx, y: ty, w: 37 });
    };
    for (let i = 0; i < Math.min(5, table.length); i++) drawEntry(table[i], i, 7, y0 + i);
    for (let i = 5; i < table.length; i++) drawEntry(table[i], i, 45, y0 + (i - 5));

    // modo Debugger: pasar el ratón por un equipo rival muestra su
    // plantilla real (nombre, stats, valor) — para poder debugar el
    // Mercado y la generación de jugadores sin tener que fichar a nadie.
    // No se pinta aquí: se guarda y se pinta al final de draw() para que
    // quede siempre por encima del resto de la UI (ver draw()).
    if (player.debugMode) {
      const hovered = rowRects.find((r) => hitRect(input.mouse.cx, input.mouse.cy, r.x, r.y, r.w, 1));
      if (hovered) this._hoverClub = hovered.club;
    }
  }

  _drawClubTooltip(club, mx, my) {
    const { screen } = this.game;
    const lines = [];
    const countryTag = club.country && club.country !== 'ES' ? ` (${(foreignCountry(club.country) || {}).label || club.country})` : '';
    lines.push([`${club.name}${countryTag}`, '#ffe680']);
    lines.push([`Caja del club: ${club.money ?? 0}€`, '#c9c2a8']);
    lines.push(['', '#000']);
    if (!club.players.length) lines.push(['(sin jugadores)', '#8a8a7a']);
    for (const p of club.players) {
      lines.push([`${p.name}${p.forSale ? '  [EN VENTA]' : ''}  ·  ${p.age} años  ·  valor ${p.value}€`, p.forSale ? '#ffd75e' : '#a8e8a8']);
      const statsTxt = STAT_KEYS.map((k) => `${STAT_LABEL[k].slice(0, 3)} ${p.stats[k]}`).join('  ');
      lines.push([`  ${statsTxt}`, '#88c8e8']);
    }

    const tw = Math.min(70, Math.max(...lines.map((l) => l[0].length)) + 4);
    const th = lines.length + 2;
    const tx = Math.min(mx + 2, screen.cols - tw - 1);
    const ty = Math.min(my + 1, screen.rows - th - 1);
    this._fillBlack(tx, ty, tw, th);
    screen.box(tx, ty, tw, th, '#88c8e8', 'double');
    lines.forEach((l, i) => screen.text(tx + 2, ty + 1 + i, l[0].slice(0, tw - 3), l[1]));
  }

  _fillBlack(x, y, w, h) {
    const { screen } = this.game;
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) screen.put(x + c, y + r, '█', '#000');
  }
}
