// Estado de teclado y puntero (ratón y táctil), consultable por frame.
// Responsabilidad única: traducir eventos DOM en celdas de la rejilla.
// Además de la celda entera (cx/cy, lo que usan todas las pantallas con
// hitRect), guarda la posición FRACCIONARIA (fx/fy, en celdas) para lo
// que necesita precisión sub-celda: el cursor y el gesto de lanzamiento.
export class Input {
  constructor(screenEl, cols, rows) {
    this.cols = cols;
    this.rows = rows;
    this.keys = {};
    this.pressed = {};
    this.mouse = { cx: -1, cy: -1, fx: -1, fy: -1, down: false, clicked: false, dragDist: 0, dx: 0, dy: 0, inside: false };
    this.wheel = 0;
    // (clientX, clientY) → { fx, fy } en celdas; el renderer de canvas lo
    // sustituye por el suyo (la rejilla no ocupa todo el elemento)
    this.mapper = (x, y) => {
      const r = screenEl.getBoundingClientRect();
      return { fx: (x - r.left) / (r.width / cols), fy: (y - r.top) / (r.height / rows) };
    };

    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Tab', 'F3', 'F7', 'F8', 'F9', 'F11'].includes(e.key)) e.preventDefault();
      if (!this.keys[e.key]) this.pressed[e.key] = true;
      this.keys[e.key] = true;
    });
    window.addEventListener('keyup', (e) => { this.keys[e.key] = false; });
    window.addEventListener('blur', () => { this.keys = {}; this.mouse.down = false; });

    const move = (e) => {
      const { fx, fy } = this.mapper(e.clientX, e.clientY);
      const m = this.mouse;
      const inside = fx >= 0 && fy >= 0 && fx < cols && fy < rows;
      const ncx = inside ? Math.floor(fx) : -1, ncy = inside ? Math.floor(fy) : -1;
      if (m.down && m.cx >= 0 && ncx >= 0) {
        m.dx = ncx - m.cx; m.dy = ncy - m.cy;
        m.dragDist += Math.abs(m.dx) + Math.abs(m.dy);
      } else { m.dx = 0; m.dy = 0; }
      m.cx = ncx; m.cy = ncy; m.fx = fx; m.fy = fy; m.inside = inside;
      this._seen = true;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerdown', (e) => {
      move(e);
      this.mouse.down = true; this.mouse.dragDist = 0;
      this.mouse.downFx = this.mouse.fx; this.mouse.downFy = this.mouse.fy;
    });
    window.addEventListener('pointerup', (e) => {
      move(e);
      const m = this.mouse;
      if (m.down && m.dragDist < 3) m.clicked = true;
      m.down = false; m.dx = 0; m.dy = 0;
      m.released = true;
    });
    document.addEventListener('mouseout', (e) => {
      if (e.relatedTarget) return; // solo al salir de la ventana
      this.mouse.cx = -1; this.mouse.cy = -1; this.mouse.inside = false; this._seen = false;
    });
    window.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.wheel += Math.sign(e.deltaY);
    }, { passive: false });
  }

  setMapper(fn) { this.mapper = fn; }

  hit(k) { return !!this.pressed[k]; }
  held(k) { return !!this.keys[k]; }

  drawCursor(screen) {
    const m = this.mouse;
    if (screen.renderer) {
      // en el margen fuera de la rejilla el cursor también se ve (el
      // puntero del sistema está oculto en todo el lienzo)
      screen.renderer.cursor = this._seen ? { fx: m.fx, fy: m.fy } : null;
      return;
    }
    if (m.cx >= 0) screen.put(m.cx, m.cy, '◤', '#ffffff');
  }

  endFrame() {
    this.pressed = {};
    this.mouse.clicked = false;
    this.mouse.released = false;
    this.wheel = 0;
  }
}
