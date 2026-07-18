/* ============================================================
   PETANKA — juego de petanca 100% ASCII
   Gestión de peña: plantilla de abuelos, torneos por rondas,
   meteorología dinámica y narrativa emergente.
   ============================================================ */
'use strict';

// ------------------------------------------------------------
// Pantalla ASCII (buffer de caracteres + colores)
// ------------------------------------------------------------
const COLS = 140;
const ROWS = 46;

const screenEl = document.getElementById('screen');
const chars = new Array(ROWS * COLS);
const colors = new Array(ROWS * COLS);

function clearScreen(bg) {
  for (let i = 0; i < ROWS * COLS; i++) { chars[i] = ' '; colors[i] = bg || '#556'; }
}

function put(x, y, ch, color) {
  x |= 0; y |= 0;
  if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return;
  chars[y * COLS + x] = ch;
  colors[y * COLS + x] = color;
}

function text(x, y, str, color) {
  for (let i = 0; i < str.length; i++) put(x + i, y, str[i], color);
}

function textCenter(y, str, color) {
  text(Math.floor((COLS - str.length) / 2), y, str, color);
}

function block(x, y, lines, color) {
  for (let r = 0; r < lines.length; r++) {
    const line = lines[r];
    for (let c = 0; c < line.length; c++) {
      if (line[c] !== ' ') put(x + c, y + r, line[c], color);
    }
  }
}

function box(x, y, w, h, color, style) {
  const S = style === 'double'
    ? { tl:'╔', tr:'╗', bl:'╚', br:'╝', h:'═', v:'║' }
    : { tl:'┌', tr:'┐', bl:'└', br:'┘', h:'─', v:'│' };
  for (let i = 1; i < w - 1; i++) { put(x+i, y, S.h, color); put(x+i, y+h-1, S.h, color); }
  for (let i = 1; i < h - 1; i++) { put(x, y+i, S.v, color); put(x+w-1, y+i, S.v, color); }
  put(x, y, S.tl, color); put(x+w-1, y, S.tr, color);
  put(x, y+h-1, S.bl, color); put(x+w-1, y+h-1, S.br, color);
}

function render() {
  let html = '';
  for (let y = 0; y < ROWS; y++) {
    let runColor = null, run = '';
    for (let x = 0; x < COLS; x++) {
      const i = y * COLS + x;
      const col = colors[i];
      if (col !== runColor) {
        if (run) html += `<span style="color:${runColor}">${escapeHtml(run)}</span>`;
        run = ''; runColor = col;
      }
      run += chars[i];
    }
    if (run) html += `<span style="color:${runColor}">${escapeHtml(run)}</span>`;
    html += '\n';
  }
  screenEl.innerHTML = html;
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Dibuja arte fotográfico convertido a ASCII (art.js / faces.js / rivals.js)
function drawPhotoArt(art, x, y) {
  for (let r = 0; r < art.rows; r++) {
    const line = art.chars[r], idx = art.colorIdx[r];
    for (let c = 0; c < art.cols; c++) {
      if (line[c] !== ' ') put(x + c, y + r, line[c], art.palette[idx[c]]);
    }
  }
}

// ------------------------------------------------------------
// Utilidades
// ------------------------------------------------------------
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
function gauss() { return (Math.random() + Math.random() + Math.random() + Math.random() - 2) / 2; }
// RNG determinista sembrada por fecha, para el desafío diario
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function pickWeighted(weights) {
  const entries = Object.entries(weights);
  let tot = 0; for (const [, w] of entries) tot += w;
  let r = Math.random() * tot;
  for (const [k, w] of entries) { r -= w; if (r <= 0) return k; }
  return entries[0][0];
}

// ------------------------------------------------------------
// Entrada
// ------------------------------------------------------------
const keys = {};
let pressed = {};
window.addEventListener('keydown', e => {
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' ','Tab'].includes(e.key)) e.preventDefault();
  if (!keys[e.key]) pressed[e.key] = true;
  keys[e.key] = true;
});
window.addEventListener('keyup', e => { keys[e.key] = false; });
function hit(k) { return !!pressed[k]; }

// --- ratón (cursor ASCII + click & drag en el mapa) ---
const mouse = { cx: -1, cy: -1, down: false, clicked: false, dragDist: 0 };
screenEl.addEventListener('mousemove', e => {
  const r = screenEl.getBoundingClientRect();
  const ncx = Math.floor((e.clientX - r.left) / (r.width / COLS));
  const ncy = Math.floor((e.clientY - r.top) / (r.height / ROWS));
  if (mouse.down && mouse.cx >= 0) {
    mouse.dx = ncx - mouse.cx;
    mouse.dy = ncy - mouse.cy;
    mouse.dragDist += Math.abs(mouse.dx) + Math.abs(mouse.dy);
  } else { mouse.dx = 0; mouse.dy = 0; }
  mouse.cx = ncx; mouse.cy = ncy;
});
screenEl.addEventListener('mouseleave', () => { mouse.cx = -1; mouse.cy = -1; mouse.down = false; });
screenEl.addEventListener('mousedown', () => { mouse.down = true; mouse.dragDist = 0; });
window.addEventListener('mouseup', () => {
  if (mouse.down && mouse.dragDist < 3) mouse.clicked = true;
  mouse.down = false; mouse.dx = 0; mouse.dy = 0;
});

function drawCursor() {
  if (mouse.cx < 0) return;
  put(mouse.cx, mouse.cy, '◤', '#ffffff');
}

// ------------------------------------------------------------
// Datos de los abuelos (índice = FACES)
// stats 1..10 · clima: -1 le perjudica doble, 0 normal, +1 inmune
// ------------------------------------------------------------
const ABUELO_DATA = [
  { price: 0,   stats: { pulso: 7, brazo: 5, mana: 6, temple: 6, aguante: 6 },
    trait: 'Capitán fundador: su moral nunca baja de cero.',
    clima: { LLUVIA: 0, VIENTO: 0, CALOR: 0 } },
  { price: 250, stats: { pulso: 9, brazo: 3, mana: 4, temple: 5, aguante: 5 },
    trait: 'Ojo de lince: su guía de tiro es larguísima. Con lluvia se le empañan las gafas.',
    clima: { LLUVIA: -1, VIENTO: 0, CALOR: 0 } },
  { price: 300, stats: { pulso: 5, brazo: 6, mana: 5, temple: 7, aguante: 7 },
    trait: 'Siesta sagrada: empieza cada torneo con la stamina al máximo. El sombrero le salva del sol.',
    clima: { LLUVIA: 0, VIENTO: 0, CALOR: 1 } },
  { price: 450, stats: { pulso: 4, brazo: 9, mana: 3, temple: 6, aguante: 6 },
    trait: 'Brazo de mula: potencia descomunal, pero el calor le funde.',
    clima: { LLUVIA: 0, VIENTO: 0, CALOR: -1 } },
  { price: 350, stats: { pulso: 6, brazo: 5, mana: 7, temple: 4, aguante: 6 },
    trait: 'Presumido: la moral le sube y le baja el doble. El viento le despeina.',
    clima: { LLUVIA: 0, VIENTO: -1, CALOR: 0 } },
  { price: 500, stats: { pulso: 5, brazo: 7, mana: 4, temple: 8, aguante: 5 },
    trait: 'Nervios de acero: la presión del marcador no le afecta jamás.',
    clima: { LLUVIA: 0, VIENTO: 0, CALOR: 0 } },
  { price: 400, stats: { pulso: 6, brazo: 4, mana: 8, temple: 7, aguante: 4 },
    trait: 'Manos de santo: efecto máximo. La barba le da un calor terrible.',
    clima: { LLUVIA: 0, VIENTO: 0, CALOR: -1 } },
  { price: 550, stats: { pulso: 7, brazo: 4, mana: 6, temple: 6, aguante: 5 },
    trait: 'Lee el viento en el humo de su pipa: el vendaval no le mueve la bola. La lluvia se la apaga.',
    clima: { LLUVIA: -1, VIENTO: 1, CALOR: 0 } },
  { price: 600, stats: { pulso: 6, brazo: 6, mana: 5, temple: 9, aguante: 7 },
    trait: 'Supersticioso: si gana la primera mano, se crece (+pulso el resto de la partida).',
    clima: { LLUVIA: 1, VIENTO: 0, CALOR: 0 } },
  { price: 700, stats: { pulso: 8, brazo: 6, mana: 6, temple: 3, aguante: 5 },
    trait: 'Chulería: se agranda en las finales y se aburre en los cuartos. Las gafas de sol no son postureo.',
    clima: { LLUVIA: 0, VIENTO: 0, CALOR: 1 } },
];

// Juegos de bolas de competición
const BOLAS = [
  { name: 'LAS DEL ABUELO', price: 0,
    desc: 'Las de toda la vida. Equilibradas y con mataduras.',
    mods: {} },
  { name: 'PESADAS', price: 300,
    desc: 'Acero macizo: el viento apenas las toca y apartan que da gusto, pero llegan menos.',
    mods: { wind: 0.55, impact: 1.4, pow: -5 } },
  { name: 'LISAS', price: 400,
    desc: 'Pulidas como un espejo: ruedan finas en seco, pero cogen poco efecto y patinan en mojado.',
    mods: { roll: 0.72, spin: 0.65, wetPenalty: 1.3 } },
  { name: 'ESTRIADAS', price: 500,
    desc: 'Las ranuras muerden la tierra: más efecto, agarre total en lluvia, ruedan menos.',
    mods: { roll: 1.18, spin: 1.35, grip: true } },
];

// Amuletos de la peña (se ganan como premio raro, no se compran)
const ITEMS = {
  petaca:  { name: 'LA PETACA DE LA SUERTE', icon: '🍶',
             desc: 'Nunca deja caer del todo el ánimo del abuelo (moral mínima −10 en vez de −20).' },
  panuelo: { name: 'EL PAÑUELO DE LA ABUELA', icon: '🧣',
             desc: 'Le hace inmune a un clima concreto, llueva, sople o achicharre.' },
  reloj:   { name: 'EL RELOJ DEL PUEBLO', icon: '⏱',
             desc: 'La barra de potencia se mueve más despacio: más tiempo para calcular el tiro.' },
};
const ITEM_IDS = Object.keys(ITEMS);

// Capítulos de la campaña ("Historia de la peña"): objetivos que se
// comprueban solos contra el estado del jugador y dan un premio único.
const CAMPAIGN_CHAPTERS = [
  { id: 'first_win', title: 'EL PRIMER TÍTULO', desc: 'Gana tu primer torneo.',
    check: p => p.wins >= 1, reward: { m: 100, x: 50 } },
  { id: 'refuerzos', title: 'REFUERZOS', desc: 'Ficha a 3 abuelos para la peña.',
    check: p => p.roster.length >= 3, reward: { m: 150, x: 80 } },
  { id: 'gira', title: 'GIRA NACIONAL', desc: 'Gana torneos en 3 ciudades distintas.',
    check: p => p.citiesWon.length >= 3, reward: { m: 250, x: 150 } },
  { id: 'venganza', title: 'OJO POR OJO', desc: 'Vence a tu némesis en su propia ciudad.',
    check: p => p.nemesisDefeats >= 1, reward: { m: 200, x: 120 } },
  { id: 'liga', title: 'CAMPEONES DE COMARCA', desc: 'Sé campeón de la liga de peñas.',
    check: p => p.seasonTitles >= 1, reward: { m: 400, x: 250 } },
  { id: 'relevo', title: 'RELEVO GENERACIONAL', desc: 'Retira a un abuelo y da paso a su nieto.',
    check: p => Object.values(p.state).some(s => s.gen > 0), reward: { m: 150, x: 100 } },
  { id: 'tormenta', title: 'BAJO TORMENTA', desc: 'Gana un torneo jugado bajo una tormenta.',
    check: p => p.stormWins >= 1, reward: { m: 300, x: 200 } },
  { id: 'completa', title: 'LA PEÑA AL COMPLETO', desc: 'Ficha a los 10 abuelos del pueblo.',
    check: p => p.roster.length >= 10, reward: { m: 500, x: 400 } },
];

// Peñas rivales de la liga
const PENAS_LIGA = ['PEÑA EL BOLICHE', 'LOS DEL BAR PACO', 'PEÑA LA BOINA', 'CLUB SIRIMIRI'];

const CLIMAS = {
  SOL:     { icon: '☼', color: '#ffe14d', label: 'SOL' },
  LLUVIA:  { icon: '☂', color: '#6fb6e8', label: 'LLUVIA' },
  VIENTO:  { icon: '≋', color: '#9fd8e8', label: 'VENDAVAL' },
  CALOR:   { icon: '♨', color: '#ff9c5b', label: 'CALOR EXTREMO' },
  NIEBLA:  { icon: '≡', color: '#a8b0b0', label: 'NIEBLA CERRADA' },
  HELADA:  { icon: '❄', color: '#cfe8f5', label: 'HELADA' },
  TORMENTA:{ icon: '⚡', color: '#c8a0e8', label: 'TORMENTA' },
};
function isRainy(w)  { return w === 'LLUVIA' || w === 'TORMENTA'; }
function isWindy(w)  { return w === 'VIENTO' || w === 'TORMENTA'; }

// ------------------------------------------------------------
// Guardado / peña
// ------------------------------------------------------------
const SAVE_KEY = 'petanka_save_v2';
let player = loadPlayer();

function newPlayer() {
  return ensureDefaults({
    v: 2, money: 150, xp: 0, level: 1, wins: 0, losses: 0,
    roster: [0], freePick: true, captain: 0,
    state: { 0: { st: 100, mo: 0 } },
    nemesis: null,
  });
}

// completa campos nuevos en partidas guardadas antiguas
function ensureDefaults(p) {
  if (!p.bolasOwned) p.bolasOwned = [0];
  if (p.bolaSel === undefined) p.bolaSel = 0;
  if (!p.season) {
    p.season = { num: 1, jornada: 0, pts: 0,
                 rivals: PENAS_LIGA.map(n => ({ name: n, pts: 0 })) };
  }
  for (const k of Object.keys(p.state || {})) {
    if (!p.state[k].bonus) p.state[k].bonus = {};
  }
  if (!p.citiesWon) p.citiesWon = [];
  if (p.nemesisDefeats === undefined) p.nemesisDefeats = 0;
  if (p.seasonTitles === undefined) p.seasonTitles = 0;
  if (p.stormWins === undefined) p.stormWins = 0;
  if (!p.campaign) p.campaign = { claimed: [] };
  if (!p.news) p.news = [];
  if (!p.dailyBest) p.dailyBest = {};
  return p;
}

function pushNews(text) {
  player.news.unshift(text);
  if (player.news.length > 30) player.news.length = 30;
}

function loadPlayer() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p.v === 2) return ensureDefaults(p);
    }
    // migrar partida v1
    const old = localStorage.getItem('petanka_save_v1');
    if (old) {
      const o = JSON.parse(old);
      const p = newPlayer();
      p.money = o.money || 150; p.xp = o.xp || 0; p.level = o.level || 1;
      p.wins = o.wins || 0; p.losses = o.losses || 0;
      const f = o.face || 0;
      if (!p.roster.includes(f)) { p.roster.push(f); p.freePick = false; }
      p.state[f] = { st: 100, mo: 0 };
      p.captain = f;
      return p;
    }
  } catch (e) {}
  return newPlayer();
}
function savePlayer() { localStorage.setItem(SAVE_KEY, JSON.stringify(player)); }

function abState(i) {
  if (!player.state[i]) player.state[i] = { st: 100, mo: 0, bonus: {} };
  if (!player.state[i].bonus) player.state[i].bonus = {};
  if (player.state[i].gen === undefined) player.state[i].gen = 0;
  if (player.state[i].torneos === undefined) player.state[i].torneos = 0;
  return player.state[i];
}

// stat efectiva = base (o la heredada del nieto) + bonus de entrenamiento (tope 10)
function getStat(i, k) {
  const s = abState(i);
  const base = (s.genStats && s.genStats[k] !== undefined) ? s.genStats[k] : ABUELO_DATA[i].stats[k];
  return clamp(base + (s.bonus[k] || 0), 1, 10);
}

const RETIRE_AT = 8; // torneos jugados para poder retirarse con honores

// releva al abuelo por su nieto: nuevas stats, misma cara, borra el cansancio acumulado
function retireToGrandchild(i) {
  const s = abState(i);
  const ks = ['pulso', 'brazo', 'mana', 'temple', 'aguante'];
  const genStats = {};
  for (const k of ks) {
    const base = ABUELO_DATA[i].stats[k];
    genStats[k] = clamp(base + Math.round(gauss() * 2) + (k === 'aguante' ? 1 : 0), 3, 9);
  }
  s.genStats = genStats;
  s.bonus = {};
  s.torneos = 0;
  s.mo = 0;
  s.st = 100;
  s.gen = (s.gen || 0) + 1;
  savePlayer();
}
function addMoral(i, d) {
  const s = abState(i);
  if (i === 4) d *= 2;                 // EL RUBIO: presumido
  const floor = i === 0 ? 0 : (s.item && s.item.id === 'petaca' ? -10 : -20); // PACO nunca negativa
  s.mo = clamp(s.mo + d, floor, 20);
}

// intenta conceder un amuleto nuevo a un abuelo que aún no tenga uno
function maybeDropItem(candidates) {
  const eligible = candidates.filter(i => !abState(i).item);
  if (!eligible.length || Math.random() > 0.18) return null;
  const i = eligible[Math.floor(rnd(0, eligible.length))];
  const id = ITEM_IDS[Math.floor(rnd(0, ITEM_IDS.length))];
  const item = { id };
  if (id === 'panuelo') {
    const opts = ['LLUVIA', 'VIENTO', 'CALOR', 'NIEBLA', 'HELADA'];
    item.clima = opts[Math.floor(rnd(0, opts.length))];
  }
  abState(i).item = item;
  return { i, item };
}

function xpForLevel(lv) { return lv * 300; }
function addReward(xp, money) {
  player.xp += xp;
  player.money += money;
  let ups = 0;
  while (player.xp >= xpForLevel(player.level)) {
    player.xp -= xpForLevel(player.level);
    player.level++;
    ups++;
  }
  savePlayer();
  return ups;
}

