import { Game } from './game.js';
import { AI } from './ai.js';

let ai = null;
let isInitialized = false;
let pendingRequests = [];
let currentStrategy = 'snake'; // default
let debugLogging = false; // Toggle with: self.debugLogging = true in console

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
    
    const move = ai.getNextMove(game);
    
    // Log all 4 move scores with full precision for debugging (only if enabled)
    if (debugLogging) {
      const scores = [0, 1, 2, 3].map(m => {
        const sim = Game.fromState(game.serialize());
        if (!sim.move(m, true)) return null;
        return ai.evaluate(sim);
      });
      
      console.log('🎯 All move scores:', {
        0: scores[0]?.toFixed(20),
        1: scores[1]?.toFixed(20),
        2: scores[2]?.toFixed(20),
        3: scores[3]?.toFixed(20),
        chosen: move,
        directions: { 0: 'Up', 1: 'Right', 2: 'Down', 3: 'Left' }
      });
    }
    
    // Capture diagnostic info
    const moveData = {
      move: move,
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
