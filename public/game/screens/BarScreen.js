import { BOLAS } from '../data/bolas.js';
import { ITEMS, ITEM_IDS } from '../data/items.js';
import { itemArtFor, ITEM_ART_W, ITEM_ART_H } from '../data/art/itemArt.js';
import { CLIMAS } from '../data/climas.js';
import { wrapText, hitRect, drawTabRow } from '../core/utils.js';
import { TabsBar } from './TabsBar.js';

const SECTIONS = ['bolas', 'amuletos'];
const SECTION_LABEL = { bolas: 'BOLAS', amuletos: 'AMULETOS' };
const PANUELO_CLIMAS = ['LLUVIA', 'VIENTO', 'CALOR', 'NIEBLA', 'HELADA'];
const AMULET_ROW_H = ITEM_ART_H + 2; // arte + un renglón de aire arriba/abajo

export class BarScreen {
  constructor(game) { this.game = game; this.cursor = 0; this.section = 'bolas'; this.buying = null; this.amuletScroll = 0; }

  draw() {
    const { screen, input } = this.game;
    screen.clear();
    TabsBar.draw(this.game, 'bar');
    screen.textCenter(4, '═══ EL BAR DE LA PEÑA ═══', '#ffb347');
    screen.textCenter(5, 'humo, carajillos y la tele con el volumen a tope', '#8a7f66');
    const clicked = drawTabRow(screen, input, 4, 6, SECTIONS.map((s) => SECTION_LABEL[s]), SECTIONS.indexOf(this.section));
    screen.text(80, 6, '[Q] cambiar de pestaña', '#8a7f66');

    if (this.section === 'bolas') this._drawBolas();
    else this._drawAmuletos();

    if (this.buying) { this._drawBuyModal(); return; }
    if (clicked !== null) { this.section = SECTIONS[clicked]; this.cursor = 0; }
    else if (input.hit('q') || input.hit('Q')) { this.section = this.section === 'bolas' ? 'amuletos' : 'bolas'; this.cursor = 0; }
  }

  _drawBolas() {
    const { screen, input, player } = this.game;
    screen.box(4, 8, 66, 22, '#8a7f66');
    screen.text(7, 9, 'VITRINA DE BOLAS DE COMPETICIÓN', '#ffb347');
    let yy = 11;
    for (let i = 0; i < BOLAS.length; i++) {
      const b = BOLAS[i];
      const owned = player.bolasOwned.includes(i);
      const sel = i === this.cursor;
      if (sel) screen.box(5, yy - 1, 64, 5, '#7CFC00');
      screen.text(8, yy, `${b.name}`, sel ? '#fff' : owned ? '#88c8e8' : '#8a8a8a');
      screen.text(30, yy, owned ? (player.bolaSel === i ? '★ EN USO' : 'EN LA VITRINA') : `${b.price}€`,
        owned ? '#ffe14d' : player.money >= b.price ? '#7ec850' : '#ff5c5c');
      wrapText(b.desc, 58).forEach((l, k) => screen.text(8, yy + 1 + k, l, '#9a927a'));
      yy += 5;
    }
    screen.text(7, 31, '[↑/↓] mirar   [ENTER] usar', '#c9c2a8');

    if (this.buying) return;
    if (input.hit('ArrowUp')) this.cursor = (this.cursor + BOLAS.length - 1) % BOLAS.length;
    if (input.hit('ArrowDown')) this.cursor = (this.cursor + 1) % BOLAS.length;
    if (input.hit('Enter') || input.hit(' ')) {
      const b = BOLAS[this.cursor];
      if (player.bolasOwned.includes(this.cursor)) { player.bolaSel = this.cursor; player.save(); }
      else if (player.money >= b.price) {
        player.money -= b.price; player.bolasOwned.push(this.cursor); player.bolaSel = this.cursor; player.save();
      }
    }
  }