// ------------------------------------------------------------
// Ciudades y torneos
// ------------------------------------------------------------
// lon/lat = coordenadas geográficas reales aproximadas; se traducen a
// coordenadas del mapa-mundo (wx/wy) más abajo, junto al resto de geografía.
const CITIES = [
  { name: 'CUENCA',    lon: -2.14, lat: 40.07, diff: 1, minLevel: 1, color: '#7ec850',
    clima: { SOL: 5, LLUVIA: 2, VIENTO: 2, CALOR: 2, NIEBLA: 2, HELADA: 1 },
    feature: { id: 'slope', desc: 'Pista inclinada: las bolas ruedan cuesta abajo (hacia el sur).' } },
  { name: 'ALBACETE',  lon: -1.86, lat: 38.99, diff: 2, minLevel: 1, color: '#7ec850',
    clima: { SOL: 5, LLUVIA: 1, VIENTO: 3, CALOR: 3, NIEBLA: 1, HELADA: 1 },
    feature: { id: 'flat', desc: 'La llanura perfecta: tierra lisa sin una sola calva.' } },
  { name: 'VALENCIA',  lon: -0.38, lat: 39.47, diff: 3, minLevel: 2, color: '#e8c832',
    clima: { SOL: 6, LLUVIA: 2, VIENTO: 2, CALOR: 3 },
    feature: { id: 'tree', desc: 'El plátano centenario: los globos altos acaban entre sus ramas.' } },
  { name: 'ZARAGOZA',  lon: -0.88, lat: 41.65, diff: 4, minLevel: 3, color: '#e8c832',
    clima: { SOL: 3, LLUVIA: 1, VIENTO: 7, CALOR: 2, HELADA: 2 },
    feature: { id: 'cierzo', desc: 'El cierzo no descansa: aquí siempre sopla algo.' } },
  { name: 'SEVILLA',   lon: -5.99, lat: 37.39, diff: 5, minLevel: 4, color: '#f2903a',
    clima: { SOL: 4, LLUVIA: 1, VIENTO: 1, CALOR: 7 },
    feature: { id: 'fastdry', desc: 'Albero recocho: la tierra dura hace rodar las bolas de más.' } },
  { name: 'BILBAO',    lon: -2.94, lat: 43.26, diff: 6, minLevel: 5, color: '#f2903a',
    clima: { SOL: 2, LLUVIA: 7, VIENTO: 3, CALOR: 1, NIEBLA: 3 },
    feature: { id: 'puddles', desc: 'Charcos permanentes: donde caen, las bolas se ahogan.' } },
  { name: 'BARCELONA', lon: 2.17, lat: 41.39, diff: 7, minLevel: 6, color: '#e8433f',
    clima: { SOL: 4, LLUVIA: 3, VIENTO: 3, CALOR: 2 },
    feature: { id: 'walls', desc: 'Pista urbana con tablones duros: las bandas devuelven la bola.' } },
  { name: 'MADRID',    lon: -3.70, lat: 40.42, diff: 8, minLevel: 7, color: '#e8433f',
    clima: { SOL: 4, LLUVIA: 2, VIENTO: 2, CALOR: 4, NIEBLA: 1, HELADA: 1 },
    feature: { id: 'pressure', desc: 'Foco mediático: la presión pesa el doble. Temple o muerte.' } },
];
const RIVALS = ['EL SABIO', 'PACO EL LARGO', 'LA JOSEFA', 'EL CARDENAL', 'DON EVARISTO',
                'EL DE BILBAO', 'REMEDIOS', 'MARISCAL RAMÓN'];
const ROUND_NAMES = ['CUARTOS', 'SEMIFINAL', 'FINAL'];

function cityReward(c) { return { xp: 80 + c.diff * 60, money: 50 + c.diff * 75 }; }

// ------------------------------------------------------------
// ASCII art
// ------------------------------------------------------------
const TITLE_ART = [
  '██████╗ ███████╗████████╗ █████╗ ███╗   ██╗██╗  ██╗ █████╗ ',
  '██╔══██╗██╔════╝╚══██╔══╝██╔══██╗████╗  ██║██║ ██╔╝██╔══██╗',
  '██████╔╝█████╗     ██║   ███████║██╔██╗ ██║█████╔╝ ███████║',
  '██╔═══╝ ██╔══╝     ██║   ██╔══██║██║╚██╗██║██╔═██╗ ██╔══██║',
  '██║     ███████╗   ██║   ██║  ██║██║ ╚████║██║  ██╗██║  ██║',
  '╚═╝     ╚══════╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝  ╚═╝',
];

const TROPHY_ART = [
  '     ___________     ',
  '    \'._==_==_=_.\'    ',
  '    .-\\:      /-.    ',
  '   | (|:.     |) |   ',
  '    \'-|:.     |-\'    ',
  '      \\::.    /      ',
  '       \'::. .\'       ',
  '         ) (         ',
  '       _.\' \'._       ',
  '      `"""""""`      ',
];

// Fuente 4x5 para el marcador gigante
const BIG_DIGITS = {
  '0': ['████', '█  █', '█  █', '█  █', '████'],
  '1': ['  █ ', ' ██ ', '  █ ', '  █ ', ' ███'],
  '2': ['████', '   █', '████', '█   ', '████'],
  '3': ['████', '   █', ' ███', '   █', '████'],
  '4': ['█  █', '█  █', '████', '   █', '   █'],
  '5': ['████', '█   ', '████', '   █', '████'],
  '6': ['████', '█   ', '████', '█  █', '████'],
  '7': ['████', '   █', '  █ ', ' █  ', ' █  '],
  '8': ['████', '█  █', '████', '█  █', '████'],
  '9': ['████', '█  █', '████', '   █', '████'],
  '-': ['    ', '    ', ' ██ ', '    ', '    '],
};

// ------------------------------------------------------------
// Estado global
// ------------------------------------------------------------
let state = 'title';   // title | map | penya | lineup | match | result
let mapCursor = 0;
let faceCursor = player.captain || 0;
let lineupCursor = 0;
let frame = 0;
let mapEvent = null;   // aviso narrativo en el mapa

// Torneo en curso
let T = null;
// { city, roundIdx, rounds:[{name, rivalIdx, aiLevel, forecast:{main,changeProb,changeTo}}],
//   results:[], usados:[] }

let M = null;          // partida en curso

// ------------------------------------------------------------
// TORNEO
// ------------------------------------------------------------
function newTournament(city) {
  const finalRival = city.diff - 1;
  const others = [];
  while (others.length < 2) {
    const r = Math.floor(rnd(0, RIVALS.length));
    if (r !== finalRival && !others.includes(r)) others.push(r);
  }
  const rounds = [];
  for (let i = 0; i < 3; i++) {
    let main = pickWeighted(city.clima);
    // TORMENTA: evento raro (lluvia+viento a la vez), premia el doble si se gana bajo ella
    if (Math.random() < 0.03) main = 'TORMENTA';
    let changeTo = main;
    while (changeTo === main) changeTo = pickWeighted(city.clima);
    rounds.push({
      name: ROUND_NAMES[i],
      rivalIdx: i === 2 ? finalRival : others[i],
      aiLevel: Math.max(1, city.diff - (2 - i)),
      forecast: { main, changeProb: main === 'TORMENTA' ? 0 : (Math.random() < 0.35 ? rnd(0.4, 0.8) : 0), changeTo },
    });
  }
  T = { city, roundIdx: 0, rounds, results: [], usados: [],
        bola: player.bolaSel || 0, pointsAgainst: 0, bet: null, stormPlayed: false,
        formato: 1, teamSel: [], timeouts: 1 };
  // apuesta del bar
  const stake = Math.min(150, Math.floor(player.money * 0.25 / 10) * 10);
  if (stake >= 20) {
    if (Math.random() < 0.4) {
      T.bet = { type: 'clean', stake, mult: 4, accepted: false,
        desc: `${stake}€ a que encajáis más de 3 puntos en el torneo (x4 si aguantáis)` };
    } else {
      const nem = player.nemesis && player.nemesis.city === city.name;
      T.bet = { type: 'win', stake, mult: nem ? 3 : 2, accepted: false,
        desc: `${stake}€ a que no ganáis el torneo (x${nem ? 3 : 2}${nem ? ', huele la revancha' : ''})` };
    }
  }
  // ANSELMO: siesta sagrada — empieza el torneo a tope
  if (player.roster.includes(2)) abState(2).st = 100;
  lineupCursor = 0;
}

// Torneo relámpago: mismo reto para todos en el mismo día (semilla = fecha)
function newDailyChallenge() {
  const date = todayStr();
  const rng = mulberry32(hashStr('petanka-daily-' + date));
  const city = CITIES[Math.floor(rng() * CITIES.length)];
  const weatherKeys = Object.keys(city.clima);
  const weather = weatherKeys[Math.floor(rng() * weatherKeys.length)];
  const rivalIdx = Math.floor(rng() * RIVALS.length);
  const aiLevel = 3 + Math.floor(rng() * 6);
  T = {
    city, roundIdx: 0, results: [], usados: [],
    rounds: [{ name: 'RELÁMPAGO', rivalIdx, aiLevel, forecast: { main: weather, changeProb: 0, changeTo: weather } }],
    bola: player.bolaSel || 0, pointsAgainst: 0, bet: null, stormPlayed: false,
    formato: 1, teamSel: [], isDaily: true, dailyDate: date, timeouts: 1,
  };
  lineupCursor = 0;
}

function stagePct(roundIdx, wonFinal) {
  if (wonFinal) return 1;
  return [0.15, 0.35, 0.6][roundIdx];
}

function endTournament(won) {
  const base = cityReward(T.city);
  const pct = stagePct(T.roundIdx, won);
  let xp = Math.round(base.xp * pct);
  let money = Math.round(base.money * pct);
  // revancha cumplida
  let revenge = false;
  if (won && player.nemesis && player.nemesis.city === T.city.name) {
    xp = Math.round(xp * 1.5); revenge = true; player.nemesis = null;
  }
  // TORMENTA: si ganasteis el torneo habiendo jugado bajo tormenta, doble premio
  const stormWin = won && T.stormPlayed;
  if (stormWin) { xp = Math.round(xp * 2); money = Math.round(money * 2); player.stormWins++; }
  if (won) {
    player.wins++;
    if (!player.citiesWon.includes(T.city.name)) player.citiesWon.push(T.city.name);
    if (revenge) player.nemesisDefeats++;
    pushNews(revenge
      ? `VENGANZA SERVIDA: la peña se proclama campeona en ${T.city.name} y ajusta cuentas con ${RIVALS[T.rounds[T.roundIdx].rivalIdx]}.`
      : `¡CAMPEONES EN ${T.city.name}! La peña se trae el torneo bajo el brazo.`);
  } else {
    player.losses++;
    const r = T.rounds[T.roundIdx];
    player.nemesis = { rival: RIVALS[r.rivalIdx], rivalIdx: r.rivalIdx, city: T.city.name };
    pushNews(`DISGUSTO EN ${T.city.name}: ${RIVALS[r.rivalIdx]} elimina a la peña en ${ROUND_NAMES[T.roundIdx]}.`);
  }
  // moral: los que jugaron y ganaron el torneo suben; los eternos suplentes bajan
  for (const i of player.roster) {
    if (T.usados.includes(i)) { if (won) addMoral(i, 8); }
    else addMoral(i, -4);
  }
  // recuperación de stamina de todos al viajar
  for (const i of player.roster) abState(i).st = clamp(abState(i).st + 45, 0, 100);
  // amuleto de premio (solo si se gana un torneo de dificultad decente)
  let itemDrop = null;
  if (won && T.city.diff >= 3) {
    itemDrop = maybeDropItem(T.usados);
    if (itemDrop) pushNews(`${FACES[itemDrop.i].name} vuelve del torneo con ${ITEMS[itemDrop.item.id].name} bajo el brazo.`);
  }
  // apuesta del bar
  let betResult = null;
  if (T.bet && T.bet.accepted) {
    const betWon = T.bet.type === 'win' ? won : T.pointsAgainst <= 3;
    if (betWon) {
      const payout = T.bet.stake * T.bet.mult;
      player.money += payout;
      betResult = { won: true, amount: payout };
    } else {
      betResult = { won: false, amount: T.bet.stake };
    }
  }
  // liga de temporada
  const ligaPts = won ? 10 : [1, 3, 6][T.roundIdx];
  player.season.pts += ligaPts;
  for (const rv of player.season.rivals) rv.pts += Math.floor(rnd(2, 8));
  player.season.jornada++;
  let seasonEnd = null;
  if (player.season.jornada >= 8) {
    const table = [{ name: 'TU PEÑA', pts: player.season.pts },
                   ...player.season.rivals].sort((a, b) => b.pts - a.pts);
    const rank = table.findIndex(t => t.name === 'TU PEÑA') + 1;
    const prize = rank === 1 ? { m: 500, x: 300 } : rank === 2 ? { m: 250, x: 150 } : { m: 100, x: 50 };
    player.money += prize.m; player.xp += prize.x;
    if (rank === 1) { player.seasonTitles++; pushNews(`¡LA PEÑA, CAMPEONA DE LA LIGA en su temporada ${player.season.num}!`); }
    else pushNews(`Fin de temporada ${player.season.num}: la peña acaba ${rank}ª en la liga.`);
    seasonEnd = { rank, prize, num: player.season.num };
    player.season = { num: player.season.num + 1, jornada: 0, pts: 0,
                      rivals: PENAS_LIGA.map(n => ({ name: n, pts: 0 })) };
  }
  const ups = addReward(xp, money);
  // evento aleatorio de camino a casa
  mapEvent = null;
  if (seasonEnd) {
    mapEvent = seasonEnd.rank === 1
      ? `¡CAMPEONES DE LIGA de la temporada ${seasonEnd.num}! +${seasonEnd.prize.m}€. El pueblo entero de fiesta.`
      : `Fin de la temporada ${seasonEnd.num}: acabáis ${seasonEnd.rank}º. +${seasonEnd.prize.m}€ de premio.`;
  }
  if (!mapEvent && Math.random() < 0.3 && player.roster.length > 1) {
    const i = player.roster[Math.floor(rnd(0, player.roster.length))];
    const evs = [
      { t: `A ${FACES[i].name} le ha sentado mal el gazpacho del bar: -20 stamina.`, f: () => abState(i).st = clamp(abState(i).st - 20, 0, 100) },
      { t: `${FACES[i].name} ha dormido como un lirón en el autobús: +15 stamina.`, f: () => abState(i).st = clamp(abState(i).st + 15, 0, 100) },
      { t: `A ${FACES[i].name} le han hecho una entrevista en la radio local: +6 moral.`, f: () => addMoral(i, 6) },
      { t: `${FACES[i].name} ha perdido la boina en el viaje y está de morros: -5 moral.`, f: () => addMoral(i, -5) },
    ];
    const ev = evs[Math.floor(rnd(0, evs.length))];
    ev.f(); mapEvent = ev.t;
  }
  // desafío diario: guarda la mejor marca del día
  let dailyResult = null;
  if (T.isDaily) {
    const margin = M.scoreP - M.scoreA;
    const prev = player.dailyBest[T.dailyDate];
    if (!prev || margin > prev.margin) {
      player.dailyBest[T.dailyDate] = { won, margin, rival: M.rival, city: T.city.name };
    }
    dailyResult = player.dailyBest[T.dailyDate];
    pushNews(won
      ? `RELÁMPAGO DE ${T.dailyDate}: victoria ${M.scoreP}-${M.scoreA} en ${T.city.name}.`
      : `RELÁMPAGO DE ${T.dailyDate}: derrota ${M.scoreP}-${M.scoreA} en ${T.city.name}.`);
  }
  savePlayer();
  return { won, xp, money, ups, revenge, pct, betResult, ligaPts, stormWin, itemDrop, dailyResult };
}

// ------------------------------------------------------------
// PARTIDA (match)
// ------------------------------------------------------------
const CW = 132;
const CH = 22;
const COURT_X = 4;
const COURT_Y = 15;
const BALL_R = 0.9;
const JACK_R = 0.55;
const FRICTION = 22;
const GRAV = 26;
const THROW_X = 7;
const TARGET = 3;      // rondas a 3 puntos

function dist2d(ax, ay, bx, by) {
  const dx = ax - bx, dy = (ay - by) * 2;
  return Math.sqrt(dx * dx + dy * dy);
}

function newMatch(abueloOrTeam) {
  const team = Array.isArray(abueloOrTeam) ? abueloOrTeam.slice() : [abueloOrTeam];
  const r = T.rounds[T.roundIdx];
  M = {
    city: T.city,
    stage: T.roundIdx,
    totalRounds: T.rounds.length,
    isDaily: !!T.isDaily,
    feature: T.city.feature.id,
    bolaMods: BOLAS[T.bola].mods,
    teamP: team, teamPTurn: 0,
    abuelo: team[0],
    aiLevel: r.aiLevel,
    rivalIdx: r.rivalIdx,
    rival: RIVALS[r.rivalIdx],
    target: TARGET,
    scoreP: 0, scoreA: 0,
    round: 1,
    phase: 'roundStart', phaseT: 0,
    balls: [], jack: null,
    ballsLeftP: 3 * team.length, ballsLeftA: 3 * team.length,
    turn: 'P',
    wind: { x: 0, y: 0 },
    weather: r.forecast.main,
    weatherChange: r.forecast.changeProb > 0 && Math.random() < r.forecast.changeProb
      ? { atRound: 2 + Math.floor(rnd(0, 2)), to: r.forecast.changeTo, warned: false } : null,
    aimAngle: 0, spin: 0, loft: 0.6, power: 0, powerDir: 1,
    lastPoints: 0, lastWinner: null,
    firstManoWon: null,   // FERMÍN supersticioso
    role: 'apuntar',      // puntero por defecto
    streak: 0,             // racha de manos ganadas seguidas (momentum de la partida)
    narr: `${RIVALS[r.rivalIdx]} te espera en la pista. ${roundFlavor(T.roundIdx)}`,
    trail: [], particles: [], splats: [],
  };
  for (const i of team) {
    if (!T.usados.includes(i)) T.usados.push(i);
    abState(i).torneos++;
  }
  player.captain = team[0];
  savePlayer();
  makeGround(M.feature);
  setupFeature();
  // el cierzo de Zaragoza nunca calla
  if (M.feature === 'cierzo' && M.weather !== 'VIENTO') M.weather = Math.random() < 0.4 ? 'VIENTO' : M.weather;
  startRound();
}

