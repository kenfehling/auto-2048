import { Game } from './game.js';
import { AI } from './ai.js';

const ai = new AI();

self.onmessage = (e) => {
  const { type, gameData } = e.data;

  if (type === 'GET_MOVE') {
    const game = Game.fromState(gameData);
    const move = ai.getNextMove(game);
    self.postMessage({ move });
  }
};