  // mostrador de amuletos: se compran aquí en vez de esperar a que caigan
  // tras un torneo (más caros, pero sin depender de la suerte). Cada fila
  // lleva su icono ASCII (generado por fórmula, ver data/art/itemArt.js)
  // en vez de un emoji — un emoji no mide una celda igual en todos los
  // tipos de letra y descuadraba el resto de la columna.
  _drawAmuletos() {
    const { screen, input, player } = this.game;
    const boxX = 4, boxY = 8, boxW = 118, boxH = 36;
    screen.box(boxX, boxY, boxW, boxH, '#8a7f66');
    screen.text(boxX + 3, boxY + 1, 'MOSTRADOR DE AMULETOS', '#ffb347');
    screen.text(boxX + 3, boxY + 2, 'un amuleto por abuelo — comprar sustituye el que ya llevara', '#8a7f66');

    const listY = boxY + 4, listH = boxH - 6;
    const visibleRows = Math.max(1, Math.floor(listH / AMULET_ROW_H));
    const maxOffset = Math.max(0, ITEM_IDS.length - visibleRows);
    const overList = hitRect(input.mouse.cx, input.mouse.cy, boxX, listY, boxW, listH);
    if (overList) this.amuletScroll -= input.wheel;
    this.amuletScroll = Math.max(0, Math.min(maxOffset, this.amuletScroll));

    let yy = listY;
    let rowHover = null;
    ITEM_IDS.slice(this.amuletScroll, this.amuletScroll + visibleRows).forEach((id, i) => {
      const idx = this.amuletScroll + i;
      const it = ITEMS[id];
      const sel = idx === this.cursor;
      const rowRect = { x: boxX + 1, y: yy, w: boxW - 2, h: AMULET_ROW_H };
      const over = hitRect(input.mouse.cx, input.mouse.cy, rowRect.x, rowRect.y, rowRect.w, rowRect.h);
      if (over) rowHover = idx;
      if (sel || over) screen.box(rowRect.x, rowRect.y, rowRect.w, rowRect.h, sel ? '#7CFC00' : '#ffe680');

      const artX = boxX + 4, artY = yy + 1;
      screen.drawPhotoArt(itemArtFor(id), artX, artY);

      const textX = artX + ITEM_ART_W + 3;
      screen.text(textX, yy + 1, it.name, sel ? '#fff' : over ? '#ffe680' : '#88c8e8');
      screen.text(textX, yy + 2, `${it.price}€`, player.money >= it.price ? '#7ec850' : '#ff5c5c');
      wrapText(it.desc, boxW - (textX - boxX) - 4).forEach((l, k) => screen.text(textX, yy + 3 + k, l, '#9a927a'));
      yy += AMULET_ROW_H;
    });

    if (maxOffset > 0) {
      const trackX = boxX + boxW - 2;
      screen.put(trackX, listY, this.amuletScroll > 0 ? '▲' : '│', '#8fa08f');
      screen.put(trackX, listY + visibleRows * AMULET_ROW_H - 1, this.amuletScroll < maxOffset ? '▼' : '│', '#8fa08f');
    }

    screen.text(boxX + 3, boxY + boxH - 1, '[↑/↓] elegir · ratón = seleccionar · rueda = scroll   [ENTER] comprar', '#c9c2a8');

    if (this.buying) return;
    if (rowHover !== null && input.mouse.clicked) this.cursor = rowHover;
    if (input.hit('ArrowUp')) {
      this.cursor = (this.cursor + ITEM_IDS.length - 1) % ITEM_IDS.length;
      if (this.cursor < this.amuletScroll) this.amuletScroll = this.cursor;
      if (this.cursor === ITEM_IDS.length - 1) this.amuletScroll = maxOffset;
    }
    if (input.hit('ArrowDown')) {
      this.cursor = (this.cursor + 1) % ITEM_IDS.length;
      if (this.cursor >= this.amuletScroll + visibleRows) this.amuletScroll = this.cursor - visibleRows + 1;
      if (this.cursor === 0) this.amuletScroll = 0;
    }
    if (input.hit('Enter') || input.hit(' ')) {
      const id = ITEM_IDS[this.cursor];
      if (player.money >= ITEMS[id].price && player.roster.size) {
        this.buying = { itemId: id, step: 'target', targetCursor: 0, clima: null };
        input.pressed.Enter = false; input.pressed[' '] = false;
      }
    }
  }