// pone al tirador de turno del equipo (rotación simple entre los alineados)
function pickThrower() {
  if (M.teamP && M.teamP.length > 1) M.abuelo = M.teamP[M.teamPTurn % M.teamP.length];
}

// ------------------------------------------------------------
// ENTRENAMIENTO (mini-juegos en el descampado)
// ------------------------------------------------------------
function newTraining(i, drill) {
  M = {
    training: drill, abuelo: i, teamP: [i], teamPTurn: 0,
    city: { name: 'EL DESCAMPADO', color: '#8a8', diff: 0 },
    feature: null, bolaMods: {},
    stage: 0, aiLevel: 0, rival: '', rivalIdx: 0, target: 0,
    scoreP: 0, scoreA: 0, round: 1,
    phase: 'aim', phaseT: 0,
    balls: [], jack: null,
    ballsLeftP: drill === 'ARRIME' ? 3 : 4, ballsLeftA: 0,
    turn: 'P', wind: { x: 0, y: 0 },
    weather: 'SOL', weatherChange: null,
    aimAngle: 0, spin: 0, loft: 0.6, power: 0, powerDir: 1,
    firstManoWon: null, score: 0, targetsHit: 0, success: false,
    narr: drill === 'ARRIME'
      ? 'ARRIME: suma 16 puntos acercándote a la diana con 3 bolas. Premio: +1 PULSO.'
      : 'TIRO: derriba las 3 bolas viejas en 4 lanzamientos. Premio: +1 BRAZO.',
    trail: [], particles: [], splats: [],
    puddles: [], tree: null, slope: 0, wallBounce: 0.4, frictionMod: 1,
  };
  makeGround(null);
  if (drill === 'ARRIME') {
    M.jack = { x: rnd(80, 110), y: rnd(7, CH - 7), vx: 0, vy: 0, owner: 'J', moving: false };
  } else {
    M.jack = { x: 130, y: 1, vx: 0, vy: 0, owner: 'J', moving: false }; // fuera de juego
    for (let k = 0; k < 3; k++) {
      const tx = rnd(78, 112), ty = rnd(5, CH - 5);
      M.balls.push({ x: tx, y: ty, ox: tx, oy: ty, vx: 0, vy: 0, owner: 'T', spin: 0, moving: false });
    }
  }
  abState(i).st = clamp(abState(i).st - 30, 0, 100);
  savePlayer();
}

function roundFlavor(stage) {
  return ['Los cuartos: pocas gradas y mucho orgullo.',
          'Semifinal: en el bar ya se habla de vosotros.',
          '¡LA FINAL! Hasta el alcalde ha venido.'][stage];
}

function applyWeather(type) {
  M.weather = type;
  setRoundWind();
}

function setRoundWind() {
  let wStr;
  if (M.weather === 'TORMENTA') wStr = rnd(3.2, 5.5);
  else if (M.weather === 'VIENTO') wStr = rnd(2.4, 4.2);
  else if (M.weather === 'LLUVIA') wStr = rnd(0.5, 1.8);
  else if (M.weather === 'NIEBLA') wStr = rnd(0, 0.6);
  else wStr = rnd(0, 2.2) * (M.city.diff >= 3 ? 1 : 0.5);
  if (M.feature === 'cierzo') wStr = Math.max(wStr, 1.5);
  const wAng = rnd(0, Math.PI * 2);
  M.wind = { x: Math.cos(wAng) * wStr, y: Math.sin(wAng) * wStr * 0.5 };
}

function startRound() {
  M.balls = [];
  M.ballsLeftP = 3;
  M.ballsLeftA = 3;
  M.jack = { x: rnd(75, 115), y: rnd(6, CH - 6), vx: 0, vy: 0, owner: 'J', moving: false };
  // doble boliche: en pistas exigentes, a veces salen dos y el primer tiro decide cuál vale
  M.jack2 = null; M.twinJacks = false;
  if (!M.training && M.city.diff >= 6 && Math.random() < 0.35) {
    const ang = rnd(0, Math.PI * 2);
    const dist = rnd(14, 22);
    let jx = clamp(M.jack.x + Math.cos(ang) * dist, 6, CW - 6);
    let jy = clamp(M.jack.y + Math.sin(ang) * dist * 0.5, 3, CH - 3);
    M.jack2 = { x: jx, y: jy, vx: 0, vy: 0, owner: 'J2', moving: false };
    M.twinJacks = true;
  }
  // cambio de tiempo programado
  if (M.weatherChange) {
    if (!M.weatherChange.warned && M.round === M.weatherChange.atRound - 1) {
      M.narr = avisoClima(M.weatherChange.to);
      M.weatherChange.warned = true;
    } else if (M.round >= M.weatherChange.atRound) {
      applyWeather(M.weatherChange.to);
      M.narr = `¡${CLIMAS[M.weather].label}! ` + cambioClima(M.weather);
      M.weatherChange = null;
    }
  }
  setRoundWind();
  // CALOR: la mano desgasta al abuelo
  if (M.weather === 'CALOR') {
    const a = ABUELO_DATA[M.abuelo];
    const aff = a.clima.CALOR;
    if (aff < 1 && !hasImmunity(M.abuelo, 'CALOR')) {
      const drain = (7 - a.stats.aguante * 0.4) * (aff < 0 ? 1.6 : 1);
      abState(M.abuelo).st = clamp(abState(M.abuelo).st - drain, 0, 100);
    }
  }
  // TORMENTA: cuenta como ronda de tormenta para el premio doble
  if (M.weather === 'TORMENTA' && T) T.stormPlayed = true;
  M.turn = 'P';
  M.phase = 'roundStart';
  M.phaseT = 0;
  M.aimAngle = Math.atan2(((M.jack.y - CH / 2) * 2) / 60, 1) * 0.5;
  M.spin = 0;
  M.loft = 0.6;
  M.trail = [];
  M.jackRevealed = M.weather !== 'NIEBLA';
  M.measured = false;
  initParticles();
}

// ¿el abuelo tiene inmunidad a este clima (por rasgo o por amuleto)?
function hasImmunity(i, weatherKey) {
  const d = ABUELO_DATA[i];
  if (d.clima && d.clima[weatherKey] === 1) return true;
  const it = abState(i).item;
  if (it && it.id === 'panuelo' && it.clima === weatherKey) return true;
  return false;
}

function avisoClima(t) {
  return {
    LLUVIA: 'Se están poniendo negras las nubes... huele a tierra mojada.',
    VIENTO: 'Los plátanos del paseo empiezan a agitarse. Viene aire.',
    CALOR: 'No corre ni gota de aire. Esto va a ser un horno.',
    NIEBLA: 'Una bruma espesa empieza a tragarse el fondo de la pista.',
    HELADA: 'El relente cuaja en la tierra. Esto va a estar resbaladizo.',
    TORMENTA: 'El cielo se ha puesto negro de golpe. Esto pinta muy mal.',
    SOL: 'Parece que abre. El cielo se despeja.',
  }[t];
}
function cambioClima(t) {
  return {
    LLUVIA: 'Los paraguas brotan en la grada. Cuesta ver las bolas al fondo.',
    VIENTO: 'Las boinas vuelan. Los tiros bombeados serán una lotería.',
    CALOR: 'El albero quema. La stamina se va a derretir.',
    NIEBLA: 'No se ve ni el boliche. Habrá que tirar a ciegas.',
    HELADA: 'La tierra suena a hueco. Las bolas van a rodar el doble.',
    TORMENTA: '¡Diluvia y sopla a la vez! Esto ya es otra cosa.',
    SOL: 'Vuelve la calma. Petanca de manual.',
  }[t];
}

// --- perfil de tiro del abuelo alineado ---
function throwProfile() {
  const i = M.abuelo;
  const s = abState(i);
  const bm = (M.bolaMods || {});
  let shake = 0.055 - getStat(i, 'pulso') * 0.0038;
  // fatiga
  const fat = clamp((60 - s.st) / 60, 0, 1);
  shake *= 1 + fat * 1.2;
  // presión del marcador (EL CHATO es inmune; en MADRID pesa el doble)
  if (!M.training && M.scoreA > M.scoreP && i !== 5) {
    const press = (1 - getStat(i, 'temple') / 10) * 0.35;
    shake *= 1 + press * (M.feature === 'pressure' ? 1.7 : 1);
  }
  // FERMÍN supersticioso
  if (i === 8 && M.firstManoWon === true) shake *= 0.8;
  // BLAS chulería
  if (i === 9 && !M.training) shake *= M.stage === 2 ? 0.85 : M.stage === 0 ? 1.15 : 1;
  // moral
  shake *= 1 - s.mo * 0.004;
  // racha: dos o más manos seguidas ganadas afinan la mano
  if (!M.training && M.streak >= 2) shake *= Math.max(0.6, 1 - (M.streak - 1) * 0.08);
  let barSpeed = 1.7 * (1 - getStat(i, 'temple') * 0.035) * (1 + fat * 0.5);
  if (s.item && s.item.id === 'reloj') barSpeed *= 0.8;
  // rol: apuntar (más fino, menos alcance) vs tirar (más fuerza, más riesgo)
  let maxPow = 34 + getStat(i, 'brazo') * 2 + (bm.pow || 0);
  let impactBonus = 1;
  if (!M.training && M.role === 'apuntar') { shake *= 0.72; maxPow *= 0.72; }
  else if (!M.training && M.role === 'tirar') { shake *= 1.3; maxPow *= 1.12; impactBonus = 1.25; }
  else if (!M.training && M.role === 'bloquear') { shake *= 0.6; maxPow *= 0.5; }
  return {
    shake: Math.max(0.006, shake),
    barSpeed,
    maxPow,
    impactBonus,
    spinMax: (0.5 + getStat(i, 'mana') * 0.05) * (bm.spin || 1),
    guideLen: i === 1 ? 58 : 20 + getStat(i, 'pulso') * 2.5,
    fat,
  };
}

function allBalls() { return M.jack ? [M.jack, ...M.balls] : M.balls; }
function anyMoving() { return allBalls().some(b => b.moving); }

// --- terreno (se genera por partida según la pista de la ciudad) ---
const GROUND_COLS = ['#b7ab63', '#9a8f4e', '#847a41'];
let GROUND = [];
let WEAR = []; // desgaste acumulado durante la partida: cada bola que rueda deja surco

function makeGround(featureId) {
  GROUND = []; WEAR = [];
  const blobs = [];
  const nBlobs = featureId === 'flat' ? 0 : 12;
  for (let i = 0; i < nBlobs; i++) {
    blobs.push({ x: rnd(6, CW - 6), y: rnd(3, CH - 3), r: rnd(2.5, 6.5) });
  }
  for (let y = 0; y < CH; y++) {
    GROUND.push(new Array(CW).fill(0));
    WEAR.push(new Array(CW).fill(0));
    for (let x = 0; x < CW; x++) {
      let dark = 0;
      for (const b of blobs) {
        const d = Math.sqrt((x - b.x) ** 2 + ((y - b.y) * 2) ** 2);
        if (d < b.r) dark += d < b.r * 0.55 ? 2 : 1;
      }
      GROUND[y][x] = Math.min(2, dark);
    }
  }
}
makeGround(null);

function setupFeature() {
  M.puddles = []; M.tree = null; M.slope = 0; M.wallBounce = 0.4; M.frictionMod = 1;
  switch (M.feature) {
    case 'slope': M.slope = 2.2; break;
    case 'fastdry': M.frictionMod = 0.8; break;
    case 'walls': M.wallBounce = 0.78; break;
    case 'puddles': {
      const n = M.weather === 'LLUVIA' ? 4 : 2;
      for (let i = 0; i < n; i++) {
        M.puddles.push({ x: rnd(30, CW - 12), y: rnd(4, CH - 4), r: rnd(2.2, 4) });
      }
      break;
    }
    case 'tree':
      M.tree = { x: rnd(65, 95), y: rnd(7, CH - 7), r: rnd(6, 9) };
      break;
  }
}

// microclima local de la pista: el viento no sopla igual en toda la cancha
function localWindFactor(x, y) {
  if (M.tree) {
    // sombra de viento tras el plátano centenario (Valencia)
    const d = dist2d(x, y, M.tree.x, M.tree.y);
    if (d < M.tree.r * 1.6) return 0.4 + 0.6 * (d / (M.tree.r * 1.6));
  }
  if (M.feature === 'walls') {
    // efecto embudo entre los tablones (Barcelona): más viento cerca de las bandas
    const distEdge = Math.min(y, CH - y);
    if (distEdge < 4) return 1.5 - distEdge * 0.12;
  }
  return 1;
}

function inPuddle(x, y) {
  if (!M.puddles) return false;
  for (const p of M.puddles) {
    if (dist2d(x, y, p.x, p.y) < p.r) return true;
  }
  return false;
}

function groundFriction(x, y, b) {
  const g = (GROUND[Math.floor(clamp(y, 0, CH - 1))] || [])[Math.floor(clamp(x, 0, CW - 1))] || 0;
  let f = g === 2 ? 2.4 : g === 1 ? 1.6 : 1;
  const grip = b && b.grip;
  if (M && isRainy(M.weather) && !grip) {
    f *= 1.35 * (b && b.wetPenalty ? b.wetPenalty : 1); // tierra mojada
  }
  if (M && M.weather === 'HELADA') f *= 0.4;             // tierra helada: rueda muchísimo más
  if (inPuddle(x, y)) f *= grip ? 2.2 : 4;               // charco
  if (M) f *= M.frictionMod || 1;
  if (b && b.rollMod) f *= b.rollMod;
  const wear = (WEAR[Math.floor(clamp(y, 0, CH - 1))] || [])[Math.floor(clamp(x, 0, CW - 1))] || 0;
  f *= 1 + wear * 0.18; // los surcos de bolas anteriores frenan un poco más
  return f;
}

// --- partículas ambientales (viento / lluvia / calor) ---
function initParticles() {
  M.particles = [];
  const wmag = Math.sqrt(M.wind.x ** 2 + M.wind.y ** 2);
  let n = 0;
  if (M.weather === 'TORMENTA') n = 90;
  else if (M.weather === 'LLUVIA') n = 60;
  else if (M.weather === 'VIENTO') n = Math.round(wmag * 14);
  else if (M.weather === 'NIEBLA') n = 46;
  else if (M.weather === 'HELADA') n = 20;
  else if (wmag > 1) n = Math.round(wmag * 4);
  else if (M.weather === 'CALOR') n = 14;
  for (let i = 0; i < n; i++) {
    M.particles.push({ x: rnd(0, CW), y: rnd(0, CH), s: rnd(0.6, 1.4) });
  }
}

function stepParticles() {
  for (const p of M.particles) {
    if (isRainy(M.weather)) {
      p.x += M.wind.x * 0.25 * p.s + 0.15;
      p.y += 0.85 * p.s;
    } else if (M.weather === 'CALOR') {
      p.y -= 0.12 * p.s;
      p.x += Math.sin(frame * 0.15 + p.s * 9) * 0.25;
    } else if (M.weather === 'NIEBLA') {
      p.x += Math.sin(frame * 0.02 + p.s * 5) * 0.12 + 0.05;
    } else if (M.weather === 'HELADA') {
      p.y += 0.03 * p.s;
      p.x += Math.sin(frame * 0.05 + p.s * 4) * 0.08;
    } else {
      p.x += M.wind.x * 0.55 * p.s;
      p.y += M.wind.y * 0.28 * p.s;
    }
    if (p.x < 0) p.x += CW; if (p.x >= CW) p.x -= CW;
    if (p.y < 0) p.y += CH; if (p.y >= CH) p.y -= CH;
  }
  // gotas que se quedan pegadas "al cristal" y tapan zonas al azar
  if (isRainy(M.weather)) {
    if (M.splats.length < 14 && Math.random() < 0.035) {
      M.splats.push({
        x: Math.floor(rnd(2, CW - 3)),
        y: Math.floor(rnd(1, CH - 2)),
        ttl: rnd(160, 340),
        big: Math.random() < 0.45,
      });
    }
  }
  M.splats = M.splats.filter(s => --s.ttl > 0);
  // NIEBLA: el boliche se revela si alguna bola pasó cerca
  if (M.weather === 'NIEBLA' && !M.jackRevealed) {
    for (const b of M.balls) {
      if (dist2d(b.x, b.y, M.jack.x, M.jack.y) < 16) { M.jackRevealed = true; break; }
    }
  }
}

