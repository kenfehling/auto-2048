import { Game } from './game.js';
import { AI } from './ai.js';

let ai = null;
let isInitialized = false;
let pendingRequests = [];
let currentStrategy = 'snake'; // default
self.debugLogging = true; // Set to true to see detailed component scores in terminal/console
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
    
    // Log all 4 move scores with component breakdown (only if enabled)
    if (self.debugLogging) {
      const scores = [0, 1, 2, 3].map(m => {
        const sim = Game.fromState(game.serialize());
        sim.isSimulating = false; // We WANT logging for this evaluation
        const moved = sim.move(m, true);
        if (!moved) {
          console.log(`\n🚫 Move ${m} (Up,Right,Down,Left[${m}]): NOT POSSIBLE`);
          return null;
        }
        
        const origEmpty = game.grid.flat().filter(t => !t).length;
        const newEmpty = sim.grid.flat().filter(t => !t).length;
        console.log(`\n🔍 Evaluating Move ${m}: (empty: ${origEmpty} -> ${newEmpty})`);
        
        return ai.evaluate(sim);
      });
      
      console.log('\n🎯 Final Scores Summary:', {
        0: scores[0],
        1: scores[1],
        2: scores[2],
        3: scores[3],
        chosen: move
      });
    }
    
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
