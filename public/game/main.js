import { Game } from './core/Game.js';

const screenEl = document.getElementById('screen');
const game = new Game(screenEl);
game.start();