// --- física ---
function stepPhysics(dt) {
  const bs = allBalls();
  for (const b of bs) {
    if (!b.moving) continue;
    const z = b.z || 0;
    if (z > 0 || (b.vz || 0) > 0) {
      // vuelo
      b.vz -= GRAV * dt;
      b.z = z + b.vz * dt;
      const wf = 1.4 * (b.windFactor === undefined ? 1 : b.windFactor) * localWindFactor(b.x, b.y);
      b.vx += M.wind.x * wf * dt;
      b.vy += M.wind.y * wf * dt * 0.5;
      b.x += b.vx * dt;
      b.y += b.vy * dt * 0.5;
      // el plátano centenario de Valencia atrapa los globos
      if (M.tree && !b.hitTree && b.z > 4 && dist2d(b.x, b.y, M.tree.x, M.tree.y) < M.tree.r * 0.8) {
        b.hitTree = true;
        b.vz = Math.min(b.vz, -2);
        b.z = Math.min(b.z, 4);
        b.vx *= 0.2; b.vy *= 0.2;
        M.narr = '¡A las ramas del plátano! La bola cae muerta entre hojas.';
      }
      if (b.z <= 0) {
        b.z = 0;
        if (b.vz < -9) {
          b.vz = -b.vz * 0.28;
          b.vx *= 0.75; b.vy *= 0.75;
        } else {
          b.vz = 0;
          if (!b.landed) { b.vx *= 0.5; b.vy *= 0.5; b.landed = true; }
        }
      }
    } else {
      // rodadura
      b.z = 0; b.vz = 0;
      const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      if (sp < 0.6) { b.vx = 0; b.vy = 0; b.moving = false; continue; }
      const dec = FRICTION * groundFriction(b.x, b.y, b) * dt;
      const ns = Math.max(0, sp - dec);
      b.vx *= ns / sp; b.vy *= ns / sp;
      if (b.spin) {
        const px = -b.vy / sp, py = b.vx / sp;
        b.vx += px * b.spin * sp * 0.9 * dt;
        b.vy += py * b.spin * sp * 0.9 * dt;
      }
      // pista inclinada: cuesta abajo hacia el sur
      if (M.slope) b.vy += M.slope * dt;
      // el rodar de la bola va dejando surco (más fricción a partir de ahora)
      if (b.owner !== 'J' && sp > 1.5) {
        const wy = Math.floor(clamp(b.y, 0, CH - 1)), wx = Math.floor(clamp(b.x, 0, CW - 1));
        if (WEAR[wy]) WEAR[wy][wx] = Math.min(2.5, WEAR[wy][wx] + 0.03);
      }
      const wf = b.owner === 'J' ? 0.8 : 0.15;
      b.vx += M.wind.x * wf * dt;
      b.vy += M.wind.y * wf * dt * 0.5;
      b.x += b.vx * dt;
      b.y += b.vy * dt * 0.5;
    }
    const wb = M.wallBounce || 0.4;
    if (b.x < 1) { b.x = 1; b.vx = Math.abs(b.vx) * wb; }
    if (b.x > CW - 1) { b.x = CW - 1; b.vx = -Math.abs(b.vx) * wb; }
    if (b.y < 1) { b.y = 1; b.vy = Math.abs(b.vy) * wb; }
    if (b.y > CH - 1) { b.y = CH - 1; b.vy = -Math.abs(b.vy) * wb; }
    if (b === M.lastThrown && frame % 2 === 0 && (b.z || 0) <= 0.2) {
      M.trail.push({ x: b.x, y: b.y, t: 24 });
    }
  }
  for (let i = 0; i < bs.length; i++) {
    for (let j = i + 1; j < bs.length; j++) {
      if ((bs[i].z || 0) > 1.5 || (bs[j].z || 0) > 1.5) continue;
      collide(bs[i], bs[j]);
    }
  }
  M.trail = M.trail.filter(t => --t.t > 0);
}

function collide(a, b) {
  const ra = a.owner === 'J' ? JACK_R : BALL_R;
  const rb = b.owner === 'J' ? JACK_R : BALL_R;
  const dx = b.x - a.x, dy = (b.y - a.y) * 2;
  const d = Math.sqrt(dx * dx + dy * dy);
  const minD = ra + rb;
  if (d >= minD || d === 0) return;
  const nx = dx / d, ny = dy / d;
  const overlap = (minD - d) / 2;
  a.x -= nx * overlap; a.y -= ny * overlap * 0.5;
  b.x += nx * overlap; b.y += ny * overlap * 0.5;
  const ma = a.owner === 'J' ? 0.15 : 1;
  const mb = b.owner === 'J' ? 0.15 : 1;
  const van = a.vx * nx + a.vy * ny;
  const vbn = b.vx * nx + b.vy * ny;
  if (van - vbn <= 0) return;
  const e = 0.75;
  // bolas pesadas: la que golpea más rápido transmite más
  const striker = Math.hypot(a.vx, a.vy) > Math.hypot(b.vx, b.vy) ? a : b;
  const pImp = (1 + e) * (van - vbn) / (1 / ma + 1 / mb) * (striker.impact || 1);
  a.vx -= (pImp / ma) * nx; a.vy -= (pImp / ma) * ny;
  b.vx += (pImp / mb) * nx; b.vy += (pImp / mb) * ny;
  a.moving = a.vx || a.vy ? true : a.moving;
  b.moving = true;
  M.lastCollision = true;
}

// --- lanzamiento ---
function throwBall(owner, angle, power, spin, loft) {
  const startY = clamp(CH / 2 + gauss() * 0.5, 3, CH - 3);
  const prof = owner === 'P' ? throwProfile() : null;
  const maxPow = prof ? prof.maxPow : 44;
  const speed = 14 + power * maxPow;
  const vh = speed * Math.cos(loft);
  // VIENTO/TORMENTA: cada tiro pilla una racha distinta
  if (isWindy(M.weather)) {
    const jitter = rnd(-0.6, 0.6);
    M.wind.x += jitter * 0.5; M.wind.y += jitter * 0.25;
  }
  const bm = owner === 'P' ? (M.bolaMods || {}) : {};
  const b = {
    x: THROW_X, y: startY,
    vx: Math.cos(angle) * vh,
    vy: Math.sin(angle) * vh,
    z: 0.01, vz: speed * Math.sin(loft),
    landed: false,
    owner, spin, moving: true,
    windFactor: ((owner === 'P' && ABUELO_DATA[M.abuelo].clima.VIENTO === 1) ? 0.3 : 1) * (bm.wind || 1),
    rollMod: bm.roll || 1,
    impact: (bm.impact || 1) * (owner === 'P' ? (prof ? prof.impactBonus : 1) : 1),
    grip: !!bm.grip,
    wetPenalty: bm.wetPenalty || 1,
  };
  b.thrower = owner === 'P' ? M.abuelo : null;
  M.balls.push(b);
  M.lastThrown = b;
  M.lastCollision = false;
  M.trail = [];
  if (owner === 'P') { M.ballsLeftP--; M.teamPTurn++; } else M.ballsLeftA--;
  M.phase = 'sim';
  M.timeoutUsedThisThrow = false;
  M.lastWasFault = false;
}

// ¿hay alguna bola bloqueando el camino recto hacia el boliche? (rol "bloquear")
function blockingPenalty() {
  const ax = THROW_X, ay = CH / 2, bx = M.jack.x, by = M.jack.y;
  const dx = bx - ax, dy = (by - ay) * 2;
  const len2 = dx * dx + dy * dy;
  let worst = 0;
  for (const b of M.balls) {
    if (b.owner !== 'P') continue;
    const px = b.x - ax, py = (b.y - ay) * 2;
    let t = len2 ? (px * dx + py * dy) / len2 : 0;
    t = clamp(t, 0, 1);
    const cx = ax + t * dx, cy = ay + t * dy / 2;
    const d = dist2d(b.x, b.y, cx, cy);
    if (t > 0.25 && t < 0.92 && d < 2.6) worst = Math.max(worst, 1 - d / 2.6);
  }
  return worst; // 0 = camino libre, hasta 1 = bola justo en medio
}

// --- IA ---
function aiThrow() {
  const lvl = M.aiLevel;
  let tx = M.jack.x, ty = M.jack.y;
  let shooting = false;
  const pBest = bestBall('P');
  const aBest = bestBall('A');
  if (pBest && (!aBest || pBest.d < aBest.d) && pBest.d < 6 && Math.random() < 0.15 + lvl * 0.06) {
    tx = pBest.b.x; ty = pBest.b.y; shooting = true;
  }
  const d = dist2d(THROW_X, CH / 2, tx, ty);
  let loft = shooting ? rnd(0.30, 0.42) : rnd(0.55, 0.80);
  const rollEst = shooting ? 0 : 4.5;
  const carry = Math.max(3, d - rollEst);
  let speed = Math.sqrt(GRAV * carry / Math.sin(2 * loft));
  let angle = Math.atan2((ty - CH / 2) * 2, tx - THROW_X);
  const comp = clamp(lvl / 10, 0.2, 0.95);
  angle -= Math.atan2(M.wind.y * 0.5, 20) * comp * 2;
  speed -= M.wind.x * 0.5 * comp;
  let err = 0.42 - lvl * 0.045;
  if (isRainy(M.weather) || isWindy(M.weather) || M.weather === 'NIEBLA') err *= 1.15;
  if (M.weather === 'TORMENTA') err *= 1.3;
  if (!shooting) err *= 1 + blockingPenalty() * 0.5; // una bola bien colocada estorba de verdad
  angle += gauss() * err * 0.55;
  speed *= 1 + gauss() * err * 0.55;
  loft += gauss() * err * 0.3;
  const power = clamp((speed - 14) / 44, 0.05, 1);
  throwBall('A', angle, power, gauss() * 0.2, clamp(loft, 0.17, 1.05));
}

function bestBall(owner) {
  let best = null;
  for (const b of M.balls) {
    if (b.owner !== owner) continue;
    const d = dist2d(b.x, b.y, M.jack.x, M.jack.y);
    if (!best || d < best.d) best = { b, d };
  }
  return best;
}

function nextTurn() {
  const p = bestBall('P'), a = bestBall('A');
  if (M.ballsLeftP === 0 && M.ballsLeftA === 0) return null;
  if (M.ballsLeftP === 0) return 'A';
  if (M.ballsLeftA === 0) return 'P';
  if (!p && !a) return M.turn === 'P' ? 'A' : 'P';
  if (!p) return 'P';
  if (!a) return 'A';
  return p.d <= a.d ? 'A' : 'P';
}

function scoreRound() {
  const p = bestBall('P'), a = bestBall('A');
  if (!p && !a) return { winner: null, points: 0 };
  if (!p) return { winner: 'A', points: M.balls.filter(b => b.owner === 'A').length };
  if (!a) return { winner: 'P', points: M.balls.filter(b => b.owner === 'P').length };
  const winner = p.d < a.d ? 'P' : 'A';
  const loserBest = winner === 'P' ? a.d : p.d;
  let points = 0;
  for (const b of M.balls) {
    if (b.owner !== winner) continue;
    if (dist2d(b.x, b.y, M.jack.x, M.jack.y) < loserBest) points++;
  }
  return { winner, points: Math.max(1, points) };
}

// resuelve el resultado de la mano (llamado directo o tras medir con la cinta)
function resolveMano() {
  const r = scoreRound();
  M.lastWinner = r.winner; M.lastPoints = r.points;
  if (M.round === 1) M.firstManoWon = r.winner === 'P';
  if (r.winner === 'P') {
    M.scoreP += r.points; M.streak++;
    M.narr = narrate({ type: 'manoP', points: r.points });
    if (M.streak === 2) M.narr = '¡Racha! Dos manos seguidas. ' + M.narr;
    else if (M.streak >= 3) M.narr = `¡RACHA x${M.streak}! Está imparable. ` + M.narr;
  } else if (r.winner === 'A') {
    M.scoreA += r.points; T.pointsAgainst += r.points; M.streak = 0;
    M.narr = narrate({ type: 'manoA', points: r.points });
  } else M.narr = narrate({ type: 'nula' });
  M.phase = (M.scoreP >= M.target || M.scoreA >= M.target) ? 'matchEnd' : 'roundEnd';
  M.phaseT = 0;
  // repetición: mano decisiva a favor (2+ puntos, o la que gana el torneo)
  M.decisive = r.winner === 'P' && (r.points >= 2 || M.phase === 'matchEnd');
}

// --- comentarista de barra de bar ---
function narrate(event) {
  const me = FACES[M.abuelo].name;
  const riv = M.rival;
  const pick = arr => arr[Math.floor(rnd(0, arr.length))];
  switch (event.type) {
    case 'manoP':
      if (event.points >= 2) return pick([
        `¡${event.points} puntos de golpe! En el bar ya invitan a chatos en tu nombre.`,
        `${me} se sacude el polvo de la boina. ${event.points} puntos y silencio en la grada.`,
      ]);
      return pick([
        `Punto para ${me}. ${riv} mira el boliche como si le debiera dinero.`,
        `Arrime fino de ${me}. Alguien murmura: "eso no se enseña".`,
        `${me} anota. La grada de jubilados asiente con la cabeza.`,
      ]);
    case 'manoA':
      return pick([
        `${riv} se apunta la mano. Aprieta el partido.`,
        `Punto para ${riv}. Se oye un "¡uy!" colectivo desde el banco.`,
        `${riv} sonríe bajo la boina. Esto no está sentenciado.`,
      ]);
    case 'golpe':
      return pick([
        `¡PETARDAZO! Bola apartada de un tiro seco. El clásico "te la quito".`,
        `Choque de acero. Las bolas cambian de sitio y alguien aplaude.`,
      ]);
    case 'nula':
      return 'Mano nula. Los dos se miran y fingen que era lo que querían.';
  }
  return '';
}

// --- update del match ---
function updateMatch(dt) {
  M.phaseT += dt;
  stepParticles();
  // ráfagas continuas mientras se prepara el tiro: el viento no espera a que sueltes
  if (isWindy(M.weather) && (M.phase === 'aim' || M.phase === 'spin' || M.phase === 'loft' || M.phase === 'power')) {
    M.wind.x += Math.sin(frame * 0.07 + M.round) * 0.02;
    M.wind.y += Math.cos(frame * 0.05 + M.round * 1.3) * 0.014;
    const wm = Math.hypot(M.wind.x, M.wind.y);
    if (wm > 6.5) { M.wind.x *= 6.5 / wm; M.wind.y *= 6.5 / wm; }
  }
  // pulso visible: la mira tiembla de verdad según el pulso del abuelo — soltar
  // en el momento en que está quieta reduce el error real del disparo
  if (!M.training && (M.phase === 'aim' || M.phase === 'spin' || M.phase === 'loft' || M.phase === 'power')) {
    const sh = throwProfile().shake;
    const t = frame * 0.15;
    // en radianes: con buen pulso apenas se mueve, con mal pulso/fatiga tiembla de verdad
    M.jitterA = (Math.sin(t * 1.7) * 0.6 + Math.sin(t * 3.3 + 1.4) * 0.4) * sh * 2.2;
    M.jitterP = (Math.sin(t * 2.1 + 2.2) * 0.6 + Math.sin(t * 4.1 + 0.5) * 0.4) * sh * 3.5;
  } else { M.jitterA = 0; M.jitterP = 0; }
  switch (M.phase) {
    case 'roundStart':
      if (M.phaseT > 1.6 || hit('Enter') || hit(' ')) {
        if (M.turn === 'P') pickThrower();
        M.phase = M.turn === 'P' ? 'aim' : 'aiTurn';
        M.phaseT = 0;
        M.role = 'apuntar';
      }
      break;

    case 'aim': {
      if (keys['ArrowUp'])   M.aimAngle -= 0.9 * dt;
      if (keys['ArrowDown']) M.aimAngle += 0.9 * dt;
      M.aimAngle = clamp(M.aimAngle, -0.55, 0.55);
      if (hit('r') || hit('R')) {
        M.role = M.role === 'apuntar' ? 'tirar' : M.role === 'tirar' ? 'bloquear' : 'apuntar';
      }
      if (hit('Enter') || hit(' ')) { M.phase = 'spin'; M.phaseT = 0; }
      break;
    }

    case 'spin': {
      const prof = throwProfile();
      if (keys['ArrowLeft'])  M.spin -= 1.6 * dt;
      if (keys['ArrowRight']) M.spin += 1.6 * dt;
      M.spin = clamp(M.spin, -prof.spinMax, prof.spinMax);
      if (hit('Enter') || hit(' ')) { M.phase = 'loft'; M.phaseT = 0; }
      if (hit('Escape') || hit('Backspace')) { M.phase = 'aim'; M.phaseT = 0; }
      break;
    }

    case 'loft':
      if (keys['ArrowUp'])   M.loft += 1.1 * dt;
      if (keys['ArrowDown']) M.loft -= 1.1 * dt;
      M.loft = clamp(M.loft, 0.17, 1.05);
      if (hit('Enter') || hit(' ')) {
        M.phase = 'power'; M.phaseT = 0; M.power = 0; M.powerDir = 1;
        // punto dulce: aparece en un sitio distinto cada tiro; acertarlo afina el disparo
        M.sweetSpot = M.training ? null : rnd(0.5, 0.92);
        M.sweetWidth = 0.045;
      }
      if (hit('Escape') || hit('Backspace')) { M.phase = 'spin'; M.phaseT = 0; }
      break;

    case 'power': {
      const prof = throwProfile();
      M.power += M.powerDir * prof.barSpeed * dt;
      if (M.power >= 1) { M.power = 1; M.powerDir = -1; }
      if (M.power <= 0) { M.power = 0; M.powerDir = 1; }
      if (hit('Enter') || hit(' ')) {
        // piernas muy cansadas: riesgo de pisar el círculo y perder la bola sin más
        const st = abState(M.abuelo).st;
        const faultChance = M.training ? 0 : Math.max(0, (25 - st) / 25) * 0.12;
        if (Math.random() < faultChance) {
          M.narr = `¡FALTA DE PIE! ${FACES[M.abuelo].name} pisa el círculo del cansancio que lleva. Bola nula.`;
          M.ballsLeftP--; M.teamPTurn++;
          M.phase = 'throwDone'; M.phaseT = 0;
          M.lastCollision = false;
          M.lastWasFault = true;
          break;
        }
        // el temblor visible YA es parte del error real: soltar con la mira quieta ayuda.
        // el resto (ruido invisible) se reduce, así que leer el pulso importa de verdad.
        const sweet = M.sweetSpot && Math.abs(M.power - M.sweetSpot) < M.sweetWidth;
        const residual = sweet ? 0.35 : 0.55;
        throwBall('P', M.aimAngle + (M.jitterA || 0) + gauss() * prof.shake * residual,
                  clamp(M.power + (M.jitterP || 0) * 0.01 + gauss() * prof.shake * residual, 0.03, 1),
                  M.spin, M.loft);
        break;
      }
      if (hit('Escape') || hit('Backspace')) { M.phase = 'loft'; M.phaseT = 0; }
      break;
    }

    case 'aiTurn':
      if (M.phaseT > 1.1) { aiThrow(); }
      break;

    case 'sim':
      stepPhysics(dt);
      stepPhysics(dt);
      if (!anyMoving()) {
        if (M.lastCollision) M.narr = narrate({ type: 'golpe' });
        M.phase = 'throwDone'; M.phaseT = 0;
      }
      break;

    case 'throwDone': {
      // tiempo muerto: repite tu último tiro (escaso, 1 por torneo)
      const canTimeout = !M.training && !M.lastWasFault && M.lastThrown && M.lastThrown.owner === 'P' &&
        T && T.timeouts > 0 && !M.timeoutUsedThisThrow;
      if (canTimeout && (hit('x') || hit('X'))) {
        M.balls.pop();
        M.ballsLeftP++;
        M.teamPTurn--;
        T.timeouts--;
        M.timeoutUsedThisThrow = true;
        M.narr = `${FACES[M.abuelo].name} pide tiempo muerto y repite el tiro. Ya no quedan para este torneo.`;
        pickThrower();
        M.phase = 'aim'; M.phaseT = 0; M.spin = 0; M.loft = 0.6; M.role = 'apuntar';
        break;
      }
      if (M.phaseT < (canTimeout ? 2.4 : 0.7)) break;
      // doble boliche: el primer tiro de la mano decide cuál de los dos vale
      if (M.twinJacks && M.balls.length === 1) {
        const b0 = M.balls[0];
        const d1 = dist2d(b0.x, b0.y, M.jack.x, M.jack.y);
        const d2 = dist2d(b0.x, b0.y, M.jack2.x, M.jack2.y);
        if (d2 < d1) { M.jack = M.jack2; }
        M.narr = `Primer tiro: se queda con el boliche ${d2 < d1 ? 'de la derecha' : 'de la izquierda'}. El otro ya no cuenta.`;
        M.jack2 = null; M.twinJacks = false;
      }
      // --- entrenamientos ---
      if (M.training === 'ARRIME') {
        const d = dist2d(M.lastThrown.x, M.lastThrown.y, M.jack.x, M.jack.y);
        const gained = Math.max(0, Math.round(10 - d));
        M.score += gained;
        M.narr = gained > 6 ? `¡Arrime de libro! +${gained} puntos.` :
                 gained > 0 ? `Se queda a ${d.toFixed(1)} pasos. +${gained} puntos.` :
                 'Demasiado lejos. Eso no puntúa.';
        if (M.ballsLeftP === 0) {
          M.success = M.score >= 16;
          M.phase = 'trainEnd'; M.phaseT = 0;
        } else { M.phase = 'aim'; M.phaseT = 0; }
        break;
      }
      if (M.training === 'TIRO') {
        const hits = M.balls.filter(b => b.owner === 'T' && dist2d(b.x, b.y, b.ox, b.oy) > 3).length;
        if (hits > M.targetsHit) M.narr = '¡PIM! Bola vieja derribada.';
        M.targetsHit = hits;
        if (hits >= 3 || M.ballsLeftP === 0) {
          M.success = hits >= 3;
          M.phase = 'trainEnd'; M.phaseT = 0;
        } else { M.phase = 'aim'; M.phaseT = 0; }
        break;
      }
      const t = nextTurn();
      if (t === null) {
        // bolas muy ajustadas: momento de medición antes de cantar el punto
        const pB = bestBall('P'), aB = bestBall('A');
        const tight = pB && aB && Math.abs(pB.d - aB.d) < 1.0;
        if (tight && !M.measured) {
          M.measured = true;
          M.measureBalls = { p: pB.b, a: aB.b, pd: pB.d, ad: aB.d };
          M.phase = 'measuring'; M.phaseT = 0;
          break;
        }
        resolveMano();
      } else {
        M.turn = t;
        if (t === 'P') pickThrower();
        M.phase = t === 'P' ? 'aim' : 'aiTurn';
        M.phaseT = 0;
        M.spin = 0;
        M.role = 'apuntar';
      }
      break;
    }

    case 'measuring':
      if (M.phaseT > 1.8) resolveMano();
      break;

    case 'roundEnd':
      if (M.phaseT > 1.2 && (hit('Enter') || hit(' '))) {
        M.round++;
        startRound();
      }
      break;

    case 'trainEnd':
      if (M.phaseT > 0.8 && (hit('Enter') || hit(' '))) {
        if (M.success) {
          const k = M.training === 'ARRIME' ? 'pulso' : 'brazo';
          if (getStat(M.abuelo, k) < 10) {
            const bn = abState(M.abuelo).bonus;
            bn[k] = (bn[k] || 0) + 1;
          } else {
            addMoral(M.abuelo, 3); // ya está al máximo: al menos se divierte
          }
        }
        savePlayer();
        state = 'penya';
      }
      break;

    case 'matchEnd':
      if (M.phaseT > 1.2 && (hit('Enter') || hit(' '))) {
        const won = M.scoreP >= M.target;
        // la ronda desgasta a todo el equipo alineado (repartido entre los que jugaron)
        const team = M.teamP || [M.abuelo];
        for (const i of team) {
          const a = ABUELO_DATA[i];
          const cost = (45 - a.stats.aguante * 2) / team.length;
          abState(i).st = clamp(abState(i).st - cost, 0, 100);
          if (won) addMoral(i, 3); else addMoral(i, -4);
        }
        T.results.push({ round: T.roundIdx, rival: M.rival, won, scoreP: M.scoreP, scoreA: M.scoreA, abuelos: team });
        savePlayer();
        if (!won) {
          T.outcome = endTournament(false);
          state = 'result';
        } else if (T.roundIdx === T.rounds.length - 1) {
          T.outcome = endTournament(true);
          state = 'result';
        } else {
          T.roundIdx++;
          lineupCursor = 0;
          T.teamSel = [];
          state = 'lineup';
        }
      }
      break;
  }
}

