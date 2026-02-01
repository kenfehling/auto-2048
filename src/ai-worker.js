import { Game } from './game.js';
import { AI } from './ai.js';

let ai = null;
let isInitialized = false;
let pendingRequests = [];
let currentStrategy = 'snake'; // default
let debugLogging = true; // Toggle with: self.debugLogging = true in console

// Initialize AI with strategy
async function initializeAI(strategyName = 'snake') {
  try {
    const response = await fetch(
      `${import.meta.env.BASE_URL}strategies/${strategyName}.dsl`
    );
    const strategyText = await response.text();
    ai = new AI(strategyText);
    isInitialized = true;
    currentStrategy = strategyName;
    console.log(`✅ Worker: Loaded ${strategyName} strategy`);

    // Process any pending requests
    while (pendingRequests.length > 0) {
      const request = pendingRequests.shift();
      processRequest(request);
    }
  } catch (error) {
    console.error(`❌ Worker: Failed to load ${strategyName} strategy:`, error);
    // Fallback to hardcoded strategy
    ai = new AI();
    isInitialized = true;
  }
}

function processRequest(data) {
  const { type, gameData, strategyName, speedFactor } = data;

  if (type === 'GET_MOVE') {
    if (!isInitialized) {
      pendingRequests.push(data);
      return;
    }
    
    const game = Game.fromState(gameData);
    const maxTimeMs = speedFactor === 15 ? 20 : Math.max(30, (16 - speedFactor) * 30);
    ai.maxTime = maxTimeMs;
    
    const move = ai.getNextMove(game);
    
    const moveData = {
      move: move,
      debug: {
        maxTime: ai.maxTime,
        maxDepth: ai.maxDepth,
        pruning: ai.pruningStrategy,
        strategy: currentStrategy,
        hasEvaluator: !!ai.evaluator
      }
    };
    
    self.postMessage(moveData);
  } else if (type === 'LOAD_STRATEGY') {
    isInitialized = false;
    initializeAI(strategyName);
  }
}

self.onmessage = (e) => {
  if (!isInitialized && e.data.type !== 'LOAD_STRATEGY') {
    pendingRequests.push(e.data);
    return;
  }
  processRequest(e.data);
};

initializeAI();
