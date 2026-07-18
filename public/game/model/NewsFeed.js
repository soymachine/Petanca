// Hemeroteca: titulares generados por lo que va pasando en la peña.
export class NewsFeed {
  constructor(items = []) { this.items = items.slice(); }
  static fromJSON(json) { return new NewsFeed(json); }
  toJSON() { return this.items; }

  push(text) {
    this.items.unshift(text);
    if (this.items.length > 30) this.items.length = 30;
  }

  latest(n = 27) { return this.items.slice(0, n); }
}
