import { Game } from './game.js';
import { AI } from './ai.js';

let ai = null;
let isInitialized = false;
let pendingRequests = [];
let currentStrategy = 'snake'; // default

// Initialize AI with strategy
async function initializeAI(strategyName = 'snake') {
  try {
    const response = await fetch(`/src/strategies/${strategyName}.dsl`);
    const strategyText = await response.text();
    ai = new AI(strategyText);
    isInitialized = true;
    currentStrategy = strategyName;

    // Process any pending requests
    while (pendingRequests.length > 0) {
      const request = pendingRequests.shift();
      processRequest(request);
    }
  } catch (error) {
    console.error('Failed to load strategy:', error);
    // Fallback to hardcoded strategy
    ai = new AI();
    isInitialized = true;
  }
}

function processRequest(data) {
  const { type, gameData, strategyName } = data;

  if (type === 'GET_MOVE') {
    const game = Game.fromState(gameData);
    const move = ai.getNextMove(game);
    self.postMessage({ move });
  } else if (type === 'LOAD_STRATEGY') {
    // Reload with new strategy
    isInitialized = false;
    initializeAI(strategyName);
  }
}

self.onmessage = (e) => {
  if (!isInitialized && e.data.type !== 'LOAD_STRATEGY') {
    // Queue the request until initialization is complete
    pendingRequests.push(e.data);
  } else {
    processRequest(e.data);
  }
};

// Start initialization with default strategy
initializeAI();
