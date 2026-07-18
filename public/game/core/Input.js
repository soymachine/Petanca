// Estado de teclado y ratón, con cursor ASCII propio.
// Responsabilidad única: traducir eventos DOM en un estado consultable por frame.
export class Input {
  constructor(screenEl, cols, rows) {
    this.cols = cols;
    this.rows = rows;
    this.keys = {};
    this.pressed = {};
    this.mouse = { cx: -1, cy: -1, down: false, clicked: false, dragDist: 0, dx: 0, dy: 0 };
    this.wheel = 0;

    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Tab'].includes(e.key)) e.preventDefault();
      if (!this.keys[e.key]) this.pressed[e.key] = true;
      this.keys[e.key] = true;
    });
    window.addEventListener('keyup', (e) => { this.keys[e.key] = false; });

    screenEl.addEventListener('mousemove', (e) => {
      const r = screenEl.getBoundingClientRect();
      const ncx = Math.floor((e.clientX - r.left) / (r.width / cols));
      const ncy = Math.floor((e.clientY - r.top) / (r.height / rows));
      const m = this.mouse;
      if (m.down && m.cx >= 0) {
        m.dx = ncx - m.cx; m.dy = ncy - m.cy;
        m.dragDist += Math.abs(m.dx) + Math.abs(m.dy);
      } else { m.dx = 0; m.dy = 0; }
      m.cx = ncx; m.cy = ncy;
    });
    screenEl.addEventListener('mouseleave', () => { this.mouse.cx = -1; this.mouse.cy = -1; this.mouse.down = false; });
    screenEl.addEventListener('mousedown', () => { this.mouse.down = true; this.mouse.dragDist = 0; });
    window.addEventListener('mouseup', () => {
      const m = this.mouse;
      if (m.down && m.dragDist < 3) m.clicked = true;
      m.down = false; m.dx = 0; m.dy = 0;
    });
    screenEl.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.wheel += Math.sign(e.deltaY);
    }, { passive: false });
  }

  hit(k) { return !!this.pressed[k]; }
  held(k) { return !!this.keys[k]; }

  drawCursor(screen) {
    if (this.mouse.cx < 0) return;
    screen.put(this.mouse.cx, this.mouse.cy, '◤', '#ffffff');
  }

  endFrame() {
    this.pressed = {};
    this.mouse.clicked = false;
    this.wheel = 0;
  }
}