// --- dibujo del match ---
function drawMatch() {
  clearScreen();
  const pFace = FACES[M.abuelo];
  box(2, 0, 22, 14, M.turn === 'P' ? '#7CFC00' : '#3a3f4a', 'double');
  drawPhotoArt(pFace.mini, 4, 1);

  text(26, 1, `${pFace.name}`, '#4fc3f7');
  const teamSize = (M.teamP || [M.abuelo]).length;
  const ballCount = M.training ? (M.training === 'TIRO' ? 4 : 3) : 3 * teamSize;
  text(26, 2, `${'●'.repeat(M.ballsLeftP)}${'○'.repeat(Math.max(0, ballCount - M.ballsLeftP))}`, '#4fc3f7');
  const st = abState(M.abuelo).st;
  const stCol = st > 60 ? '#7ec850' : st > 30 ? '#ffe14d' : '#ff5c5c';
  text(26, 3, `STA ${'▮'.repeat(Math.round(st / 12.5))}${'▯'.repeat(8 - Math.round(st / 12.5))}`, stCol);
  if (teamSize > 1) {
    const names = M.teamP.map(i => i === M.abuelo ? `▶${FACES[i].name}◀` : FACES[i].name);
    text(26, 4, `equipo: ${names.join('  ')}`, '#8ab8d8');
  }

  if (M.training) {
    // cabecera de entrenamiento
    textCenter(0, `╣ EL DESCAMPADO · ENTRENAMIENTO DE ${M.training} ╠`, '#88c8e8');
    if (M.training === 'ARRIME') {
      textCenter(4, `PUNTOS: ${M.score} / 16`, M.score >= 16 ? '#7ec850' : '#ffe680');
    } else {
      textCenter(4, `DERRIBADAS: ${M.targetsHit} / 3`, M.targetsHit >= 3 ? '#7ec850' : '#ffe680');
    }
    textCenter(6, `bolas restantes: ${M.ballsLeftP}`, '#c9c2a8');
    textCenter(8, `premio: +1 ${M.training === 'ARRIME' ? 'PULSO' : 'BRAZO'} para ${pFace.name}`, '#d8b8e8');
  } else {
    const rFace = RIVAL_FACES[M.rivalIdx];
    box(COLS - 24, 0, 22, 14, M.turn === 'A' ? '#ef7676' : '#3a3f4a', 'double');
    drawPhotoArt(rFace.photo, COLS - 22, 1);
    const rname = `${M.rival}${teamSize > 1 ? ' Y CÍA' : ''} [NIV.${M.aiLevel}]`;
    text(COLS - 26 - rname.length, 1, rname, '#ef7676');
    text(COLS - 26 - 3, 2, `${'●'.repeat(M.ballsLeftA)}${'○'.repeat(Math.max(0, 3 * teamSize - M.ballsLeftA))}`, '#ef7676');

    textCenter(0, `╣ ${M.city.name} · ${M.isDaily ? 'RELÁMPAGO' : ROUND_NAMES[M.stage]} ╠`, M.city.color);

    // MARCADOR GIGANTE
    const scStr = `${M.scoreP}-${M.scoreA}`;
    const bigW = scStr.length * 5 - 1;
    let bx0 = Math.floor((COLS - bigW) / 2);
    let pastDash = false;
    for (const c of scStr) {
      if (c === '-') pastDash = true;
      const glyph = BIG_DIGITS[c];
      const col = c === '-' ? '#8a7f66' : (pastDash ? '#ef7676' : '#4fc3f7');
      if (glyph) block(bx0, 2, glyph, col);
      bx0 += 5;
    }
    textCenter(8, `· mano ${M.round} · partida a ${M.target} ·`, '#c9c2a8');
    if (M.turn === 'P' && frame % 26 < 18) textCenter(9, '▶▶ TIRAS TÚ ◀◀', '#7CFC00');
    else if (M.turn === 'A') textCenter(9, `tira ${M.rival}...`, '#ef9f9f');
    if (M.streak >= 2 && frame % 20 < 15) textCenter(10, `🔥 RACHA x${M.streak} — pulso más firme`, '#ffb347');
  }

  // clima + banderita de viento
  const cl = CLIMAS[M.weather];
  const wmag = Math.sqrt(M.wind.x ** 2 + M.wind.y ** 2);
  const warr = windArrow(M.wind.x, M.wind.y);
  textCenter(11, `${cl.icon} ${cl.label}   ·   viento ${warr} ${wmag.toFixed(1)}`, cl.color);
  const WAVE = '▂▃▄▅▆▅▄▃';
  const phase = frame * (0.04 + wmag * 0.11);
  let flag = '';
  for (let i = 0; i < 7; i++) {
    const amp = 0.4 + Math.min(wmag, 3) * 0.5;
    const s = Math.sin(phase - i * 0.85) * amp;
    flag += WAVE[clamp(Math.round(3.5 + s), 0, WAVE.length - 1)];
  }
  const fx0 = Math.floor(COLS / 2) - 4;
  if (M.wind.x >= 0) {
    put(fx0, 12, '┃', '#8a7f66'); text(fx0 + 1, 12, flag, '#ffcf4d');
  } else {
    text(fx0, 12, flag.split('').reverse().join(''), '#ffcf4d'); put(fx0 + 7, 12, '┃', '#8a7f66');
  }

  // terreno
  box(COURT_X - 1, COURT_Y - 1, CW + 2, CH + 2, '#8a6f3f', 'double');
  const wet = isRainy(M.weather);
  const icy = M.weather === 'HELADA';
  for (let y = 0; y < CH; y++) {
    for (let x = 0; x < CW; x++) {
      let col = GROUND_COLS[GROUND[y][x]];
      if (wet) col = ['#9a955e', '#82804a', '#6f6e3e'][GROUND[y][x]];
      if (icy) col = ['#c9dce6', '#a8c0cc', '#8ba8b6'][GROUND[y][x]];
      const w = WEAR[y] ? WEAR[y][x] : 0;
      if (w > 0.9) { put(COURT_X + x, COURT_Y + y, w > 1.7 ? '▪' : '▫', '#6f5a30'); }
      else put(COURT_X + x, COURT_Y + y, icy ? '▒' : '░', col);
    }
  }
  // charcos (Bilbao)
  if (M.puddles) {
    for (const pd of M.puddles) {
      for (let y = 0; y < CH; y++) {
        for (let x = 0; x < CW; x++) {
          if (dist2d(x, y, pd.x, pd.y) < pd.r) {
            put(COURT_X + x, COURT_Y + y, '≈', (x + y + (frame >> 4)) % 2 ? '#4a7a9a' : '#3d688a');
          }
        }
      }
    }
  }
  // el plátano centenario (Valencia): copa que atrapa globos
  if (M.tree) {
    for (let y = 0; y < CH; y++) {
      for (let x = 0; x < CW; x++) {
        const d = dist2d(x, y, M.tree.x, M.tree.y);
        if (d < M.tree.r * 0.8) {
          if ((x * 7 + y * 13) % 3 !== 0) {
            put(COURT_X + x, COURT_Y + y, ['♣', '♠', '❀'][(x + y) % 3], d < M.tree.r * 0.4 ? '#2d6b35' : '#4a8a4a');
          }
        }
      }
    }
    put(COURT_X + M.tree.x, COURT_Y + M.tree.y, '█', '#6b4a2d');
  }
  // pista inclinada (Cuenca): flechas de la pendiente
  if (M.slope && frame % 40 < 20) {
    for (let i = 0; i < 4; i++) put(COURT_X + 20 + i * 30, COURT_Y + CH - 2, '▼', '#8d8248');
  }
  for (let y = 0; y < CH; y++) if (y % 2 === 0) put(COURT_X + THROW_X - 4, COURT_Y + y, '¦', '#7a6a4a');

  const replaying = M.decisive && (M.phase === 'roundEnd' || M.phase === 'matchEnd') && M.phaseT < 1.3;
  if (replaying) {
    const pulse = frame % 10 < 5;
    for (const t of M.trail) {
      put(COURT_X + t.x, COURT_Y + t.y, pulse ? '●' : '◉', pulse ? '#ffe14d' : '#ff8c5b');
    }
  } else {
    for (const t of M.trail) put(COURT_X + t.x, COURT_Y + t.y, '·', t.t > 12 ? '#c9b98a' : '#7a6f55');
  }

  // guía de tiro
  if (M.phase === 'aim' || M.phase === 'spin' || M.phase === 'loft' || M.phase === 'power') {
    const prof = throwProfile();
    const guideLen = prof.guideLen;
    let gx = THROW_X, gy = CH / 2;
    const jitteredAngle = M.aimAngle + (M.jitterA || 0);
    let vx = Math.cos(jitteredAngle), vy = Math.sin(jitteredAngle);
    const loftAmt = (M.loft - 0.17) / (1.05 - 0.17);
    for (let i = 0; i < guideLen; i++) {
      gx += vx * 1.6; gy += vy * 1.6 * 0.5;
      const px = -vy, py = vx;
      vx += px * M.spin * 0.045; vy += py * M.spin * 0.045;
      const n = Math.sqrt(vx * vx + vy * vy); vx /= n; vy /= n;
      if (gx > 0 && gx < CW && gy > 0 && gy < CH && i % 2 === 0) {
        const h = Math.sin(Math.PI * (i / guideLen)) * loftAmt;
        const dot = h > 0.55 ? '●' : h > 0.25 ? 'o' : '·';
        put(COURT_X + gx, COURT_Y + gy, dot, h > 0.55 ? '#8ff08f' : '#6fae6f');
      }
    }
    put(COURT_X + THROW_X - 2, COURT_Y + CH / 2 - 1, '☺', '#4fc3f7');
    put(COURT_X + THROW_X - 2, COURT_Y + CH / 2, '/', '#4fc3f7');
    // retícula sobre la bola rival cuando el rol es "tirar"
    if (M.role === 'tirar') {
      const aBest = bestBall('A');
      if (aBest && frame % 16 < 11) {
        put(COURT_X + aBest.b.x - 1, COURT_Y + aBest.b.y, '[', '#ff8c5b');
        put(COURT_X + aBest.b.x + 1, COURT_Y + aBest.b.y, ']', '#ff8c5b');
      }
    }
    // "bloquear": marca el pasillo directo hacia el boliche que vas a taponar
    if (M.role === 'bloquear' && frame % 16 < 11) {
      for (let k = 0.3; k <= 0.85; k += 0.18) {
        const bxp = THROW_X + (M.jack.x - THROW_X) * k;
        const byp = CH / 2 + (M.jack.y - CH / 2) * k;
        put(COURT_X + bxp, COURT_Y + byp, '┊', '#c8a0e8');
      }
    }
    if (M.phase === 'power') {
      const v = 14 + M.power * prof.maxPow;
      const carry = v * v * Math.sin(2 * M.loft) / GRAV;
      const lx = THROW_X + Math.cos(M.aimAngle) * carry;
      const ly = CH / 2 + Math.sin(M.aimAngle) * carry * 0.5;
      if (lx > 0 && lx < CW && ly > 0 && ly < CH && frame % 14 < 9) {
        put(COURT_X + lx, COURT_Y + ly, '✕', '#3d3520');
      }
    }
  }

  // boliche y bolas (con niebla de lluvia, niebla cerrada o tormenta)
  const rainFog = isRainy(M.weather) || M.weather === 'NIEBLA' || M.weather === 'TORMENTA';
  const immuneFog = hasImmunity(M.abuelo, isRainy(M.weather) || M.weather === 'TORMENTA' ? 'LLUVIA' : M.weather);
  const fogFrom = immuneFog ? 999
                : M.weather === 'NIEBLA' ? 32
                : M.weather === 'TORMENTA' ? 40
                : ABUELO_DATA[M.abuelo].clima.LLUVIA === -1 ? 45 : 70;
  const visible = (b) => {
    if (M.weather === 'NIEBLA' && b === M.jack && !M.jackRevealed && !immuneFog) return frame % 24 < 2;
    if (!rainFog || b.x < fogFrom || (b === M.lastThrown && b.moving)) return true;
    return frame % 8 < 3;
  };
  // diana del entrenamiento de arrime
  if (M.training === 'ARRIME') {
    for (let dy = -5; dy <= 5; dy++) {
      for (let dx = -10; dx <= 10; dx++) {
        const gx = M.jack.x + dx, gy = M.jack.y + dy;
        if (gx < 1 || gx > CW - 1 || gy < 1 || gy > CH - 1) continue;
        const d = dist2d(gx, gy, M.jack.x, M.jack.y);
        for (const rr of [3, 6, 9]) {
          if (Math.abs(d - rr) < 0.55) put(COURT_X + gx, COURT_Y + gy, '·', rr === 3 ? '#e8c832' : rr === 6 ? '#b09a50' : '#847a41');
        }
      }
    }
  }
  // posiciones originales de las bolas viejas (entrenamiento de tiro)
  if (M.training === 'TIRO') {
    for (const b of M.balls) {
      if (b.owner === 'T') put(COURT_X + b.ox, COURT_Y + b.oy, '+', '#6a6a5a');
    }
  }
  if (M.training !== 'TIRO' && visible(M.jack)) put(COURT_X + M.jack.x, COURT_Y + M.jack.y, '☼', '#ffe14d');
  if (M.twinJacks && M.jack2 && visible(M.jack2)) put(COURT_X + M.jack2.x, COURT_Y + M.jack2.y, '☀', '#ff9c5b');
  for (const b of M.balls) {
    if (!visible(b)) continue;
    const col = b.owner === 'P' ? '#4fc3f7' : b.owner === 'T' ? '#c9c2a8' : '#ef7676';
    const z = b.z || 0;
    if (z > 0.4) {
      put(COURT_X + b.x, COURT_Y + b.y, z > 5 ? '▒' : '●', '#5c5230');
      const lift = Math.min(z * 0.18, Math.max(1, b.y - 2));
      const bxx = COURT_X + b.x, byy = COURT_Y + b.y - lift;
      if (z > 9) {
        put(bxx - 1, byy - 1, '▗', col); put(bxx, byy - 1, '█', col);
        put(bxx + 1, byy - 1, '█', col); put(bxx + 2, byy - 1, '▖', col);
        put(bxx - 1, byy, '▝', col); put(bxx, byy, '█', col);
        put(bxx + 1, byy, '█', col); put(bxx + 2, byy, '▘', col);
      } else if (z > 4) {
        put(bxx, byy - 1, '▄', col); put(bxx + 1, byy - 1, '▄', col);
        put(bxx, byy, '▀', col); put(bxx + 1, byy, '▀', col);
      } else if (z > 1.5) {
        put(bxx, byy, '●', col);
      } else {
        put(bxx, byy, 'o', col);
      }
    } else {
      put(COURT_X + b.x, COURT_Y + b.y, b.moving ? '◉' : '●', col);
    }
  }
  const p = bestBall('P'), a = bestBall('A');
  if (p && a && !anyMoving() && M.balls.length >= 2) {
    const lead = p.d < a.d ? p.b : a.b;
    if (frame % 20 < 12 && visible(lead)) put(COURT_X + lead.x, COURT_Y + lead.y - 1, '▾', '#ffe680');
  }

  // partículas ambientales por encima de todo
  for (const pt of M.particles) {
    if (isRainy(M.weather)) put(COURT_X + pt.x, COURT_Y + pt.y, '/', pt.s > 1 ? '#7fc4e8' : '#5590b0');
    else if (M.weather === 'CALOR') put(COURT_X + pt.x, COURT_Y + pt.y, '~', '#e8cf7a');
    else if (M.weather === 'NIEBLA') put(COURT_X + pt.x, COURT_Y + pt.y, pt.s > 1 ? '▒' : '░', '#9aa4a4');
    else if (M.weather === 'HELADA') put(COURT_X + pt.x, COURT_Y + pt.y, '❋', '#dff0fa');
    else put(COURT_X + pt.x, COURT_Y + pt.y, pt.s > 1 ? '-' : '∙', '#cfc9a0');
  }
  // gotas pegadas al cristal: tapan lo que hay debajo y se desvanecen
  for (const s of M.splats) {
    const fresh = s.ttl > 90;
    const col = fresh ? '#8fd0ea' : s.ttl > 40 ? '#5e93ad' : '#3d5f72';
    put(COURT_X + s.x, COURT_Y + s.y, fresh ? '◉' : '●', col);
    if (s.big) {
      put(COURT_X + s.x - 1, COURT_Y + s.y, '∘', col);
      put(COURT_X + s.x + 1, COURT_Y + s.y, '∘', col);
      put(COURT_X + s.x, COURT_Y + s.y - 1, fresh ? '∘' : '·', col);
    }
  }

  // rótulo de repetición sobre el terreno
  if (replaying && frame % 20 < 14) {
    textCenter(COURT_Y - 2, '◆ ◆ ◆  ¡REPETICIÓN!  ◆ ◆ ◆', '#ffe14d');
  }

  // medición con la cinta: bolas muy ajustadas se miden antes de cantar el punto
  if (M.phase === 'measuring' && M.measureBalls) {
    const mb = M.measureBalls;
    const grow = Math.min(1, M.phaseT / 1.2);
    // línea de cinta entre boliche y cada bola, creciendo
    for (const [ball, dist, col] of [[mb.p, mb.pd, '#4fc3f7'], [mb.a, mb.ad, '#ef7676']]) {
      const steps = Math.round(dist * grow * 2);
      for (let k = 1; k <= steps; k++) {
        const t2 = k / (dist * 2);
        const lx = M.jack.x + (ball.x - M.jack.x) * t2;
        const ly = M.jack.y + (ball.y - M.jack.y) * t2;
        put(COURT_X + lx, COURT_Y + ly, '·', col);
      }
    }
    if (frame % 20 < 15) textCenter(COURT_Y - 2, '📏  MIDIENDO...  📏', '#ffe14d');
  }

  // panel inferior
  const py = COURT_Y + CH + 2;
  box(2, py, COLS - 4, ROWS - py - 1, '#8a7f66');
  if (M.phase === 'aim') {
    text(5, py + 1, 'PUNTERÍA  [↑/↓] ajustar ángulo   [R] cambiar rol   [ENTER] confirmar', '#e8e0c8');
    const deg = (-M.aimAngle * 57.3).toFixed(1);
    const roleTxt = M.role === 'tirar' ? 'TIRAR (más fuerza, más riesgo)'
                  : M.role === 'bloquear' ? 'BLOQUEAR (corto y preciso, estorba al rival)'
                  : 'APUNTAR (más fino, menos alcance)';
    const roleCol = M.role === 'tirar' ? '#ff8c5b' : M.role === 'bloquear' ? '#c8a0e8' : '#88e088';
    text(5, py + 2, `ángulo: ${deg}°     rol: ${roleTxt}`, roleCol);
  } else if (M.phase === 'spin') {
    const prof = throwProfile();
    text(5, py + 1, 'EFECTO    [←/→] curvar la bola   [ENTER] confirmar   [ESC] volver', '#e8e0c8');
    let bar = '';
    for (let i = 0; i < 41; i++) bar += i === 20 + Math.round(M.spin * 20) ? '◆' : (i === 20 ? '┼' : '─');
    text(5, py + 2, 'IZQ ' + bar + ' DER', '#d8a4e8');
  } else if (M.phase === 'loft') {
    text(5, py + 1, 'ELEVACIÓN [↑/↓] altura del lanzamiento   [ENTER] confirmar   [ESC] volver', '#e8e0c8');
    const deg = M.loft * 57.3;
    const steps = '▁▂▃▄▅▆▇█';
    const idx = clamp(Math.round((M.loft - 0.17) / (1.05 - 0.17) * 7), 0, 7);
    let bar = '';
    for (let i = 0; i <= 7; i++) bar += i === idx ? steps[i] : (i < idx ? steps[i] : '·');
    text(5, py + 2, `rasa ${bar} bombeada   ${deg.toFixed(0)}°  ${deg < 20 ? '(tiro tenso, para tirar bolas)' : deg > 45 ? '(globo, cae muerta)' : '(media altura)'}`, '#9fd8e8');
  } else if (M.phase === 'power') {
    const inSweet = M.sweetSpot && Math.abs(M.power - M.sweetSpot) < M.sweetWidth;
    text(5, py + 1, `POTENCIA  [ENTER/ESPACIO] ¡lanzar!   [ESC] volver${M.sweetSpot ? '   ◆ busca el punto dulce dorado' : ''}`,
         inSweet ? '#ffe14d' : '#e8e0c8');
    const w = 60;
    const fill = Math.round(M.power * w);
    let bar = '';
    for (let i = 0; i < w; i++) {
      if (M.sweetSpot && Math.abs(i / w - M.sweetSpot) < M.sweetWidth) bar += '◆';
      else bar += i < fill ? '█' : '░';
    }
    const pcol = inSweet ? '#ffe14d' : M.power < 0.4 ? '#7ec850' : M.power < 0.75 ? '#ffe14d' : '#ff5c5c';
    text(5, py + 2, '[', '#e8e0c8');
    text(6, py + 2, bar, pcol);
    text(6 + w, py + 2, `] ${(M.power * 100).toFixed(0)}%${inSweet ? '  ¡DENTRO!' : ''}`, inSweet ? '#ffe14d' : '#e8e0c8');
  } else if (M.phase === 'throwDone') {
    if (!M.training && !M.lastWasFault && M.lastThrown && M.lastThrown.owner === 'P' && T && T.timeouts > 0 && !M.timeoutUsedThisThrow) {
      text(5, py + 1, `¿Mal tiro? [X] pedir TIEMPO MUERTO y repetirlo (te queda ${T.timeouts})`, frame % 20 < 14 ? '#ffcf4d' : '#a08050');
    }
  } else if (M.phase === 'measuring') {
    const mb = M.measureBalls;
    text(5, py + 1, `El juez saca la cinta: azul ${mb.pd.toFixed(2)}  vs  rojo ${mb.ad.toFixed(2)} — diferencia de ${Math.abs(mb.pd - mb.ad).toFixed(2)}`, '#ffe14d');
  } else if (M.phase === 'sim') {
    text(5, py + 1, 'La bola vuela...', '#c9b98a');
  } else if (M.phase === 'aiTurn') {
    text(5, py + 1, `${M.rival} escupe en la bola, mira al cielo y se concentra...`, '#ef9f9f');
  } else if (M.phase === 'roundStart') {
    text(5, py + 1, M.twinJacks
      ? `MANO ${M.round} — ¡DOBLE BOLICHE! El primer tiro decide cuál cuenta. [ENTER] empezar`
      : `MANO ${M.round} — el boliche está colocado. [ENTER] para empezar`, '#ffe680');
  } else if (M.phase === 'roundEnd') {
    const who = M.lastWinner === 'P' ? '¡PUNTO PARA TI!' : M.lastWinner === 'A' ? `Punto para ${M.rival}` : 'Mano nula';
    text(5, py + 1, `${who}  +${M.lastPoints} punto(s)   [ENTER] siguiente mano`, M.lastWinner === 'P' ? '#7CFC00' : '#ef7676');
  } else if (M.phase === 'matchEnd') {
    const won = M.scoreP >= M.target;
    const isFinalRound = M.stage === M.totalRounds - 1;
    text(5, py + 1, won
      ? (isFinalRound ? '¡¡¡CAMPEONES DEL TORNEO!!!' : `¡Ronda ganada! Pasáis a ${ROUND_NAMES[M.stage + 1]}.`)
      : `Eliminados${M.isDaily ? '' : ` en ${ROUND_NAMES[M.stage]}`}... ${M.rival} sonríe con su boina.`,
      won ? '#7CFC00' : '#ff5c5c');
    text(85, py + 1, '[ENTER] continuar', '#c9c2a8');
  } else if (M.phase === 'trainEnd') {
    const statName = M.training === 'ARRIME' ? 'PULSO' : 'BRAZO';
    text(5, py + 1, M.success
      ? `¡ENTRENAMIENTO SUPERADO! +1 ${statName} para ${FACES[M.abuelo].name}.`
      : 'No ha podido ser. Mañana más, que el cuerpo ya no es el que era.',
      M.success ? '#7CFC00' : '#ff8c5b');
    text(85, py + 1, '[ENTER] volver a la peña', '#c9c2a8');
  }
  // comentarista
  if (M.narr) text(5, py + 3, '» ' + M.narr, '#b8a878');
}