  _drawBuyModal() {
    const { screen, input, player } = this.game;
    const w = 62, h = 20;
    const x = Math.floor((screen.cols - w) / 2), y = Math.floor((screen.rows - h) / 2);
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) screen.put(x + c, y + r, '█', '#000');
    screen.box(x, y, w, h, '#ffe14d', 'double');
    const it = ITEMS[this.buying.itemId];

    if (this.buying.step === 'target') {
      screen.textCenter(y + 1, `¿PARA QUIÉN ES ${it.name}?`, '#ffe680');
      const ids = player.roster.ids;
      this.buying.targetCursor = ((this.buying.targetCursor % ids.length) + ids.length) % ids.length;
      ids.forEach((id, i) => {
        const s = player.roster.get(id);
        const sel = i === this.buying.targetCursor;
        const already = s.item ? ` (llevaba ${ITEMS[s.item.id].name})` : '';
        screen.text(x + 4, y + 3 + i, `${sel ? '▶' : ' '} ${this.game.displayName(id)}${already}`, sel ? '#fff' : '#c9c2a8');
      });
      screen.textCenter(y + h - 2, '[↑/↓] elegir   [ENTER] confirmar   [ESC] cancelar', '#c9c2a8');
      if (input.hit('ArrowUp')) this.buying.targetCursor = (this.buying.targetCursor + ids.length - 1) % ids.length;
      if (input.hit('ArrowDown')) this.buying.targetCursor = (this.buying.targetCursor + 1) % ids.length;
      if (input.hit('Enter') || input.hit(' ')) {
        this.buying.targetId = ids[this.buying.targetCursor];
        if (this.buying.itemId === 'panuelo') { this.buying.step = 'clima'; this.buying.climaCursor = 0; }
        else this._confirmBuy();
      }
      if (input.hit('Escape')) { this.buying = null; input.pressed.Escape = false; }
    } else {
      screen.textCenter(y + 1, '¿INMUNE A QUÉ CLIMA?', '#ffe680');
      this.buying.climaCursor = ((this.buying.climaCursor % PANUELO_CLIMAS.length) + PANUELO_CLIMAS.length) % PANUELO_CLIMAS.length;
      PANUELO_CLIMAS.forEach((k, i) => {
        const cl = CLIMAS[k];
        const sel = i === this.buying.climaCursor;
        screen.text(x + 4, y + 3 + i, `${sel ? '▶' : ' '} ${cl.icon} ${cl.label}`, sel ? '#fff' : cl.color);
      });
      screen.textCenter(y + h - 2, '[↑/↓] elegir   [ENTER] confirmar   [ESC] cancelar', '#c9c2a8');
      if (input.hit('ArrowUp')) this.buying.climaCursor = (this.buying.climaCursor + PANUELO_CLIMAS.length - 1) % PANUELO_CLIMAS.length;
      if (input.hit('ArrowDown')) this.buying.climaCursor = (this.buying.climaCursor + 1) % PANUELO_CLIMAS.length;
      if (input.hit('Enter') || input.hit(' ')) {
        this.buying.clima = PANUELO_CLIMAS[this.buying.climaCursor];
        this._confirmBuy();
      }
      if (input.hit('Escape')) { this.buying = null; input.pressed.Escape = false; }
    }
  }

  _confirmBuy() {
    const { player } = this.game;
    const it = ITEMS[this.buying.itemId];
    if (player.money < it.price) { this.buying = null; return; }
    player.money -= it.price;
    const item = { id: this.buying.itemId };
    if (this.buying.clima) item.clima = this.buying.clima;
    player.roster.get(this.buying.targetId).item = item;
    player.news.push(`${this.game.displayName(this.buying.targetId)} estrena ${it.name}, comprado en El Bar.`);
    player.save();
    this.buying = null;
  }
}
