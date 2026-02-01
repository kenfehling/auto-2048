import { Game } from './game.js';
import { AI } from './ai.js';

let ai = null;
let isInitialized = false;
let pendingRequests = [];
let currentStrategy = 'snake'; // default

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
    const game = Game.fromState(gameData);
    
    // Compute maxTime from speed factor (slower speed = more time to think)
    // Speed 15 (fastest): 10ms delay, 20ms think time
    // Speed 1 (slowest): 570ms delay, 400ms think time
    const maxTimeMs = speedFactor === 15 ? 20 : Math.max(30, (16 - speedFactor) * 30);
    ai.maxTime = maxTimeMs;
    
    // Capture diagnostic info
    const moveData = {
      move: ai.getNextMove(game),
      config: {
        maxTime: ai.maxTime,
        maxDepth: ai.maxDepth,
        pruning: ai.pruningStrategy,
        usesEvaluator: !!ai.evaluator,
        strategy: currentStrategy,
        speedFactor: speedFactor
      }
    };
    
    self.postMessage(moveData);
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