function windArrow(x, y) {
  const a = Math.atan2(y, x);
  const dirs = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'];
  return dirs[Math.round(((a + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8];
}

// ------------------------------------------------------------
// Pantallas
// ------------------------------------------------------------
function drawTitle() {
  clearScreen();
  block(Math.floor((COLS - 60) / 2), 2, TITLE_ART, '#ffb347');
  textCenter(9, '~ el noble arte de la petanca española ~', '#c9b98a');
  const bx = Math.floor((COLS - PHOTO_BANNER.cols) / 2);
  box(bx - 2, 11, PHOTO_BANNER.cols + 4, PHOTO_BANNER.rows + 2, '#8a7f66', 'double');
  drawPhotoArt(PHOTO_BANNER, bx, 12);

  const blink = frame % 40 < 26;
  if (blink) textCenter(34, '▶ [ ENTER ]  EMPEZAR A JUGAR ◀', '#7CFC00');
  const f = FACES[player.captain || 0];
  textCenter(37, `Capitán: ${f.name}   Peña de ${player.roster.length}   Renombre ${player.level}   ${player.money}€   V:${player.wins} D:${player.losses}`, '#e8e0c8');
  if (player.wins + player.losses > 0) textCenter(39, '[B] borrar partida guardada', '#8a7f66');
  textCenter(43, 'foto: Wikimedia Commons · filtro ASCII casero · hecho con cariño y albero', '#556');

  if (hit('Enter') || hit(' ')) state = 'map';
  if (hit('b') || hit('B')) {
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem('petanka_save_v1');
    player = newPlayer(); savePlayer();
  }
}

// ------------------------------------------------------------
// Barra de pestañas
// ------------------------------------------------------------
function drawTabs(active) {
  const tabs = [
    { id: 'map',      label: ' [1] TORNEOS ' },
    { id: 'penya',    label: ' [2] MI PEÑA ' },
    { id: 'bar',      label: ' [3] EL BAR ' },
    { id: 'historia', label: ' [4] HISTORIA ' },
  ];
  let x = 4;
  put(2, 1, '║', '#8a7f66');
  for (const t of tabs) {
    const on = t.id === active;
    text(x, 0, '┌' + '─'.repeat(t.label.length) + '┐', on ? '#ffb347' : '#5a5347');
    text(x, 1, '│', on ? '#ffb347' : '#5a5347');
    text(x + 1, 1, t.label, on ? '#ffe680' : '#8a7f66');
    text(x + 1 + t.label.length, 1, '│', on ? '#ffb347' : '#5a5347');
    text(x, 2, on ? '┘' + ' '.repeat(t.label.length) + '└' : '┴' + '─'.repeat(t.label.length) + '┴', on ? '#ffb347' : '#5a5347');
    x += t.label.length + 3;
  }
  for (let i = x + 1; i < COLS - 2; i++) put(i, 2, '─', '#5a5347');
  text(COLS - 34, 1, `${player.money}€  ·  [TAB] cambiar  [ESC] título`, '#8a7f66');
  if (hit('1')) state = 'map';
  if (hit('2')) state = 'penya';
  if (hit('3')) state = 'bar';
  if (hit('4')) state = 'historia';
  if (hit('Tab')) {
    const order = ['map', 'penya', 'bar', 'historia'];
    state = order[(order.indexOf(active) + 1) % order.length];
  }
  if (hit('Escape')) state = 'title';
}

// ------------------------------------------------------------
// HISTORIA (campaña de capítulos + hemeroteca de la peña)
// ------------------------------------------------------------
function drawHistoria() {
  clearScreen();
  drawTabs('historia');
  textCenter(4, '═══ HISTORIA DE LA PEÑA ═══', '#ffb347');

  // capítulos de campaña
  box(4, 6, 66, 34, '#8a7f66');
  text(7, 7, 'CAPÍTULOS', '#ffb347');
  let yy = 9;
  for (const ch of CAMPAIGN_CHAPTERS) {
    const done = player.campaign.claimed.includes(ch.id);
    const ready = !done && ch.check(player);
    if (ready) {
      player.campaign.claimed.push(ch.id);
      player.money += ch.reward.m; player.xp += ch.reward.x;
      pushNews(`CAPÍTULO CUMPLIDO: "${ch.title}". +${ch.reward.m}€ +${ch.reward.x} XP.`);
      savePlayer();
    }
    const isDone = player.campaign.claimed.includes(ch.id);
    const col = isDone ? '#7ec850' : '#8a8a7a';
    text(7, yy, `${isDone ? '✔' : '○'} ${ch.title}`, col);
    text(9, yy + 1, ch.desc, '#9a927a');
    text(9, yy + 2, `premio: ${ch.reward.m}€ + ${ch.reward.x} XP`, isDone ? '#556' : '#7a9a5a');
    yy += 4;
  }

  // hemeroteca
  box(72, 6, 62, 34, '#8a7f66');
  text(75, 7, 'HEMEROTECA — LO ÚLTIMO DE LA PEÑA', '#ffb347');
  let ny = 9;
  if (!player.news.length) {
    text(75, ny, 'Aún no hay titulares. Juega tu primer torneo.', '#8a8a7a');
  } else {
    for (const n of player.news.slice(0, 27)) {
      wrapText(n, 56).forEach(l => { if (ny < 39) text(75, ny++, l, '#c9c2a8'); });
      ny++;
    }
  }

  textCenter(41, '[1] torneos    [2] mi peña    [3] el bar', '#c9c2a8');
}

// ------------------------------------------------------------
// EL BAR (tienda de bolas + liga de peñas)
// ------------------------------------------------------------
let barCursor = 0;
function drawBar() {
  clearScreen();
  drawTabs('bar');
  textCenter(4, '═══ EL BAR DE LA PEÑA ═══', '#ffb347');
  textCenter(5, 'humo, carajillos y la tele con el volumen a tope', '#8a7f66');

  // tienda de bolas
  box(4, 7, 66, 26, '#8a7f66');
  text(7, 8, 'VITRINA DE BOLAS DE COMPETICIÓN', '#ffb347');
  let yy = 10;
  for (let i = 0; i < BOLAS.length; i++) {
    const b = BOLAS[i];
    const owned = player.bolasOwned.includes(i);
    const sel = i === barCursor;
    if (sel) box(5, yy - 1, 64, 5, '#7CFC00');
    text(8, yy, `${b.name}`, sel ? '#fff' : owned ? '#88c8e8' : '#8a8a8a');
    text(30, yy, owned ? (player.bolaSel === i ? '★ EN USO' : 'EN LA VITRINA') : `${b.price}€`,
         owned ? '#ffe14d' : player.money >= b.price ? '#7ec850' : '#ff5c5c');
    wrapText(b.desc, 58).forEach((l, k) => text(8, yy + 1 + k, l, '#9a927a'));
    yy += 5;
  }
  text(7, 31, '[↑/↓] mirar   [ENTER] comprar / usar por defecto', '#c9c2a8');

  // clasificación de la liga
  box(74, 7, 60, 26, '#8a7f66');
  const S = player.season;
  text(77, 8, `LIGA DE PEÑAS — TEMPORADA ${S.num}`, '#ffb347');
  text(77, 9, `Jornada ${S.jornada} de 8 (cada torneo puntúa)`, '#8a8a7a');
  const table = [{ name: 'TU PEÑA', pts: S.pts, me: true },
                 ...S.rivals].sort((a, b) => b.pts - a.pts);
  let ty = 12;
  for (let i = 0; i < table.length; i++) {
    const row = table[i];
    const col = row.me ? '#7CFC00' : '#c9c2a8';
    text(77, ty, `${i + 1}º`, i === 0 ? '#ffe14d' : col);
    text(81, ty, row.name.padEnd(18), col);
    text(100, ty, `${'▪'.repeat(clamp(Math.round(row.pts / 4), 0, 20))}`, col);
    text(122, ty, `${row.pts}`, col);
    ty += 2;
  }
  text(77, 24, 'Campeón: 10 pts · Finalista: 6 · Semis: 3 · Cuartos: 1', '#8a8a7a');
  text(77, 26, 'Premios fin de temporada:', '#ffb347');
  text(77, 27, '1º 500€ + 300 XP   2º 250€ + 150 XP   resto 100€', '#9a927a');

  if (hit('ArrowUp'))   barCursor = (barCursor + BOLAS.length - 1) % BOLAS.length;
  if (hit('ArrowDown')) barCursor = (barCursor + 1) % BOLAS.length;
  if (hit('Enter') || hit(' ')) {
    const b = BOLAS[barCursor];
    if (player.bolasOwned.includes(barCursor)) {
      player.bolaSel = barCursor; savePlayer();
    } else if (player.money >= b.price) {
      player.money -= b.price;
      player.bolasOwned.push(barCursor);
      player.bolaSel = barCursor;
      savePlayer();
    }
  }
}

// ------------------------------------------------------------
// MAPA (mundo grande con cámara y click & drag)
// ------------------------------------------------------------
// --- geografía real: silueta de la Península por polígono lon/lat + heightmap ---
// (nada de arte dibujado a mano: la costa y el relieve salen de la geometría real)
const LON_MIN = -9.3, LON_MAX = 3.3, LAT_MIN = 35.9, LAT_MAX = 43.6;
function geoNorm(lon, lat) {
  return [(lon - LON_MIN) / (LON_MAX - LON_MIN), (LAT_MAX - lat) / (LAT_MAX - LAT_MIN)];
}
// costa aproximada de la Península (sentido horario desde Fisterra)
const SPAIN_LONLAT = [
  [-9.3, 42.9], [-8.4, 43.4], [-7.0, 43.55], [-5.7, 43.55], [-3.8, 43.47],
  [-2.9, 43.4], [-1.98, 43.32], [0.0, 42.7], [1.4, 42.45], [3.3, 42.3],
  [2.3, 41.35], [1.2, 41.1], [0.0, 39.9], [-0.3, 39.4], [-0.5, 38.35],
  [-0.9, 37.6], [-2.15, 36.75], [-4.4, 36.7], [-5.35, 36.05], [-6.3, 36.5],
  [-7.4, 37.15], [-7.0, 38.0], [-6.85, 39.0], [-6.8, 40.1], [-6.6, 41.0],
  [-6.4, 41.9], [-7.0, 42.3],
];
const SPAIN_POLY = SPAIN_LONLAT.map(([lon, lat]) => geoNorm(lon, lat));
// islas Baleares, como archipiélago suelto al este
const BALEARES = [
  { lon: 2.65, lat: 39.57, r: 0.018 },  // Mallorca
  { lon: 1.43, lat: 38.91, r: 0.010 },  // Ibiza
  { lon: 4.26, lat: 39.90, r: 0.010 },  // Menorca
];
// cordilleras (segmento + radio + altura de pico, en grados aprox.)
const RANGES = [
  { seg: [[-1.5, 42.6], [2.0, 42.5]], r: 0.022, peak: 0.85 },   // Pirineos
  { seg: [[-7.0, 43.2], [-3.0, 43.05]], r: 0.022, peak: 0.6 },  // Cordillera Cantábrica
  { seg: [[-6.8, 40.35], [-3.0, 40.85]], r: 0.024, peak: 0.5 }, // Sistema Central
  { seg: [[-3.0, 41.8], [-1.0, 40.0]], r: 0.022, peak: 0.46 },  // Sistema Ibérico
  { seg: [[-6.8, 38.25], [-3.0, 38.0]], r: 0.02, peak: 0.38 },  // Sierra Morena
  { seg: [[-5.4, 36.9], [-2.0, 36.9]], r: 0.026, peak: 0.48 },  // Cordillera Bética
];
const PEAKS = [
  { p: [-3.31, 37.06], r: 0.018, peak: 1.0 },  // Sierra Nevada (Mulhacén)
  { p: [-0.65, 42.63], r: 0.016, peak: 1.0 },  // Pirineo Aragonés (Aneto)
];
const VALLEYS = [
  { seg: [[-1.7, 41.9], [0.5, 41.6]], r: 0.05, dip: 0.35 },   // valle del Ebro
  { seg: [[-6.0, 37.9], [-3.5, 37.4]], r: 0.05, dip: 0.35 },  // valle del Guadalquivir
];

function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}
function distToCoast(x, y) {
  let best = Infinity;
  for (let i = 0, j = SPAIN_POLY.length - 1; i < SPAIN_POLY.length; j = i++) {
    const d = distToSeg(x, y, SPAIN_POLY[i][0], SPAIN_POLY[i][1], SPAIN_POLY[j][0], SPAIN_POLY[j][1]);
    if (d < best) best = d;
  }
  return best;
}
function heightAt(x, y) {
  let h = Math.min(0.34, distToCoast(x, y) * 3.4); // la meseta sube con la distancia a la costa
  for (const rg of RANGES) {
    const [a, b] = rg.seg.map(([lon, lat]) => geoNorm(lon, lat));
    const d = distToSeg(x, y, a[0], a[1], b[0], b[1]);
    h += rg.peak * Math.exp(-(d * d) / (rg.r * rg.r));
  }
  for (const pk of PEAKS) {
    const [px, py] = geoNorm(pk.p[0], pk.p[1]);
    const d = Math.hypot(x - px, y - py);
    h += pk.peak * Math.exp(-(d * d) / (pk.r * pk.r)) * 0.5;
  }
  for (const v of VALLEYS) {
    const [a, b] = v.seg.map(([lon, lat]) => geoNorm(lon, lat));
    const d = distToSeg(x, y, a[0], a[1], b[0], b[1]);
    h -= v.dip * Math.exp(-(d * d) / (v.r * v.r));
  }
  return clamp(h, 0, 1);
}

// tabla de relieve: de costa/llanura a picos nevados
const RELIEF_TIERS = [
  { max: 0.10, ch: '.', color: '#8fc25a' },  // costa / vega
  { max: 0.20, ch: ',', color: '#7ec850' },  // llanura
  { max: 0.30, ch: ':', color: '#a3b25a' },  // meseta baja
  { max: 0.40, ch: ';', color: '#b09a4a' },  // meseta alta
  { max: 0.52, ch: '^', color: '#9a7a42' },  // piedemonte
  { max: 0.65, ch: 'n', color: '#8a6a3a' },  // montaña
  { max: 0.86, ch: 'M', color: '#6b5636' },  // alta montaña
  { max: 2.00, ch: '▲', color: '#f0f4f8' },  // cumbre nevada
];
function reliefFor(h) {
  for (const t of RELIEF_TIERS) if (h <= t.max) return t;
  return RELIEF_TIERS[RELIEF_TIERS.length - 1];
}

const WORLD_W = 220, WORLD_H = 92;
const WORLD_LAND = [];
const WORLD_CHAR = [];
const WORLD_COLOR = [];
(function buildWorld() {
  for (let wy = 0; wy < WORLD_H; wy++) {
    const landRow = new Array(WORLD_W), chRow = new Array(WORLD_W), colRow = new Array(WORLD_W);
    for (let wx = 0; wx < WORLD_W; wx++) {
      const x = wx / WORLD_W, y = wy / WORLD_H;
      let isLand = pointInPoly(x, y, SPAIN_POLY);
      if (!isLand) {
        for (const isl of BALEARES) {
          const [ix, iy] = geoNorm(isl.lon, isl.lat);
          if (Math.hypot(x - ix, y - iy) < isl.r) { isLand = true; break; }
        }
      }
      landRow[wx] = isLand;
      if (isLand) {
        const t = reliefFor(heightAt(x, y));
        chRow[wx] = t.ch; colRow[wx] = t.color;
      }
    }
    WORLD_LAND.push(landRow); WORLD_CHAR.push(chRow); WORLD_COLOR.push(colRow);
  }
})();
// coloca cada ciudad en el mapa-mundo a partir de su lon/lat real
function geoToWorld(lon, lat) {
  const [x, y] = geoNorm(lon, lat);
  return [Math.round(x * WORLD_W), Math.round(y * WORLD_H)];
}
for (const c of CITIES) { const [wx, wy] = geoToWorld(c.lon, c.lat); c.wx = wx; c.wy = wy; }

const VIEW = { x: 3, y: 4, w: COLS - 6, h: 22 };
let cam = null;

function camClamp() {
  cam.x = clamp(cam.x, -8, Math.max(-8, WORLD_W + 8 - VIEW.w));
  cam.y = clamp(cam.y, -3, Math.max(-3, WORLD_H + 3 - VIEW.h));
}
function camCenterOn(c) {
  cam = { x: Math.round(c.wx - VIEW.w / 2), y: Math.round(c.wy - VIEW.h / 2) };
  camClamp();
}
function putV(x, y, ch, color) { // put recortado al viewport del mapa
  if (x < VIEW.x || x >= VIEW.x + VIEW.w || y < VIEW.y || y >= VIEW.y + VIEW.h) return;
  put(x, y, ch, color);
}

function drawMap() {
  clearScreen();
  drawTabs('map');
  if (!cam) camCenterOn(CITIES[0]); // centrado en Cuenca por defecto

  // arrastre con el ratón
  const inView = mouse.cx >= VIEW.x && mouse.cx < VIEW.x + VIEW.w &&
                 mouse.cy >= VIEW.y && mouse.cy < VIEW.y + VIEW.h;
  if (mouse.down && inView && (mouse.dx || mouse.dy)) {
    cam.x -= mouse.dx; cam.y -= mouse.dy;
    camClamp();
    mouse.dx = 0; mouse.dy = 0;
  }

  // marco del mapa
  box(VIEW.x - 1, VIEW.y - 1, VIEW.w + 2, VIEW.h + 2, '#4a5a6a');
  text(VIEW.x + 2, VIEW.y - 1, '╡ MAPA DE ESPAÑA — arrastra para explorar ╞', '#ffb347');

  // mundo: relieve real (costa, llanuras y cordilleras) + mar animado
  for (let r = 0; r < VIEW.h; r++) {
    for (let c = 0; c < VIEW.w; c++) {
      const wx = cam.x + c, wy = cam.y + r;
      const sx = VIEW.x + c, sy = VIEW.y + r;
      const land = wx >= 0 && wx < WORLD_W && wy >= 0 && wy < WORLD_H && WORLD_LAND[wy][wx];
      if (land) {
        put(sx, sy, WORLD_CHAR[wy][wx], WORLD_COLOR[wy][wx]);
      } else if ((wx * 3 + wy * 7 + (frame >> 4)) % 29 === 0) {
        put(sx, sy, '~', '#2a5a7a');
      }
    }
  }

  // ciudades (en coordenadas de mundo)
  const cityScreen = [];
  for (let i = 0; i < CITIES.length; i++) {
    const c = CITIES[i];
    const locked = player.level < c.minLevel;
    const isSel = i === mapCursor;
    const col = locked ? '#555' : c.color;
    const sx = VIEW.x + c.wx - cam.x;
    const sy = VIEW.y + c.wy - cam.y;
    cityScreen.push({ i, sx, sy });
    putV(sx, sy, isSel && frame % 20 < 12 ? '◈' : '■', col);
    const label = c.name + (locked ? ` (niv.${c.minLevel})` : '');
    for (let k = 0; k < label.length; k++) {
      putV(sx + 2 + k, sy, label[k], isSel ? '#fff' : (locked ? '#555' : col));
    }
  }

  // click para seleccionar ciudad
  if (mouse.clicked && inView) {
    let best = null;
    for (const cs of cityScreen) {
      const d = Math.abs(cs.sx - mouse.cx) + Math.abs(cs.sy - mouse.cy) * 2;
      if (d < 12 && (!best || d < best.d)) best = { i: cs.i, d };
    }
    if (best) mapCursor = best.i;
  }

  const c = CITIES[mapCursor];
  const rew = cityReward(c);
  box(4, 27, 62, 12, '#8a7f66');
  text(7, 28, `TORNEO DE ${c.name} — 3 rondas a ${TARGET} puntos`, c.color);
  text(7, 30, `Dificultad : ${'★'.repeat(c.diff)}${'☆'.repeat(8 - c.diff)}`, '#ffe14d');
  text(7, 31, `Final vs   : ${RIVALS[c.diff - 1]} (nivel ${c.diff})`, '#ef9f9f');
  const climaTop = Object.entries(c.clima).sort((a, b) => b[1] - a[1])[0][0];
  text(7, 32, `Clima típico: ${CLIMAS[climaTop].icon} ${CLIMAS[climaTop].label}`, CLIMAS[climaTop].color);
  text(7, 33, `Pista      : ${c.feature.desc.slice(0, 46)}`, '#c9a35d');
  text(7, 34, `Premio     : ${rew.xp} XP + ${rew.money}€ (menos si caes antes)`, '#7ec850');
  if (player.nemesis && player.nemesis.city === c.name) {
    text(7, 35, `¡REVANCHA pendiente contra ${player.nemesis.rival}! (+50% XP)`, '#ff8c5b');
  }
  if (player.level < c.minLevel) {
    text(7, 37, `¡BLOQUEADO! Necesitas renombre ${c.minLevel}`, '#ff5c5c');
  } else {
    text(7, 37, '[ENTER] inscribir a la peña', '#7CFC00');
  }

  // resumen de la peña
  box(70, 27, 64, 12, '#8a7f66');
  text(73, 28, `MI PEÑA (${player.roster.length} abuelos)`, '#4fc3f7');
  let yy = 30;
  for (const i of player.roster.slice(0, 6)) {
    const s = abState(i);
    const stCol = s.st > 60 ? '#7ec850' : s.st > 30 ? '#ffe14d' : '#ff5c5c';
    text(73, yy, FACES[i].name.padEnd(10), '#e8e0c8');
    text(84, yy, `STA ${'▮'.repeat(Math.round(s.st / 12.5))}${'▯'.repeat(8 - Math.round(s.st / 12.5))}`, stCol);
    text(98, yy, `MOR ${s.mo >= 0 ? '+' : ''}${s.mo}`, s.mo >= 0 ? '#88e088' : '#ef9f9f');
    yy++;
  }
  const need = xpForLevel(player.level);
  text(73, 37, `Renombre ${player.level} · XP ${player.xp}/${need} · ${player.money}€`, '#b48ce8');
  text(73, 38, `LIGA T${player.season.num}: jornada ${player.season.jornada}/8 · ${player.season.pts} pts · [3] clasificación`, '#88c8e8');

  const todayBest = player.dailyBest[todayStr()];
  const dailyTxt = todayBest
    ? `[L] TORNEO RELÁMPAGO — hoy: ${todayBest.won ? 'ganado' : 'perdido'} (margen ${todayBest.margin >= 0 ? '+' : ''}${todayBest.margin})`
    : '[L] TORNEO RELÁMPAGO — reto del día, aún sin jugar';
  text(4, 26, dailyTxt, '#c8a0e8');
  text(66, 26, 'RELIEVE: . costa  ; meseta  n montaña  M alta  ▲ nevada', '#8a8a7a');

  if (mapEvent) textCenter(41, '» ' + mapEvent, '#ffcf8a');
  else textCenter(41, '[↑/↓] elegir ciudad    [ENTER] jugar torneo    [L] relámpago    [2] mi peña', '#c9c2a8');

  if (hit('ArrowUp'))   { mapCursor = (mapCursor + CITIES.length - 1) % CITIES.length; mapEvent = null; }
  if (hit('ArrowDown')) { mapCursor = (mapCursor + 1) % CITIES.length; mapEvent = null; }
  // si la ciudad elegida queda fuera de vista, recentrar la cámara
  if (hit('ArrowUp') || hit('ArrowDown')) {
    const sc = CITIES[mapCursor];
    const vx = sc.wx - cam.x, vy = sc.wy - cam.y;
    if (vx < 4 || vx > VIEW.w - 16 || vy < 2 || vy > VIEW.h - 2) camCenterOn(sc);
  }
  if (hit('Enter') || hit(' ')) {
    if (player.level >= c.minLevel) {
      mapEvent = null;
      newTournament(c);
      state = 'lineup';
    }
  }
  if (hit('l') || hit('L')) {
    mapEvent = null;
    newDailyChallenge();
    state = 'lineup';
  }
}

// ------------------------------------------------------------
// MI PEÑA (galería + fichajes)
// ------------------------------------------------------------
function drawPenya() {
  clearScreen();
  drawTabs('penya');

  const f = FACES[faceCursor];
  const data = ABUELO_DATA[faceCursor];
  const owned = player.roster.includes(faceCursor);

  const fx = 10, fy = 5;
  box(fx - 2, fy - 1, 64, 42, owned ? '#ffe14d' : '#8a7f66', 'double');
  drawFacePortrait(f, fx, fy + 1, owned);
  if (frame % 30 < 20) {
    text(fx - 7, fy + 19, '◀◀', '#7CFC00');
    text(fx + 63, fy + 19, '▶▶', '#7CFC00');
  }

  const sx = 80;
  const genTag = owned && abState(faceCursor).gen > 0 ? ` (nieto, ${abState(faceCursor).gen}ª gen.)` : '';
  text(sx, 4, `${f.name}${genTag}   ·   ${faceCursor + 1} / ${FACES.length}`, owned ? '#4fc3f7' : '#8a8a8a');
  text(sx, 5, owned ? '★ EN LA PEÑA' : `CANDIDATO — ficha por ${data.price}€`, owned ? '#ffe14d' : '#c9b98a');

  // stats
  const names = { pulso: 'Pulso', brazo: 'Brazo', mana: 'Maña', temple: 'Temple', aguante: 'Aguante' };
  let yy = 7;
  for (const k of Object.keys(names)) {
    const v = owned ? getStat(faceCursor, k) : data.stats[k];
    const trained = owned && (abState(faceCursor).bonus[k] || 0) > 0;
    text(sx, yy, `${names[k].padEnd(8)} ${'▮'.repeat(v)}${'▯'.repeat(10 - v)} ${v}${trained ? ' ▲' : ''}`, trained ? '#a8e8a8' : '#88c8e8');
    yy++;
  }
  // clima
  yy++;
  text(sx, yy++, 'CLIMA:', '#ffb347');
  for (const [k, v] of Object.entries(data.clima)) {
    const cl = CLIMAS[k];
    const tag = v === 1 ? 'INMUNE' : v === -1 ? 'LE AFECTA DOBLE' : 'normal';
    const col = v === 1 ? '#7ec850' : v === -1 ? '#ff5c5c' : '#777';
    text(sx + 2, yy++, `${cl.icon} ${cl.label.padEnd(14)} ${tag}`, col);
  }
  yy++;
  // rasgo
  text(sx, yy++, 'RASGO:', '#ffb347');
  wrapText(f.desc, 52).forEach(l => text(sx + 2, yy++, l, '#c9b98a'));
  wrapText(data.trait, 52).forEach(l => text(sx + 2, yy++, l, '#d8b8e8'));
  yy++;
  if (owned) {
    const s = abState(faceCursor);
    const stCol = s.st > 60 ? '#7ec850' : s.st > 30 ? '#ffe14d' : '#ff5c5c';
    text(sx, yy++, `Stamina ${'▮'.repeat(Math.round(s.st / 10))}${'▯'.repeat(10 - Math.round(s.st / 10))} ${Math.round(s.st)}`, stCol);
    text(sx, yy++, `Moral   ${s.mo >= 0 ? '+' : ''}${s.mo}`, s.mo >= 0 ? '#88e088' : '#ef9f9f');
    if (s.item) {
      const it = ITEMS[s.item.id];
      const climaTxt = s.item.clima ? ` → ${CLIMAS[s.item.clima].label}` : '';
      text(sx, yy++, `${it.icon} ${it.name}${climaTxt}`, '#ffd9a0');
    }
    yy++;
    if (s.st >= 30) {
      text(sx, yy++, '[A] entrenar ARRIME (+1 pulso, -30 STA)', '#7CFC00');
      text(sx, yy++, '[T] entrenar TIRO   (+1 brazo, -30 STA)', '#7CFC00');
    } else {
      text(sx, yy++, 'Demasiado cansado para entrenar (necesita 30 STA)', '#8a7f66');
    }
    yy++;
    text(sx, yy++, `Partidas jugadas: ${s.torneos} / ${RETIRE_AT}`, '#9a927a');
    if (s.torneos >= RETIRE_AT) {
      text(sx, yy++, '[G] retirar con honores → pasa el testigo a su nieto', frame % 20 < 14 ? '#d8b8e8' : '#8a6ba0');
    }
  } else if (player.freePick) {
    text(sx, yy++, '¡FICHAJE FUNDACIONAL GRATIS! [ENTER] para ficharlo', frame % 20 < 14 ? '#7CFC00' : '#4a8a4a');
  } else if (player.money >= data.price) {
    text(sx, yy++, `[ENTER] fichar por ${data.price}€ (tienes ${player.money}€)`, '#7CFC00');
  } else {
    text(sx, yy++, `Te faltan ${data.price - player.money}€ para ficharlo`, '#ff5c5c');
  }

  text(sx - 3, 43, '[←/→] ver abuelos   [1] torneos', '#c9c2a8');

  if (hit('ArrowLeft'))  faceCursor = (faceCursor + FACES.length - 1) % FACES.length;
  if (hit('ArrowRight')) faceCursor = (faceCursor + 1) % FACES.length;
  if (owned && abState(faceCursor).st >= 30) {
    if (hit('a') || hit('A')) { newTraining(faceCursor, 'ARRIME'); state = 'match'; }
    if (hit('t') || hit('T')) { newTraining(faceCursor, 'TIRO'); state = 'match'; }
  }
  if (owned && abState(faceCursor).torneos >= RETIRE_AT && (hit('g') || hit('G'))) {
    retireToGrandchild(faceCursor);
  }
  if ((hit('Enter') || hit(' ')) && !owned) {
    if (player.freePick) {
      player.roster.push(faceCursor);
      player.state[faceCursor] = { st: 100, mo: 0 };
      player.freePick = false;
      savePlayer();
    } else if (player.money >= data.price) {
      player.money -= data.price;
      player.roster.push(faceCursor);
      player.state[faceCursor] = { st: 100, mo: 5 };
      savePlayer();
    }
  }
}

function drawFacePortrait(f, x, y, full) {
  if (full) { drawPhotoArt(f.photo, x, y); return; }
  // candidato: retrato en gris (aún no es de la peña)
  const art = f.photo;
  for (let r = 0; r < art.rows; r++) {
    const line = art.chars[r], idx = art.colorIdx[r];
    for (let c = 0; c < art.cols; c++) {
      if (line[c] === ' ') continue;
      const hex = art.palette[idx[c]];
      const v = Math.round((parseInt(hex.slice(1, 3), 16) * 0.3 +
                            parseInt(hex.slice(3, 5), 16) * 0.5 +
                            parseInt(hex.slice(5, 7), 16) * 0.2));
      const g = ('0' + v.toString(16)).slice(-2);
      put(x + c, y + r, line[c], `#${g}${g}${g}`);
    }
  }
}

function wrapText(s, w) {
  const words = s.split(' ');
  const lines = [];
  let cur = '';
  for (const word of words) {
    if ((cur + word).length > w) { lines.push(cur.trim()); cur = ''; }
    cur += word + ' ';
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines;
}

// ------------------------------------------------------------
// ALINEACIÓN (antes de cada ronda)
// ------------------------------------------------------------
function drawLineup() {
  clearScreen();
  const r = T.rounds[T.roundIdx];
  const rew = cityReward(T.city);
  textCenter(1, `╣ TORNEO DE ${T.city.name} — ${r.name} ╠`, T.city.color);
  textCenter(2, `PISTA: ${T.city.feature.desc}`, '#c9a35d');

  // rival
  box(6, 3, 24, 16, '#ef7676', 'double');
  drawPhotoArt(RIVAL_FACES[r.rivalIdx].photo, 8, 4);
  text(6, 19, RIVALS[r.rivalIdx], '#ef7676');
  text(6, 20, `Nivel ${r.aiLevel}`, '#c98080');
  if (player.nemesis && player.nemesis.rivalIdx === r.rivalIdx) {
    text(6, 21, '¡TU NÉMESIS! Véngate.', frame % 20 < 14 ? '#ff8c5b' : '#a05838');
  }

  // previsión
  const cl = CLIMAS[r.forecast.main];
  box(6, 23, 34, 8, '#8a7f66');
  text(9, 24, 'PARTE METEOROLÓGICO', '#ffb347');
  text(9, 26, `${cl.icon} ${cl.label}`, cl.color);
  if (r.forecast.changeProb > 0) {
    const cl2 = CLIMAS[r.forecast.changeTo];
    text(9, 28, `Ojo: podría cambiar a ${cl2.icon} ${cl2.label}`, '#c9b98a');
  } else {
    text(9, 28, 'Tiempo estable, dicen en la radio.', '#8a8a7a');
  }

  // progreso del torneo
  box(6, 32, 34, 8, '#8a7f66');
  text(9, 33, T.isDaily ? 'RETO RELÁMPAGO' : 'CAMINO DEL TORNEO', '#ffb347');
  for (let i = 0; i < T.rounds.length; i++) {
    const done = T.results[i];
    const cur = i === T.roundIdx;
    const rname = T.isDaily ? T.rounds[i].name : ROUND_NAMES[i];
    let str = `${rname.padEnd(10)} vs ${RIVALS[T.rounds[i].rivalIdx]}`;
    let col = '#666';
    if (done) { str += done.won ? '  ✓' : '  ✗'; col = done.won ? '#7ec850' : '#ff5c5c'; }
    else if (cur) col = '#ffe680';
    text(9, 35 + i, (cur ? '▶ ' : '  ') + str, col);
  }

  // formato del equipo
  const formatoLabel = { 1: '1 CONTRA 1', 2: 'DOBLETE (2)', 3: 'TRIPLETA (3)' }[T.formato];
  text(46, 3, `FORMATO: ${formatoLabel}   [M] cambiar`, '#ffb347');
  text(46, 4, T.formato === 1 ? '¿QUIÉN JUEGA? — elige y sales a la pista' : `¿QUIÉN JUEGA? (${T.teamSel.length}/${T.formato} elegidos)`, '#7CFC00');
  let yy = 6;
  for (let k = 0; k < player.roster.length; k++) {
    const i = player.roster[k];
    const s = abState(i);
    const d = ABUELO_DATA[i];
    const sel = k === lineupCursor;
    const picked = T.teamSel.includes(i);
    const stCol = s.st > 60 ? '#7ec850' : s.st > 30 ? '#ffe14d' : '#ff5c5c';
    const aff = d.clima[r.forecast.main] !== undefined ? d.clima[r.forecast.main] : 0;
    const affStr = r.forecast.main === 'SOL' ? '  ' : aff === 1 ? ' ✚' : aff === -1 ? ' ▼' : '  ';
    const affCol = aff === 1 ? '#7ec850' : aff === -1 ? '#ff5c5c' : '#666';
    if (sel) box(44, yy - 1, 62, 5, '#7CFC00');
    text(47, yy, `${picked ? '✓ ' : '  '}${FACES[i].name}`, picked ? '#ffe680' : sel ? '#fff' : '#c9c2a8');
    text(60, yy, `STA ${'▮'.repeat(Math.round(s.st / 12.5))}${'▯'.repeat(8 - Math.round(s.st / 12.5))} ${Math.round(s.st)}`, stCol);
    text(82, yy, `MOR ${s.mo >= 0 ? '+' : ''}${s.mo}`, s.mo >= 0 ? '#88e088' : '#ef9f9f');
    text(92, yy, `${CLIMAS[r.forecast.main].icon}${affStr}`, affCol);
    text(47, yy + 1, `P${getStat(i, 'pulso')} B${getStat(i, 'brazo')} M${getStat(i, 'mana')} T${getStat(i, 'temple')} A${getStat(i, 'aguante')}`, '#88c8e8');
    if (T.usados.includes(i)) text(78, yy + 1, 'ya ha jugado hoy', '#8a7f66');
    yy += 5;
    if (yy > 37) break;
  }

  // juego de bolas elegido
  const bolaName = BOLAS[T.bola].name;
  const many = player.bolasOwned.length > 1;
  text(46, 40, `BOLAS: ${many ? '◀ ' : ''}${bolaName}${many ? ' ▶' : ''}`, '#88c8e8');
  text(46 + 10 + bolaName.length + (many ? 4 : 0) + 3, 40, BOLAS[T.bola].desc.slice(0, 50), '#6a86a0');

  // apuesta del bar (solo antes de empezar el torneo)
  if (T.bet && T.roundIdx === 0) {
    if (T.bet.accepted) {
      text(46, 41, `✔ Apuesta aceptada: ${T.bet.desc}`, '#ffcf8a');
    } else {
      text(46, 41, `EL DEL BAR: "${T.bet.desc}"   [A] aceptar`, frame % 30 < 22 ? '#ffcf8a' : '#a08050');
    }
  } else if (T.bet && T.bet.accepted) {
    text(46, 41, `✔ Apuesta viva: ${T.bet.desc}`, '#ffcf8a');
  }

  const canStart = T.teamSel.length === T.formato;
  // línea base fija (no cambia de longitud ni de posición al parpadear)
  const baseHelp = T.formato === 1
    ? '[↑/↓] abuelo   [ENTER] jugar   [←/→] bolas'
    : `[↑/↓] abuelo   [ENTER] elegir/quitar   [M] formato   [←/→] bolas   (${T.teamSel.length}/${T.formato})`;
  textCenter(43, baseHelp, '#c9c2a8');
  if (T.formato > 1 && canStart && frame % 24 < 16) {
    textCenter(44, '▶ [S] ¡A LA PISTA! ◀', '#7CFC00');
  }

  if (hit('ArrowUp'))   lineupCursor = (lineupCursor + player.roster.length - 1) % player.roster.length;
  if (hit('ArrowDown')) lineupCursor = (lineupCursor + 1) % player.roster.length;
  if (hit('m') || hit('M')) {
    const maxF = Math.min(3, player.roster.length);
    do { T.formato = T.formato % 3 + 1; } while (T.formato > maxF);
    T.teamSel = [];
  }
  if (hit('Enter') || hit(' ')) {
    if (T.formato === 1) {
      // formato individual: un solo ENTER elige y lanza la partida
      newMatch([player.roster[lineupCursor]]);
      state = 'match';
    } else {
      const i = player.roster[lineupCursor];
      if (T.teamSel.includes(i)) {
        T.teamSel = T.teamSel.filter(x => x !== i);
      } else if (T.teamSel.length < T.formato) {
        T.teamSel.push(i);
      }
    }
  }
  if (hit('ArrowLeft') || hit('ArrowRight')) {
    const owned = player.bolasOwned;
    let k = owned.indexOf(T.bola);
    k = (k + (hit('ArrowRight') ? 1 : owned.length - 1)) % owned.length;
    T.bola = owned[k];
    player.bolaSel = T.bola;
    savePlayer();
  }
  if ((hit('a') || hit('A')) && T.bet && !T.bet.accepted && T.roundIdx === 0) {
    T.bet.accepted = true;
    player.money -= T.bet.stake;
    savePlayer();
  }
  if (T.formato > 1 && (hit('s') || hit('S')) && canStart) {
    newMatch(T.teamSel);
    state = 'match';
  }
}

// ------------------------------------------------------------
// RESULTADO del torneo
// ------------------------------------------------------------
function drawResult() {
  clearScreen();
  const o = T.outcome;
  if (o.won) {
    block(Math.floor((COLS - 21) / 2), 3, TROPHY_ART, '#ffe14d');
    textCenter(15, T.isDaily ? `¡RELÁMPAGO GANADO EN ${T.city.name}!` : `¡CAMPEONES DEL TORNEO DE ${T.city.name}!`, '#7CFC00');
  } else {
    textCenter(6, T.isDaily ? 'Reto relámpago perdido...' : `Eliminados en ${ROUND_NAMES[T.roundIdx]}...`, '#ff5c5c');
    textCenter(8, `${RIVALS[T.rounds[T.roundIdx].rivalIdx]} os manda de vuelta al pueblo.`, '#c9b98a');
    if (!T.isDaily) textCenter(10, 'Queda apuntado. Habrá revancha.', '#ff8c5b');
  }

  // resumen de rondas
  let yy = 18;
  textCenter(yy++, '— CRÓNICA DEL TORNEO —', '#ffb347');
  yy++;
  for (const res of T.results) {
    const names = res.abuelos.map(i => FACES[i].name).join('+');
    const line = `${ROUND_NAMES[res.round].padEnd(10)} ${names.padEnd(16)} ${res.scoreP}-${res.scoreA} vs ${res.rival}  ${res.won ? '✓' : '✗'}`;
    textCenter(yy++, line, res.won ? '#7ec850' : '#ff5c5c');
  }
  yy++;
  textCenter(yy++, `+${o.xp} XP      +${o.money}€      +${o.ligaPts} pts de liga`, '#b48ce8');
  if (o.revenge) textCenter(yy++, '¡REVANCHA CUMPLIDA! XP con sabor a gloria (+50%)', '#ff8c5b');
  if (o.stormWin) textCenter(yy++, '⚡ ¡CAMPEONES BAJO TORMENTA! Premio doble por aguantar el chaparrón.', '#c8a0e8');
  if (o.itemDrop) {
    const it = ITEMS[o.itemDrop.item.id];
    const climaTxt = o.itemDrop.item.clima ? ` (inmunidad a ${CLIMAS[o.itemDrop.item.clima].label})` : '';
    textCenter(yy++, `${it.icon} ¡${FACES[o.itemDrop.i].name} se trae ${it.name}${climaTxt}!`, '#ffd9a0');
  }
  if (o.betResult) {
    textCenter(yy++, o.betResult.won
      ? `El del bar paga de morros: +${o.betResult.amount}€ de la apuesta.`
      : `El del bar sonríe: adiós a los ${o.betResult.amount}€ de la apuesta.`,
      o.betResult.won ? '#7ec850' : '#ff5c5c');
  }
  if (o.ups > 0) {
    if (frame % 16 < 10) textCenter(yy + 1, `★ ★ ★  ¡RENOMBRE ${player.level}!  ★ ★ ★`, '#ffe14d');
    yy += 2;
  }
  textCenter(40, '[ENTER] volver al mapa', '#7CFC00');
  if (hit('Enter') || hit(' ')) state = 'map';
}

// ------------------------------------------------------------
// Bucle principal
// ------------------------------------------------------------
let lastT = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  frame++;

  switch (state) {
    case 'title':  drawTitle(); break;
    case 'map':    drawMap(); break;
    case 'penya':  drawPenya(); break;
    case 'bar':    drawBar(); break;
    case 'historia': drawHistoria(); break;
    case 'lineup': drawLineup(); break;
    case 'match':  updateMatch(dt); drawMatch(); break;
    case 'result': drawResult(); break;
  }

  drawCursor();
  render();
  pressed = {};
  mouse.clicked = false;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
